export type TravelMode = 'flight' | 'bus' | 'train' | 'hotel' | 'cab' | 'carpool';

export interface BaggagePolicy {
  cabin: string;
  checkIn: string;
  extraBagPricePerKg?: number;
}

export interface CancellationPolicy {
  refundable: boolean;
  refundSummary: string;
  feeBefore24h: number;
  feeWithin24h: number;
  penaltyClause: string;
}

export interface TravelOption {
  id: string;
  mode: TravelMode;
  provider: string;
  operator: string;
  serviceNumber: string; // e.g. "6E-512"
  origin: string;
  originCode: string;
  originTerminal: string;
  destination: string;
  destCode: string;
  destTerminal: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  price: number;
  baseFare: number;
  taxesAndFees: number;
  convenienceFee: number;
  seatsAvailable: number;
  baggage: BaggagePolicy;
  cancellation: CancellationPolicy;
  convenienceScore: number; // 1-100
  isRecommended?: boolean;
  recommendationTag?: string; // e.g. "Best Value & Convenience"
  tradeOffDescription: string;
  isSpiked?: boolean;
  originalPrice?: number;
  /** Cabs: every bookable cab fare has a quote id from the cabs engine (no quote id, no fare). */
  quoteId?: string;
  cab?: CabMeta;
}

export type CabProduct = 'airport' | 'rental' | 'trip' | 'share';

export interface CabMeta {
  product: CabProduct;
  quoteId: string;
  providerKey: string;
  pickupLabel: string;
  dropLabel: string;
  pickupTime: string; // HH:MM 24h
  rideMinutes: number;
  onTimePct: number;
  cancelPct: number;
  rating: number;
  womenDriver: boolean;
  ev: boolean;
  seats: number;
  bags: number;
  lines: { label: string; amount: number }[];
  allIn: number;
  score?: number;
  why?: string[];
  flightNumber?: string;
  flightStatus?: string;
  hours?: number;
  days?: number;
  kmIncluded?: number;
  plannedKm?: number;
  extraKmRate?: number;
  extraHourRate?: number;
  permitNote?: string;
  shared?: boolean;
  splitCars?: boolean;
  costShareRule?: string;
}

export type AgentStateStep =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'discovering'
  | 'options_presented'
  | 'option_selected'
  | 'seat_locked'
  | 'payment_pushed'
  | 'payment_verifying'
  | 'payment_exception_recovery'
  | 'confirmed'
  | 'cancellation_quoted'
  | 'cancelled';

export interface PassengerDetails {
  id: string;
  name: string;
  phone: string;
  email: string;
  upiId: string;
  frequentFlyerNo?: string;
  seatPreference?: string;
}

export interface BookingHold {
  orderId: string;
  pnr?: string;
  selectedOption: TravelOption;
  passenger: PassengerDetails;
  holdExpiresAt: number; // timestamp ms
  fareGuaranteed: boolean;
  amount: number;
  passengers: number;
  travelDateISO: string | null;
  status: 'held' | 'paid' | 'expired' | 'released' | 'reconciled' | 'cancelled' | 'refunded';
}

export interface Message {
  id: string;
  role: 'user' | 'agent' | 'system';
  text: string;
  timestamp: string;
  audioDuration?: number;
  intentDetected?: string;
  latencyMs?: number;
  toolCall?: {
    name: string;
    params: Record<string, any>;
    resultSummary: string;
    durationMs: number;
  };
  isSpoken?: boolean;
}

export interface PaymentTransaction {
  transactionId: string;
  orderId: string;
  gateway: 'PAYTM_UPI_INTENT' | 'UPI_COLLECT';
  amount: number;
  currency: string;
  upiVpa: string;
  status: 'PENDING' | 'PUSHED' | 'CAPTURED' | 'FAILED' | 'DEBITED_PENDING' | 'RECONCILED' | 'REFUNDED';
  failureReason?: string;
  initiatedAt: string;
  completedAt?: string;
  reconciliationLog: string[];
}

export interface RefundQuote {
  orderId: string;
  paidAmount: number;
  cancellationFee: number;
  nonRefundableConvenienceFee: number;
  refundAmount: number;
  hoursToDeparture: number | null;
  rule: string;
}

export interface RefundRecord extends RefundQuote {
  refundId: string;
  initiatedAt: string;
  destination: string;
  eta: string;
}
