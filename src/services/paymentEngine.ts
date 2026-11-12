// Payment, reconciliation and refund patterns (SANDBOX).
// No real money moves. What is real is the *decision logic*: every outcome below is derived from the
// state of the order (hold active? bank debited? inventory still there? hours to departure?) rather than
// hardcoded, so each failure pattern a travel platform sees in production can be demoed and tested.

import type { BookingHold, PaymentTransaction, RefundQuote, RefundRecord } from '../types';
import { fromISODate } from './nlu';

export type UpiFailureReason = 'USER_DECLINED' | 'BANK_TIMEOUT' | 'INSUFFICIENT_FUNDS';

export const FAILURE_COPY: Record<UpiFailureReason, string> = {
  USER_DECLINED: 'the request was declined in the UPI app',
  BANK_TIMEOUT: 'your bank did not respond in time',
  INSUFFICIENT_FUNDS: 'the account had insufficient balance',
};

export type ReconciliationOutcome = 'TICKET_ISSUED' | 'AUTO_REFUND' | 'NO_DEBIT_FOUND' | 'NO_ORDER';

export interface ReconciliationResult {
  outcome: ReconciliationOutcome;
  auditTrail: string[];
  refund?: RefundRecord;
}

const ts = () => new Date().toLocaleTimeString('en-IN');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const id = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase().slice(-6)}`;

/** Parses "06:20 AM" on a YYYY-MM-DD date into a timestamp. */
export function departureTimestamp(dateISO: string | null, departureTime: string): number | null {
  if (!dateISO) return null;
  const m = departureTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  const d = fromISODate(dateISO);
  if (m) {
    let h = parseInt(m[1], 10) % 12;
    if (m[3].toUpperCase() === 'PM') h += 12;
    d.setHours(h, parseInt(m[2], 10), 0, 0);
  }
  return d.getTime();
}

/** Pure function: refund = paid − cancellation fee (per traveller, depends on time to departure) − convenience fee. */
export function quoteRefund(hold: BookingHold, now: number = Date.now()): RefundQuote {
  const opt = hold.selectedOption;
  const dep = departureTimestamp(hold.travelDateISO, opt.departureTime);
  const hoursToDeparture = dep === null ? null : Math.round(((dep - now) / 36e5) * 10) / 10;
  const units = opt.mode === 'hotel' ? 1 : Math.max(1, hold.passengers);
  const convenience = opt.convenienceFee;

  if (!opt.cancellation.refundable) {
    return { orderId: hold.orderId, paidAmount: hold.amount, cancellationFee: hold.amount - convenience, nonRefundableConvenienceFee: convenience, refundAmount: 0, hoursToDeparture, rule: 'Non-refundable fare' };
  }
  if (hoursToDeparture !== null && hoursToDeparture <= 0) {
    return { orderId: hold.orderId, paidAmount: hold.amount, cancellationFee: hold.amount - convenience, nonRefundableConvenienceFee: convenience, refundAmount: 0, hoursToDeparture, rule: 'Departure time has passed (no-show)' };
  }
  const within24 = hoursToDeparture !== null && hoursToDeparture < 24;
  const perUnit = within24 ? opt.cancellation.feeWithin24h : opt.cancellation.feeBefore24h;
  const fee = Math.min(hold.amount - convenience, perUnit * units);
  return {
    orderId: hold.orderId,
    paidAmount: hold.amount,
    cancellationFee: fee,
    nonRefundableConvenienceFee: convenience,
    refundAmount: Math.max(0, hold.amount - fee - convenience),
    hoursToDeparture,
    rule: within24
      ? `Within 24h of departure: ₹${perUnit} × ${units}`
      : `More than 24h before departure: ₹${perUnit} × ${units}`,
  };
}

class PaymentEngineService {
  private transactions = new Map<string, PaymentTransaction>();

  /** Inside the Paytm app the natural pattern is UPI *intent* (one tap, PIN on device), not a collect request. */
  async requestPayment(orderId: string, amount: number, upiVpa: string): Promise<PaymentTransaction> {
    await sleep(200);
    const txn: PaymentTransaction = {
      transactionId: id('TXN'),
      orderId,
      gateway: 'PAYTM_UPI_INTENT',
      amount,
      currency: 'INR',
      upiVpa,
      status: 'PUSHED',
      initiatedAt: new Date().toISOString(),
      reconciliationLog: [`[${ts()}] UPI intent created for ₹${amount} (order ${orderId}, idempotency key = order id)`],
    };
    this.transactions.set(txn.transactionId, txn);
    return txn;
  }

  async approve(transactionId: string): Promise<PaymentTransaction> {
    await sleep(500);
    const txn = this.mustGet(transactionId);
    txn.status = 'CAPTURED';
    txn.completedAt = new Date().toISOString();
    txn.reconciliationLog.push(`[${ts()}] PSP callback: SUCCESS. Ledger credited ₹${txn.amount}`);
    return txn;
  }

  async fail(transactionId: string, reason: UpiFailureReason): Promise<PaymentTransaction> {
    await sleep(300);
    const txn = this.mustGet(transactionId);
    txn.status = 'FAILED';
    txn.failureReason = reason;
    txn.reconciliationLog.push(`[${ts()}] PSP callback: FAILED (${reason}). No debit. Seat hold kept for retry.`);
    return txn;
  }

  /** The classic support ticket: bank debited the customer but our callback never arrived, so no ticket was issued. */
  async markDebitedButPending(transactionId: string): Promise<PaymentTransaction> {
    await sleep(300);
    const txn = this.mustGet(transactionId);
    txn.status = 'DEBITED_PENDING';
    txn.reconciliationLog.push(`[${ts()}] PSP callback not received within SLA. Ledger shows PENDING.`);
    return txn;
  }

  /**
   * 3-way reconciliation: Bank/PSP status ↔ internal ledger ↔ inventory (GDS / IRCTC / bus operator).
   * The outcome depends on real order state, not on a script.
   */
  async reconcile(
    hold: BookingHold | null,
    txn: PaymentTransaction | null,
    opts: { inventoryAvailable: boolean }
  ): Promise<ReconciliationResult> {
    const trail: string[] = [];
    const log = (s: string) => trail.push(`[${ts()}] ${s}`);

    if (!hold || !txn) {
      log('No order found for this customer in the last 24h.');
      return { outcome: 'NO_ORDER', auditTrail: trail };
    }

    await sleep(300);
    const bankDebited = txn.status === 'DEBITED_PENDING' || txn.status === 'CAPTURED';
    log(`1. Bank / PSP status enquiry for ${txn.transactionId}: ${bankDebited ? 'DEBITED' : 'NOT DEBITED'}`);
    await sleep(300);
    log(`2. Internal ledger for ${hold.orderId}: ${txn.status === 'CAPTURED' ? 'PAID' : 'PENDING'}`);

    if (!bankDebited) {
      log('Outcome: no debit at bank. Nothing to recover. Customer can retry payment.');
      return { outcome: 'NO_DEBIT_FOUND', auditTrail: trail };
    }

    await sleep(350);
    const holdActive = hold.holdExpiresAt > Date.now();
    log(`3. Inventory check (${hold.selectedOption.provider}): hold ${holdActive ? 'ACTIVE' : 'EXPIRED'}, seat ${opts.inventoryAvailable ? 'AVAILABLE' : 'SOLD OUT'}`);

    if (holdActive || opts.inventoryAvailable) {
      txn.status = 'RECONCILED';
      txn.reconciliationLog.push(`[${ts()}] Reconciled: ledger marked PAID, ticket issued.`);
      log(`Outcome: ticket issued against existing payment. PNR ${hold.pnr}.`);
      return { outcome: 'TICKET_ISSUED', auditTrail: trail };
    }

    const refund: RefundRecord = {
      orderId: hold.orderId,
      paidAmount: hold.amount,
      cancellationFee: 0,
      nonRefundableConvenienceFee: 0,
      refundAmount: hold.amount,
      hoursToDeparture: null,
      rule: 'Booking failed after debit: full refund, no fees',
      refundId: id('RFD'),
      initiatedAt: new Date().toISOString(),
      destination: txn.upiVpa,
      eta: 'to the source UPI account (bank timelines apply)',
    };
    txn.status = 'REFUNDED';
    log(`Outcome: seat no longer available. Full auto-refund ${refund.refundId} of ₹${refund.refundAmount} initiated.`);
    return { outcome: 'AUTO_REFUND', auditTrail: trail, refund };
  }

  async refund(hold: BookingHold, txn: PaymentTransaction | null, quote: RefundQuote): Promise<RefundRecord> {
    await sleep(400);
    if (txn) {
      txn.status = 'REFUNDED';
      txn.reconciliationLog.push(`[${ts()}] Cancellation refund of ₹${quote.refundAmount} initiated`);
    }
    return {
      ...quote,
      refundId: id('RFD'),
      initiatedAt: new Date().toISOString(),
      destination: txn?.upiVpa ?? 'original payment method',
      eta: 'to the source UPI account (bank timelines apply)',
    };
  }

  private mustGet(transactionId: string) {
    const t = this.transactions.get(transactionId);
    if (!t) throw new Error(`Transaction ${transactionId} not found`);
    return t;
  }
}

export const paymentEngine = new PaymentEngineService();
