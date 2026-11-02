import { TravelOption, BookingHold, Message, PassengerDetails } from '../types';

export interface SlotStateMatrix {
  origin: string | null;
  originCode: string | null;
  destination: string | null;
  destCode: string | null;
  travelDate: string | null;
  budgetCap: number;
  conveniencePreference: string;
  lockedOptionId: string | null;
  pnr: string | null;
  orderId: string | null;
  activeHoldStatus: 'NONE' | 'HELD' | 'PAID' | 'RECONCILED' | 'CANCELLED';
}

export interface GroundedFactPayload {
  selectedOption: TravelOption | null;
  baggageAllowance: string | null;
  cancellationClause: string | null;
  liveFare: number | null;
  verifiedAtTimestamp: number;
}

export class ContextEngineeringHarness {
  private slots: SlotStateMatrix;
  private groundedFacts: GroundedFactPayload;
  private maxDialogueTurns: number = 4;

  constructor() {
    this.slots = this.getInitialSlots();
    this.groundedFacts = {
      selectedOption: null,
      baggageAllowance: null,
      cancellationClause: null,
      liveFare: null,
      verifiedAtTimestamp: Date.now(),
    };
  }

  private getInitialSlots(): SlotStateMatrix {
    return {
      origin: 'Bengaluru',
      originCode: 'BLR',
      destination: 'Goa',
      destCode: 'GOX',
      travelDate: '2026-11-06 (Next Friday)',
      budgetCap: 8000,
      conveniencePreference: 'Fast, Non-stop, Morning',
      lockedOptionId: null,
      pnr: null,
      orderId: null,
      activeHoldStatus: 'NONE',
    };
  }

  // Updates deterministic slots without letting the LLM guess
  public updateSlots(updates: Partial<SlotStateMatrix>) {
    this.slots = { ...this.slots, ...updates };
  }

  public getSlots(): SlotStateMatrix {
    return { ...this.slots };
  }

  // Injects authoritative provider data
  public injectGroundedFacts(option: TravelOption) {
    this.groundedFacts = {
      selectedOption: option,
      baggageAllowance: option.baggage.checkIn,
      cancellationClause: option.cancellation.refundSummary,
      liveFare: option.price,
      verifiedAtTimestamp: Date.now(),
    };
    this.slots.lockedOptionId = option.id;
  }

  // Compresses conversation history to prevent token bloat & context rot
  public assemblePromptContext(messages: Message[]): string {
    const recentMessages = messages
      .filter((m) => m.role !== 'system')
      .slice(-this.maxDialogueTurns);

    const formattedDialogue = recentMessages
      .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
      .join('\n');

    const slotSummary = JSON.stringify(this.slots, null, 2);
    const factSummary = JSON.stringify(this.groundedFacts, null, 2);

    return `
### SYSTEM DIRECTIVE (IMMUTABLE GUARDRAILS)
- You are VoyAI Naman, an elite voice travel concierge.
- NEVER invent fares, PNRs, or schedules. All prices MUST be grounded in the VERIFIED FACTS block.
- NEVER solicit UPI PINs, CVVs, passwords, or OTPs over voice channels.
- Keep spoken output concise (max 2-3 spoken sentences), natural, and clear.

### DETERMINISTIC SLOT STATE MATRIX (AUTHORITATIVE)
${slotSummary}

### VERIFIED LIVE GDS / PROVIDER FACTS (GROUND TRUTH)
${factSummary}

### ROLLING DIALOGUE WINDOW (LAST ${this.maxDialogueTurns} TURNS)
${formattedDialogue}
    `.trim();
  }

  // Safety filter to detect if payment credentials leak into conversation
  public sanitizeUserUtterance(text: string): { isSafe: boolean; warning?: string } {
    const pinRegex = /\b\d{4,6}\b/;
    const otpKeywords = ['otp', 'cvv', 'pin', 'password'];

    const hasOtpKeyword = otpKeywords.some((kw) => text.toLowerCase().includes(kw));
    if (hasOtpKeyword && pinRegex.test(text)) {
      return {
        isSafe: false,
        warning: 'SECURITY VIOLATION: Never share PIN or OTP over voice. Payment must be approved out-of-band.',
      };
    }
    return { isSafe: true };
  }
}

export const contextHarness = new ContextEngineeringHarness();
