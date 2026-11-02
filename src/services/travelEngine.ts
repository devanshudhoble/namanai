import { BookingHold, PassengerDetails, TravelOption } from '../types';
import { DEFAULT_PASSENGER, INITIAL_TRAVEL_OPTIONS, KOCHI_OPTIONS } from '../data/travelDatabase';

class TravelEngineService {
  private currentOptions: TravelOption[] = [...INITIAL_TRAVEL_OPTIONS];
  private activeHolds: Map<string, BookingHold> = new Map();

  public async searchTransportOptions(
    origin: string,
    destination: string,
    date: string,
    budget?: number | null,
    mode?: string | null
  ): Promise<{ options: TravelOption[]; searchLatencyMs: number }> {
    // Simulate real GDS/Aggregator API latency
    const start = performance.now();
    await new Promise((r) => setTimeout(r, 280));

    const isKochi = destination.toLowerCase().includes('kochi') || destination.toLowerCase().includes('cochin');
    let sourcePool = isKochi ? [...KOCHI_OPTIONS] : [...this.currentOptions];

    // Filter by mode if specified
    if (mode && mode !== 'all') {
      const modeLower = mode.toLowerCase();
      sourcePool = sourcePool.filter((opt) => opt.mode.toLowerCase() === modeLower);
    }

    // Filter by budget only if explicitly provided by the user
    let filtered = sourcePool;
    if (budget && budget > 0) {
      filtered = sourcePool.filter((opt) => opt.price <= budget + 1000);
    }

    // Sort: if budget provided sort by convenience, otherwise show varied options (flight, train, bus)
    filtered.sort((a, b) => b.convenienceScore - a.convenienceScore);

    const searchLatencyMs = Math.round(performance.now() - start);
    return { options: filtered, searchLatencyMs };
  }

  public async checkFareRules(optionId: string): Promise<{
    option: TravelOption;
    baggage: TravelOption['baggage'];
    cancellation: TravelOption['cancellation'];
  } | null> {
    await new Promise((r) => setTimeout(r, 140));
    const all = [...this.currentOptions, ...KOCHI_OPTIONS];
    const found = all.find((o) => o.id === optionId);
    if (!found) return null;
    return {
      option: found,
      baggage: found.baggage,
      cancellation: found.cancellation,
    };
  }

  public async lockFareAndHoldPNR(
    optionId: string,
    passenger: PassengerDetails = DEFAULT_PASSENGER
  ): Promise<BookingHold> {
    await new Promise((r) => setTimeout(r, 320));
    const all = [...this.currentOptions, ...KOCHI_OPTIONS];
    const option = all.find((o) => o.id === optionId) || this.currentOptions[0];

    const orderId = `ORD-VOY-${Math.floor(100000 + Math.random() * 900000)}`;
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const pnr = `6E-W8${randomSuffix}`;
    const holdExpiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes hold

    const hold: BookingHold = {
      orderId,
      pnr,
      selectedOption: option,
      passenger,
      holdExpiresAt,
      fareGuaranteed: true,
      amount: option.price,
      status: 'held',
    };

    this.activeHolds.set(orderId, hold);
    return hold;
  }

  public triggerPriceSpike(optionId: string, newPrice: number = 8600): TravelOption | null {
    const idx = this.currentOptions.findIndex((o) => o.id === optionId);
    if (idx !== -1) {
      const orig = this.currentOptions[idx];
      this.currentOptions[idx] = {
        ...orig,
        originalPrice: orig.price,
        price: newPrice,
        isSpiked: true,
        tradeOffDescription: `⚠️ Fare spiked dynamically from ₹${orig.price} to ₹${newPrice} due to high airline demand.`,
      };
      return this.currentOptions[idx];
    }
    return null;
  }

  public resetInventory(): void {
    this.currentOptions = [...INITIAL_TRAVEL_OPTIONS];
    this.activeHolds.clear();
  }

  public getHold(orderId: string): BookingHold | undefined {
    return this.activeHolds.get(orderId);
  }

  public confirmHold(orderId: string): BookingHold | null {
    const hold = this.activeHolds.get(orderId);
    if (!hold) return null;
    hold.status = 'paid';
    return hold;
  }
}

export const travelEngine = new TravelEngineService();
