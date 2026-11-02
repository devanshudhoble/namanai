import { PaymentTransaction } from '../types';
import { travelEngine } from './travelEngine';

class PaymentEngineService {
  private transactions: Map<string, PaymentTransaction> = new Map();

  public async initiateUpiPush(
    orderId: string,
    amount: number,
    upiVpa: string
  ): Promise<PaymentTransaction> {
    await new Promise((r) => setTimeout(r, 210));
    const transactionId = `TXN-UPI-${Date.now().toString(36).toUpperCase()}`;
    const txn: PaymentTransaction = {
      transactionId,
      orderId,
      gateway: 'UPI_INTENT',
      amount,
      currency: 'INR',
      upiVpa,
      status: 'PUSHED',
      initiatedAt: new Date().toISOString(),
      reconciliationLog: [
        `[${new Date().toLocaleTimeString()}] UPI Collect request dispatched to ${upiVpa} via NPCI gateway`,
        `[${new Date().toLocaleTimeString()}] Order amount ₹${amount} locked on session idempotency token`,
      ],
    };
    this.transactions.set(transactionId, txn);
    return txn;
  }

  public async simulateCustomerUpiApproval(
    transactionId: string
  ): Promise<{ transaction: PaymentTransaction; pnr: string }> {
    await new Promise((r) => setTimeout(r, 600));
    const txn = this.transactions.get(transactionId);
    if (!txn) throw new Error('Transaction not found');

    txn.status = 'CAPTURED';
    txn.completedAt = new Date().toISOString();
    txn.reconciliationLog.push(
      `[${new Date().toLocaleTimeString()}] Webhook received: NPCI response CODE_00 (Success)`,
      `[${new Date().toLocaleTimeString()}] Internal ledger credited ₹${txn.amount}`,
      `[${new Date().toLocaleTimeString()}] Airline GDS ticketing API called: PNR confirmed`
    );

    const hold = travelEngine.confirmHold(txn.orderId);
    return {
      transaction: txn,
      pnr: hold?.pnr || '6E-W8KZ7Q',
    };
  }

  public async simulatePaymentFailure(
    transactionId: string,
    reason: string = 'CUSTOMER_CANCELLED'
  ): Promise<PaymentTransaction> {
    await new Promise((r) => setTimeout(r, 300));
    const txn = this.transactions.get(transactionId);
    if (!txn) throw new Error('Transaction not found');

    txn.status = 'FAILED';
    txn.failureReason = reason;
    txn.reconciliationLog.push(
      `[${new Date().toLocaleTimeString()}] Gateway event: Transaction rejected (${reason})`,
      `[${new Date().toLocaleTimeString()}] Idempotent seat hold preserved for 10-minute retry window`
    );
    return txn;
  }

  public async reconcileMoneyDeductedTicketPending(
    orderId: string
  ): Promise<{
    success: boolean;
    auditLogs: string[];
    pnr: string;
    resolvedStatus: string;
  }> {
    const logs: string[] = [];
    const pushLog = (msg: string) => logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);

    pushLog('RECONCILIATION ENGINE: Starting 3-way automated audit...');
    await new Promise((r) => setTimeout(r, 300));
    pushLog('Step 1: Inquiring Bank & Payment Gateway (Razorpay/NPCI)... Status = CAPTURED (Funds received).');

    await new Promise((r) => setTimeout(r, 400));
    pushLog('Step 2: Checking Internal Booking Ledger... Order ID matched. Status = PENDING_GDS_ACK.');

    await new Promise((r) => setTimeout(r, 450));
    pushLog('Step 3: Checking Airline Reservation desk (IndiGo 6E NDC)... Seat hold active. PNR generated: 6E-W8KZ7Q.');

    await new Promise((r) => setTimeout(r, 350));
    pushLog('Step 4: Ticket issued. Synchronizing customer database and triggering WhatsApp delivery.');

    travelEngine.confirmHold(orderId);

    return {
      success: true,
      auditLogs: logs,
      pnr: '6E-W8KZ7Q',
      resolvedStatus: 'CONFIRMED_VIA_RECONCILIATION',
    };
  }
}

export const paymentEngine = new PaymentEngineService();
