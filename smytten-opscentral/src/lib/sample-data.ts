import { DeliveryStatus } from "@/generated/prisma/enums";

// Synthetic Delhivery-like data for local demos. Deterministic via a seeded
// RNG so re-seeding produces a stable dataset. Zone/state RTO + TAT biases are
// tuned to make the dashboards (worst pincodes, by-state, trends) interesting.

export interface SampleRecord {
  awb: string;
  orderDate: Date;
  pickupDate: Date | null;
  deliveryDate: Date | null;
  status: DeliveryStatus;
  rawStatus: string;
  isRTO: boolean;
  ndrAttempts: number;
  pincode: string;
  state: string;
  zone: string;
  weight: number;
  codAmount: number | null;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Region {
  state: string;
  zone: string;
  pincodes: string[];
  rtoBias: number; // multiplier on base RTO rate
  tatBase: number; // baseline TAT days
}

const REGIONS: Region[] = [
  { state: "Maharashtra", zone: "Zone A (Metro)", pincodes: ["400001", "400051", "411001", "440001"], rtoBias: 0.9, tatBase: 2 },
  { state: "Karnataka", zone: "Zone A (Metro)", pincodes: ["560001", "560037", "580001"], rtoBias: 0.8, tatBase: 2 },
  { state: "Delhi", zone: "Zone A (Metro)", pincodes: ["110001", "110024", "110085"], rtoBias: 1.0, tatBase: 2 },
  { state: "Tamil Nadu", zone: "Zone B (Regional)", pincodes: ["600001", "600040", "641001"], rtoBias: 0.95, tatBase: 3 },
  { state: "Telangana", zone: "Zone B (Regional)", pincodes: ["500001", "500081"], rtoBias: 0.9, tatBase: 3 },
  { state: "Gujarat", zone: "Zone B (Regional)", pincodes: ["380001", "395003", "360001"], rtoBias: 1.05, tatBase: 3 },
  { state: "West Bengal", zone: "Zone C (Rest of India)", pincodes: ["700001", "700091", "711101"], rtoBias: 1.35, tatBase: 4 },
  { state: "Uttar Pradesh", zone: "Zone C (Rest of India)", pincodes: ["201301", "226001", "208001"], rtoBias: 1.6, tatBase: 4 },
  { state: "Rajasthan", zone: "Zone C (Rest of India)", pincodes: ["302001", "313001"], rtoBias: 1.25, tatBase: 5 },
  { state: "Bihar", zone: "Zone E (Remote/Hilly)", pincodes: ["800001", "823001"], rtoBias: 1.9, tatBase: 6 },
  { state: "Assam", zone: "Zone E (Remote/Hilly)", pincodes: ["781001", "786001"], rtoBias: 1.7, tatBase: 7 },
  { state: "Jammu & Kashmir", zone: "Zone E (Remote/Hilly)", pincodes: ["180001", "190001"], rtoBias: 1.6, tatBase: 7 },
];

const BASE_RTO = 0.085;
const RTO_RAW = ["RTO", "RTO Delivered", "Returned to Origin"];

export function generateSampleRecords(opts?: {
  count?: number;
  endDate?: Date;
  seed?: number;
  windowDays?: number;
}): SampleRecord[] {
  const count = opts?.count ?? 3200;
  const endDate = opts?.endDate ?? new Date();
  const windowDays = opts?.windowDays ?? 40;
  const rand = mulberry32(opts?.seed ?? 20260617);

  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const records: SampleRecord[] = [];

  for (let i = 0; i < count; i++) {
    const region = pick(REGIONS);
    const pincode = pick(region.pincodes);

    const daysAgo = Math.floor(rand() * windowDays);
    const orderDate = new Date(endDate);
    orderDate.setDate(orderDate.getDate() - daysAgo);
    orderDate.setHours(9 + Math.floor(rand() * 8), Math.floor(rand() * 60), 0, 0);

    // Pickup 0–2 days after order.
    const pickupOffset = rand() < 0.7 ? 1 : rand() < 0.5 ? 0 : 2;
    const pickupDate = new Date(orderDate);
    pickupDate.setDate(pickupDate.getDate() + pickupOffset);

    const isCod = rand() < 0.45;
    const codAmount = isCod ? Math.round((300 + rand() * 2700) / 10) * 10 : null;
    const weight = Math.round((0.2 + rand() * 2.8) * 100) / 100;

    // Very recent shipments may still be in flight.
    const inFlight = daysAgo < 3 && rand() < 0.6;

    let status: DeliveryStatus;
    let rawStatus: string;
    let isRTO = false;
    let ndrAttempts = 0;
    let deliveryDate: Date | null = null;

    if (inFlight) {
      if (rand() < 0.5) {
        status = DeliveryStatus.IN_TRANSIT;
        rawStatus = "In Transit";
      } else {
        status = DeliveryStatus.OUT_FOR_DELIVERY;
        rawStatus = "Out for Delivery";
      }
    } else {
      const effRto = Math.min(0.5, BASE_RTO * region.rtoBias);
      const roll = rand();
      if (roll < effRto) {
        // RTO — usually after 2–3 failed attempts
        status = DeliveryStatus.RTO;
        rawStatus = pick(RTO_RAW);
        isRTO = true;
        ndrAttempts = 1 + Math.floor(rand() * 3);
        deliveryDate = new Date(pickupDate);
        deliveryDate.setDate(deliveryDate.getDate() + region.tatBase + 2 + Math.floor(rand() * 4));
      } else if (roll < effRto + 0.02) {
        status = DeliveryStatus.LOST;
        rawStatus = "Lost";
        ndrAttempts = Math.floor(rand() * 2);
      } else {
        // Delivered, possibly after NDR attempts
        status = DeliveryStatus.DELIVERED;
        rawStatus = "Delivered";
        const ndrRoll = rand();
        ndrAttempts = ndrRoll < 0.62 ? 0 : ndrRoll < 0.88 ? 1 : ndrRoll < 0.97 ? 2 : 3;
        const tat = region.tatBase + ndrAttempts + Math.floor(rand() * 3) - 1;
        deliveryDate = new Date(pickupDate);
        deliveryDate.setDate(deliveryDate.getDate() + Math.max(1, tat));
      }
    }

    const awb = `DL${(1_000_000_000_00 + Math.floor(rand() * 8_999_999_999_99)).toString()}`;

    records.push({
      awb,
      orderDate,
      pickupDate,
      deliveryDate,
      status,
      rawStatus,
      isRTO,
      ndrAttempts,
      pincode,
      state: region.state,
      zone: region.zone,
      weight,
      codAmount,
    });
  }

  return records;
}

// Delhivery-style CSV (day-first dates) — used for the downloadable sample and
// as an end-to-end exercise of the parser/mapper.
const CSV_HEADERS = [
  "Waybill",
  "Order Date",
  "Pickup Date",
  "Delivery Date",
  "Status",
  "RTO",
  "NDR Attempts",
  "Destination Pincode",
  "Destination State",
  "Zone",
  "Weight (Kg)",
  "COD Amount",
];

function fmtDate(d: Date | null): string {
  if (!d) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

export function sampleRecordsToCsv(records: SampleRecord[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const r of records) {
    lines.push(
      [
        r.awb,
        fmtDate(r.orderDate),
        fmtDate(r.pickupDate),
        fmtDate(r.deliveryDate),
        r.rawStatus,
        r.isRTO ? "Yes" : "No",
        r.ndrAttempts,
        r.pincode,
        r.state,
        r.zone,
        r.weight,
        r.codAmount ?? "",
      ].join(",")
    );
  }
  return lines.join("\n");
}
