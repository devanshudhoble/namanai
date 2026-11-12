import { BookingHold, PassengerDetails, TravelOption } from '../types';
import { DEFAULT_PASSENGER } from '../data/travelDatabase';

// Indian Transit Hub Database
interface CityTransitInfo {
  code: string;
  airportName: string;
  railwayCode: string;
  railwayName: string;
  busTerminal: string;
  expressTrainName?: string;
  trainNumber?: string;
}

const CITY_SPELLING_ALIASES: Record<string, string> = {
  jodpur: 'jodhpur',
  bombay: 'mumbai',
  bangalore: 'bengaluru',
  calcutta: 'kolkata',
  madras: 'chennai',
  cochin: 'kochi',
  banaras: 'varanasi',
  kashi: 'varanasi',
  baroda: 'vadodara',
  poona: 'pune',
  trivandrum: 'thiruvananthapuram',
  vizag: 'visakhapatnam',
  mysore: 'mysuru',
  prayag: 'prayagraj',
  allahabad: 'prayagraj',
  gurgaon: 'gurugram',
  simla: 'shimla',
  shrinagar: 'srinagar',
  dilli: 'delhi',
  amritser: 'amritsar',
};

const INDIAN_CITIES_MAP: Record<string, CityTransitInfo> = {
  mumbai: {
    code: 'BOM',
    airportName: 'Chhatrapati Shivaji Terminal 2',
    railwayCode: 'CSTM',
    railwayName: 'CSMT / LTT Terminal',
    busTerminal: 'Borivali & Dadar Hub',
    expressTrainName: 'Mumbai Superfast Express',
    trainNumber: '12952',
  },
  delhi: {
    code: 'DEL',
    airportName: 'Indira Gandhi Terminal 3',
    railwayCode: 'NDLS',
    railwayName: 'New Delhi Railway Station (NDLS)',
    busTerminal: 'ISBT Kashmiri Gate',
    expressTrainName: 'Rajdhani Express',
    trainNumber: '12431',
  },
  bengaluru: {
    code: 'BLR',
    airportName: 'Kempegowda International Terminal 1',
    railwayCode: 'SBC',
    railwayName: 'KSR Bengaluru City Junction (SBC)',
    busTerminal: 'Majestic Bus Stand',
    expressTrainName: 'Karnataka Express',
    trainNumber: '12628',
  },
  nagpur: {
    code: 'NAG',
    airportName: 'Dr. Babasaheb Ambedkar International Airport',
    railwayCode: 'NGP',
    railwayName: 'Nagpur Junction (NGP)',
    busTerminal: 'Ganeshpeth Bus Terminal',
    expressTrainName: 'Nagpur Duronto SF Express',
    trainNumber: '12290',
  },
  jodhpur: {
    code: 'JDH',
    airportName: 'Jodhpur Civil Airport (JDH)',
    railwayCode: 'JU',
    railwayName: 'Jodhpur Junction (JU)',
    busTerminal: 'Raika Bagh Central Bus Stand',
    expressTrainName: 'Mandore Superfast Express',
    trainNumber: '22996',
  },
  jaipur: {
    code: 'JAI',
    airportName: 'Jaipur International Terminal 2',
    railwayCode: 'JP',
    railwayName: 'Jaipur Junction (JP)',
    busTerminal: 'Sindhi Camp Central',
    expressTrainName: 'Jaipur Double Decker SF Express',
    trainNumber: '12986',
  },
  pune: {
    code: 'PNQ',
    airportName: 'Pune Airport (Lohegaon)',
    railwayCode: 'PUNE',
    railwayName: 'Pune Junction (PUNE)',
    busTerminal: 'Swargate / Wakad Bus Stand',
    expressTrainName: 'Deccan Queen Superfast',
    trainNumber: '12124',
  },
  hyderabad: {
    code: 'HYD',
    airportName: 'Rajiv Gandhi International Terminal 1',
    railwayCode: 'SC',
    railwayName: 'Secunderabad Junction (SC)',
    busTerminal: 'MGBS Hub',
    expressTrainName: 'Charminar Superfast Express',
    trainNumber: '12760',
  },
  chennai: {
    code: 'MAA',
    airportName: 'Chennai International Terminal 1',
    railwayCode: 'MAS',
    railwayName: 'MGR Chennai Central (MAS)',
    busTerminal: 'CMBT Koyambedu',
    expressTrainName: 'Tamil Nadu Express',
    trainNumber: '12622',
  },
  kolkata: {
    code: 'CCU',
    airportName: 'Netaji Subhash Chandra Bose Terminal',
    railwayCode: 'HWH',
    railwayName: 'Howrah Junction (HWH)',
    busTerminal: 'Esplanade Bus Terminus',
    expressTrainName: 'Howrah Mail Superfast',
    trainNumber: '12810',
  },
  ahmedabad: {
    code: 'AMD',
    airportName: 'Sardar Vallabhbhai Patel Terminal',
    railwayCode: 'ADI',
    railwayName: 'Ahmedabad Junction (ADI)',
    busTerminal: 'Gita Mandir Bus Stand',
    expressTrainName: 'Gujarat Mail Superfast',
    trainNumber: '12902',
  },
  lucknow: {
    code: 'LKO',
    airportName: 'Chaudhary Charan Singh Terminal 2',
    railwayCode: 'LKO',
    railwayName: 'Lucknow Charbagh (LKO)',
    busTerminal: 'Alambagh Inter-State Terminal',
    expressTrainName: 'Lucknow Mail Superfast',
    trainNumber: '12230',
  },
  chandigarh: {
    code: 'IXC',
    airportName: 'Shaheed Bhagat Singh International',
    railwayCode: 'CDG',
    railwayName: 'Chandigarh Junction (CDG)',
    busTerminal: 'Sector 43 ISBT',
    expressTrainName: 'Chandigarh Shatabdi Express',
    trainNumber: '12046',
  },
  varanasi: {
    code: 'VNS',
    airportName: 'Lal Bahadur Shastri International',
    railwayCode: 'BSB',
    railwayName: 'Varanasi Junction (BSB)',
    busTerminal: 'Cantt Roadways Bus Stand',
    expressTrainName: 'Kashi Vishwanath Express',
    trainNumber: '15128',
  },
  bhopal: {
    code: 'BHO',
    airportName: 'Raja Bhoj Airport',
    railwayCode: 'BPL',
    railwayName: 'Rani Kamlapati Station (RKMP)',
    busTerminal: 'Nadra Bus Stand',
    expressTrainName: 'Bhopal Vande Bharat Express',
    trainNumber: '20172',
  },
  indore: {
    code: 'IDR',
    airportName: 'Devi Ahilyabai Holkar Airport',
    railwayCode: 'INDB',
    railwayName: 'Indore Junction (INDB)',
    busTerminal: 'Sarwate Bus Stand',
    expressTrainName: 'Malwa Superfast Express',
    trainNumber: '12920',
  },
  patna: {
    code: 'PAT',
    airportName: 'Jay Prakash Narayan Airport',
    railwayCode: 'PNBE',
    railwayName: 'Patna Junction (PNBE)',
    busTerminal: 'Bairiya ISBT Patna',
    expressTrainName: 'Magadh Superfast Express',
    trainNumber: '20802',
  },
  surat: {
    code: 'STV',
    airportName: 'Surat International Airport',
    railwayCode: 'ST',
    railwayName: 'Surat Railway Station (ST)',
    busTerminal: 'Surat Central Bus Station',
    expressTrainName: 'Flying Ranee Superfast',
    trainNumber: '12922',
  },
  kochi: {
    code: 'COK',
    airportName: 'Cochin International Terminal 1',
    railwayCode: 'ERS',
    railwayName: 'Ernakulam South Junction (ERS)',
    busTerminal: 'Vytilla Mobility Hub',
    expressTrainName: 'Kerala Express',
    trainNumber: '12626',
  },
  goa: {
    code: 'GOX',
    airportName: 'Manohar International Airport (Mopa)',
    railwayCode: 'MAO',
    railwayName: 'Madgaon Junction (MAO)',
    busTerminal: 'Panjim Central Bus Stand',
    expressTrainName: 'Mandovi Superfast Express',
    trainNumber: '10104',
  },
  amritsar: {
    code: 'ATQ',
    airportName: 'Sri Guru Ram Dass Jee International',
    railwayCode: 'ASR',
    railwayName: 'Amritsar Junction (ASR)',
    busTerminal: 'ISBT Amritsar',
    expressTrainName: 'Golden Temple Mail',
    trainNumber: '12903',
  },
  manali: {
    code: 'KUU',
    airportName: 'Bhuntar / Kullu Airport',
    railwayCode: 'CDG',
    railwayName: 'Chandigarh / Kalka Link',
    busTerminal: 'Manali Private Volvo Bus Stand',
    expressTrainName: 'Himalayan Queen Express',
    trainNumber: '14095',
  },
  shimla: {
    code: 'SLV',
    airportName: 'Jubbarhatti / Chandigarh Link',
    railwayCode: 'SML',
    railwayName: 'Shimla Toy Train Station (SML)',
    busTerminal: 'ISBT Tutikandi Shimla',
    expressTrainName: 'Shivalik Deluxe Express',
    trainNumber: '52451',
  },
  dehradun: {
    code: 'DED',
    airportName: 'Jolly Grant Airport Dehradun',
    railwayCode: 'DDN',
    railwayName: 'Dehradun Railway Station (DDN)',
    busTerminal: 'ISBT Dehradun',
    expressTrainName: 'Dehradun Shatabdi Express',
    trainNumber: '12017',
  },
  ayodhya: {
    code: 'AYJ',
    airportName: 'Maharishi Valmiki International Airport',
    railwayCode: 'AY',
    railwayName: 'Ayodhya Dham Junction (AY)',
    busTerminal: 'Ayodhya Dham Central Bus Stand',
    expressTrainName: 'Vande Bharat Ayodhya Express',
    trainNumber: '22425',
  },
  shirdi: {
    code: 'SAG',
    airportName: 'Shirdi International Airport',
    railwayCode: 'SNSI',
    railwayName: 'Sainagar Shirdi Station (SNSI)',
    busTerminal: 'Shirdi Nagar Bus Stand',
    expressTrainName: 'Sainagar Shirdi Superfast Express',
    trainNumber: '22602',
  },
  udaipur: {
    code: 'UDR',
    airportName: 'Maharana Pratap Airport (UDR)',
    railwayCode: 'UDZ',
    railwayName: 'Udaipur City Station (UDZ)',
    busTerminal: 'Udiapole Central Bus Stand',
    expressTrainName: 'Chetak Superfast Express',
    trainNumber: '20473',
  },
  srinagar: {
    code: 'SXR',
    airportName: 'Sheikh ul-Alam International Airport',
    railwayCode: 'SINA',
    railwayName: 'Srinagar Railway Station (SINA)',
    busTerminal: 'TRC Bus Station Srinagar',
    expressTrainName: 'Vande Bharat Kashmir Express',
    trainNumber: '22477',
  },
  kashmir: {
    code: 'SXR',
    airportName: 'Sheikh ul-Alam International Airport',
    railwayCode: 'SINA',
    railwayName: 'Srinagar Kashmir Station (SINA)',
    busTerminal: 'TRC Bus Station Srinagar',
    expressTrainName: 'Kashmir Valley Express',
    trainNumber: '22477',
  },
  kerala: {
    code: 'COK',
    airportName: 'Cochin International Terminal',
    railwayCode: 'ERS',
    railwayName: 'Ernakulam South Junction (ERS)',
    busTerminal: 'Vytilla Mobility Hub',
    expressTrainName: 'Kerala Superfast Express',
    trainNumber: '12626',
  },
  rajasthan: {
    code: 'JAI',
    airportName: 'Jaipur International Airport',
    railwayCode: 'JP',
    railwayName: 'Jaipur Junction (JP)',
    busTerminal: 'Sindhi Camp Central',
    expressTrainName: 'Rajasthan Sampark Kranti',
    trainNumber: '12464',
  },
};

export function normalizeCityName(raw: string): string {
  if (!raw) return 'India';
  const clean = raw.trim().toLowerCase();
  const resolved = CITY_SPELLING_ALIASES[clean] || clean;
  return resolved
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function resolveCityInfo(name: string): CityTransitInfo {
  const clean = normalizeCityName(name).toLowerCase();
  for (const [key, info] of Object.entries(INDIAN_CITIES_MAP)) {
    if (clean.includes(key) || key.includes(clean)) {
      return info;
    }
  }

  // Universal fallback for any Indian town, state, or village
  const code = (clean.replace(/[^a-z]/g, '').slice(0, 3) || 'IND').toUpperCase();
  const title = normalizeCityName(name);
  return {
    code,
    airportName: `${title} Domestic Terminal (${code})`,
    railwayCode: code,
    railwayName: `${title} Junction (${code})`,
    busTerminal: `${title} Central Bus Station`,
    expressTrainName: `${title} Superfast Express`,
    trainNumber: `12${Math.floor(100 + Math.random() * 800)}`,
  };
}

class TravelEngineService {
  private currentOptions: TravelOption[] = [];
  private activeHolds: Map<string, BookingHold> = new Map();

  constructor() {
    this.currentOptions = this.generateOptionsForRoute('Bengaluru', 'Jodhpur', 'Next Friday', 1);
  }

  public generateOptionsForRoute(
    originRaw: string,
    destinationRaw: string,
    date: string,
    passengersCount: number = 1
  ): TravelOption[] {
    const origin = normalizeCityName(originRaw || 'Bengaluru');
    const destination = normalizeCityName(destinationRaw || 'Jodhpur');
    const oInfo = resolveCityInfo(origin);
    const dInfo = resolveCityInfo(destination);
    const pCount = Math.max(1, passengersCount);

    const baseFlight = 4800;
    const baseTrain3ac = 1280;
    const baseTrainSL = 420;
    const baseTrain2ac = 1850;
    const baseBusSleeper = 1450;
    const baseBusSemi = 980;
    const baseHotel = 3200;

    const trainName = dInfo.expressTrainName || `${destination} SF Express`;
    const trainNum = dInfo.trainNumber || `12${Math.floor(100 + Math.random() * 800)}`;

    const options: TravelOption[] = [
      // 1. FASTEST DIRECT FLIGHT
      {
        id: `opt-flight-indigo-${Date.now()}-1`,
        mode: 'flight',
        provider: 'IndiGo Airlines',
        operator: 'IndiGo',
        serviceNumber: `6E-${Math.floor(200 + Math.random() * 700)}`,
        origin: origin,
        originCode: oInfo.code,
        originTerminal: oInfo.airportName,
        destination: destination,
        destCode: dInfo.code,
        destTerminal: dInfo.airportName,
        departureTime: '06:20 AM',
        arrivalTime: '08:15 AM',
        duration: '1h 55m (Non-stop)',
        price: (baseFlight + 350) * pCount,
        baseFare: (baseFlight - 400) * pCount,
        taxesAndFees: 450 * pCount,
        convenienceFee: 300,
        seatsAvailable: 9,
        baggage: {
          cabin: '7 kg Hand Bag per passenger',
          checkIn: '15 kg Check-in Included (1 piece)',
          extraBagPricePerKg: 550,
        },
        cancellation: {
          refundable: true,
          refundSummary: 'Partial refund available up to 2h before departure',
          feeBefore24h: 1500,
          feeWithin24h: 3000,
          penaltyClause: 'Airline fee ₹2,500 + taxes non-refundable.',
        },
        convenienceScore: 95,
        isRecommended: true,
        recommendationTag: 'Top Pick • Fastest Direct Flight',
        tradeOffDescription: `Direct morning flight to ${destination} in 1h 55m. Includes 15 kg check-in baggage.`,
      },

      // 2. BEST VALUE AFTERNOON FLIGHT
      {
        id: `opt-flight-akasa-${Date.now()}-2`,
        mode: 'flight',
        provider: 'Akasa Air',
        operator: 'Akasa',
        serviceNumber: `QP-${Math.floor(1100 + Math.random() * 400)}`,
        origin: origin,
        originCode: oInfo.code,
        originTerminal: oInfo.airportName,
        destination: destination,
        destCode: dInfo.code,
        destTerminal: dInfo.airportName,
        departureTime: '02:30 PM',
        arrivalTime: '04:25 PM',
        duration: '1h 55m (Direct)',
        price: baseFlight * pCount,
        baseFare: (baseFlight - 600) * pCount,
        taxesAndFees: 350 * pCount,
        convenienceFee: 250,
        seatsAvailable: 6,
        baggage: {
          cabin: '7 kg Hand Bag',
          checkIn: '15 kg Luggage Included',
          extraBagPricePerKg: 500,
        },
        cancellation: {
          refundable: true,
          refundSummary: 'Full refund minus ₹2,000 cancellation charge',
          feeBefore24h: 1200,
          feeWithin24h: 2500,
          penaltyClause: 'Flexible reschedule allowed up to 4h before flight.',
        },
        convenienceScore: 89,
        isRecommended: false,
        recommendationTag: 'Best Value Flight',
        tradeOffDescription: `Affordable afternoon departure with comfortable seats and USB charging.`,
      },

      // 3. IRCTC 3RD AC (3AC) TRAIN
      {
        id: `opt-train-3ac-${Date.now()}-3`,
        mode: 'train',
        provider: 'IRCTC Indian Railways',
        operator: 'Indian Railways',
        serviceNumber: `${trainName} (${trainNum})`,
        origin: origin,
        originCode: oInfo.railwayCode,
        originTerminal: oInfo.railwayName,
        destination: destination,
        destCode: dInfo.railwayCode,
        destTerminal: dInfo.railwayName,
        departureTime: '08:45 PM (Night)',
        arrivalTime: '09:30 AM (Next Day)',
        duration: '12h 45m (Superfast)',
        price: baseTrain3ac * pCount,
        baseFare: 1100 * pCount,
        taxesAndFees: 120 * pCount,
        convenienceFee: 60,
        seatsAvailable: 18,
        baggage: {
          cabin: '10 kg Personal Luggage',
          checkIn: '40 kg Free Railway Allowance',
        },
        cancellation: {
          refundable: true,
          refundSummary: 'Full refund minus ₹180 IRCTC clerkage up to 48h prior',
          feeBefore24h: 180,
          feeWithin24h: 360,
          penaltyClause: 'Automatic refund to source UPI ID within 24 hours of cancellation.',
        },
        convenienceScore: 86,
        isRecommended: true,
        recommendationTag: '3AC Comfort Sleeper • Best Balance',
        tradeOffDescription: `Overnight journey on ${trainName} with confirmed berths, clean bedroll, and pantry meals.`,
      },

      // 4. IRCTC SLEEPER CLASS (SL) TRAIN
      {
        id: `opt-train-sl-${Date.now()}-4`,
        mode: 'train',
        provider: 'IRCTC Indian Railways',
        operator: 'Indian Railways',
        serviceNumber: `${trainName} (${trainNum})`,
        origin: origin,
        originCode: oInfo.railwayCode,
        originTerminal: oInfo.railwayName,
        destination: destination,
        destCode: dInfo.railwayCode,
        destTerminal: dInfo.railwayName,
        departureTime: '06:30 PM (Evening)',
        arrivalTime: '08:15 AM (Next Morning)',
        duration: '13h 45m',
        price: baseTrainSL * pCount,
        baseFare: 360 * pCount,
        taxesAndFees: 40 * pCount,
        convenienceFee: 20,
        seatsAvailable: 34,
        baggage: {
          cabin: 'Standard Backpack',
          checkIn: '35 kg Railway Allowance',
        },
        cancellation: {
          refundable: true,
          refundSummary: 'Flat ₹60 deduction before chart preparation',
          feeBefore24h: 60,
          feeWithin24h: 120,
          penaltyClause: 'IRCTC standard cancellation rules.',
        },
        convenienceScore: 72,
        isRecommended: false,
        recommendationTag: 'Sleeper Class (SL) • Budget Saver',
        tradeOffDescription: `Most economical option for budget-conscious travellers at ₹${baseTrainSL * pCount}.`,
      },

      // 5. IRCTC 2ND AC (2AC) TRAIN
      {
        id: `opt-train-2ac-${Date.now()}-5`,
        mode: 'train',
        provider: 'IRCTC Indian Railways',
        operator: 'Indian Railways',
        serviceNumber: `${trainName} (2AC Executive)`,
        origin: origin,
        originCode: oInfo.railwayCode,
        originTerminal: oInfo.railwayName,
        destination: destination,
        destCode: dInfo.railwayCode,
        destTerminal: dInfo.railwayName,
        departureTime: '09:15 PM (Night)',
        arrivalTime: '09:00 AM (Next Day)',
        duration: '11h 45m',
        price: baseTrain2ac * pCount,
        baseFare: 1600 * pCount,
        taxesAndFees: 180 * pCount,
        convenienceFee: 70,
        seatsAvailable: 8,
        baggage: {
          cabin: '15 kg Cabin Luggage',
          checkIn: '50 kg Free Allowance',
        },
        cancellation: {
          refundable: true,
          refundSummary: 'Refundable minus ₹240 IRCTC fee',
          feeBefore24h: 240,
          feeWithin24h: 480,
          penaltyClause: 'Priority refund status.',
        },
        convenienceScore: 84,
        isRecommended: false,
        recommendationTag: '2AC Executive Sleeper',
        tradeOffDescription: `Spacious 2-tier AC with privacy curtains, wide berths, and priority service.`,
      },

      // 6. INTERCITY BHARATBENZ AC SLEEPER BUS
      {
        id: `opt-bus-sleeper-${Date.now()}-6`,
        mode: 'bus',
        provider: 'IntrCity SmartBus',
        operator: 'IntrCity',
        serviceNumber: `IC-${dInfo.code}-EXP`,
        origin: origin,
        originCode: `${oInfo.code}-BUS`,
        originTerminal: oInfo.busTerminal,
        destination: destination,
        destCode: `${dInfo.code}-BUS`,
        destTerminal: dInfo.busTerminal,
        departureTime: '09:30 PM (Night)',
        arrivalTime: '08:00 AM (Next Morning)',
        duration: '10h 30m (Overnight AC Sleeper)',
        price: baseBusSleeper * pCount,
        baseFare: 1250 * pCount,
        taxesAndFees: 120 * pCount,
        convenienceFee: 80,
        seatsAvailable: 12,
        baggage: {
          cabin: '5 kg Hand Bag',
          checkIn: '20 kg Luggage Compartment',
        },
        cancellation: {
          refundable: true,
          refundSummary: 'Full refund 12h prior; 50% refund within 12h',
          feeBefore24h: 200,
          feeWithin24h: 700,
          penaltyClause: 'Cancellations allowed till 4h before departure.',
        },
        convenienceScore: 79,
        isRecommended: false,
        recommendationTag: 'BharatBenz AC Sleeper Bus',
        tradeOffDescription: `Single/Double sleeper berths to ${dInfo.busTerminal} with charging ports and blanket.`,
      },

      // 7. VOLVO SEMI-SLEEPER BUS
      {
        id: `opt-bus-semi-${Date.now()}-7`,
        mode: 'bus',
        provider: 'Zingbus Electric',
        operator: 'Zingbus',
        serviceNumber: `ZB-${dInfo.code}-VOLVO`,
        origin: origin,
        originCode: `${oInfo.code}-BUS`,
        originTerminal: oInfo.busTerminal,
        destination: destination,
        destCode: `${dInfo.code}-BUS`,
        destTerminal: dInfo.busTerminal,
        departureTime: '10:15 PM (Night)',
        arrivalTime: '08:45 AM (Next Morning)',
        duration: '10h 30m (Volvo Multi-Axle)',
        price: baseBusSemi * pCount,
        baseFare: 860 * pCount,
        taxesAndFees: 70 * pCount,
        convenienceFee: 50,
        seatsAvailable: 16,
        baggage: {
          cabin: '5 kg Cabin Bag',
          checkIn: '15 kg Luggage Compartment',
        },
        cancellation: {
          refundable: true,
          refundSummary: 'Full refund 24h prior, ₹300 fee within 24h',
          feeBefore24h: 100,
          feeWithin24h: 300,
          penaltyClause: 'Direct UPI refund within 2 hours.',
        },
        convenienceScore: 74,
        isRecommended: false,
        recommendationTag: 'Volvo Semi-Sleeper Bus',
        tradeOffDescription: `Reclining plush seats with live GPS tracking and female-safe travel guarantee.`,
      },

      // 8. DESTINATION HOTEL
      {
        id: `opt-hotel-${Date.now()}-8`,
        mode: 'hotel',
        provider: `The Grand ${destination} Heritage Hotel`,
        operator: 'Taj / Radisson Partner',
        serviceNumber: 'DELUXE-KING-ROOM',
        origin: `${destination} Center`,
        originCode: dInfo.code,
        originTerminal: `${destination} City Center`,
        destination: destination,
        destCode: dInfo.code,
        destTerminal: `Near ${dInfo.railwayName}`,
        departureTime: 'Check-in: 01:00 PM',
        arrivalTime: 'Check-out: 11:00 AM',
        duration: '1 Night Stay',
        price: baseHotel,
        baseFare: 2800,
        taxesAndFees: 400,
        convenienceFee: 0,
        seatsAvailable: 5,
        baggage: {
          cabin: 'Luggage Storage Included',
          checkIn: 'Concierge Luggage Assistance',
        },
        cancellation: {
          refundable: true,
          refundSummary: 'Free cancellation up to 24h before check-in',
          feeBefore24h: 0,
          feeWithin24h: 1000,
          penaltyClause: 'Full refund on hotel bookings before 24 hours.',
        },
        convenienceScore: 88,
        isRecommended: false,
        recommendationTag: `Top Rated Hotel in ${destination}`,
        tradeOffDescription: `4.6★ Rating. Located 15 mins from ${dInfo.railwayCode} station. Free breakfast & WiFi.`,
      },
    ];

    return options;
  }

  public async searchTransportOptions(
    origin: string,
    destination: string,
    date: string,
    budget?: number | null,
    mode?: string | null,
    passengersCount: number = 1
  ): Promise<{ options: TravelOption[]; searchLatencyMs: number }> {
    const start = performance.now();
    await new Promise((r) => setTimeout(r, 280));

    // Generate dynamic options tailored to the exact route
    const generated = this.generateOptionsForRoute(origin, destination, date, passengersCount);
    this.currentOptions = generated;

    let sourcePool = [...generated];

    // Filter by mode if specified and not 'all'
    if (mode && mode !== 'all') {
      const modeLower = mode.toLowerCase();
      sourcePool = sourcePool.filter((opt) => opt.mode.toLowerCase() === modeLower);
    }

    // Filter by budget only if explicitly provided
    let filtered = sourcePool;
    if (budget && budget > 0) {
      filtered = sourcePool.filter((opt) => opt.price <= budget + 1000);
    }

    // Sort by convenience score
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
    const found = this.currentOptions.find((o) => o.id === optionId) || this.currentOptions[0];
    if (!found) return null;
    return {
      option: found,
      baggage: found.baggage,
      cancellation: found.cancellation,
    };
  }

  public async lockFareAndHoldPNR(
    optionId: string,
    passenger: PassengerDetails = DEFAULT_PASSENGER,
    passengers: number = 1,
    travelDateISO: string | null = null
  ): Promise<BookingHold> {
    await new Promise((r) => setTimeout(r, 320));
    const option = this.currentOptions.find((o) => o.id === optionId) || this.currentOptions[0];

    const orderId = `ORD-VOY-${Math.floor(100000 + Math.random() * 900000)}`;
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const pnrPrefix = option.mode === 'flight' ? '6E' : option.mode === 'train' ? 'IRCTC' : 'BUS';
    const pnr = `${pnrPrefix}-${Math.floor(1000 + Math.random() * 9000)}-${randomSuffix}`;
    const holdExpiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes hold

    const hold: BookingHold = {
      orderId,
      pnr,
      selectedOption: option,
      passenger,
      holdExpiresAt,
      fareGuaranteed: true,
      amount: option.price,
      passengers,
      travelDateISO,
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
    this.currentOptions = this.generateOptionsForRoute('Bengaluru', 'Jodhpur', 'Next Friday', 1);
    this.activeHolds.clear();
  }

  public getHold(orderId: string): BookingHold | undefined {
    return this.activeHolds.get(orderId);
  }

  /** Sandbox inventory check used by reconciliation: is the seat still sellable after the hold lapsed? */
  public isInventoryAvailable(optionId: string): boolean {
    const opt = this.currentOptions.find((o) => o.id === optionId);
    return Boolean(opt && opt.seatsAvailable > 0);
  }

  public markSoldOut(optionId: string) {
    const opt = this.currentOptions.find((o) => o.id === optionId);
    if (opt) opt.seatsAvailable = 0;
  }

  public confirmHold(orderId: string): BookingHold | null {
    const hold = this.activeHolds.get(orderId);
    if (!hold) return null;
    hold.status = 'paid';
    return hold;
  }
}

export const travelEngine = new TravelEngineService();
