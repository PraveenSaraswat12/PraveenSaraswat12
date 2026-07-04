// Resilient mapping from a Delhivery MIS CSV header row to our canonical
// DeliveryRecord fields. Header names vary between Delhivery panel exports, so
// we normalise (lowercase + strip non-alphanumerics) and match against a list
// of known synonyms. Exact overrides take top priority — once you paste the
// real header row, drop the precise names into DELHIVERY_HEADER_OVERRIDES.

export type CanonicalField =
  | "awb"
  | "orderDate"
  | "pickupDate"
  | "deliveryDate"
  | "status"
  | "rtoFlag"
  | "ndrAttempts"
  | "pincode"
  | "state"
  | "zone"
  | "weight"
  | "codAmount";

export const CANONICAL_FIELDS: CanonicalField[] = [
  "awb",
  "orderDate",
  "pickupDate",
  "deliveryDate",
  "status",
  "rtoFlag",
  "ndrAttempts",
  "pincode",
  "state",
  "zone",
  "weight",
  "codAmount",
];

// Only AWB is strictly required to store a row; the rest degrade gracefully.
export const REQUIRED_FIELDS: CanonicalField[] = ["awb"];

export const FIELD_LABELS: Record<CanonicalField, string> = {
  awb: "AWB / Waybill",
  orderDate: "Order date",
  pickupDate: "Pickup date",
  deliveryDate: "Delivery date",
  status: "Delivery status",
  rtoFlag: "RTO flag",
  ndrAttempts: "NDR attempts",
  pincode: "Destination pincode",
  state: "Destination state",
  zone: "Courier zone",
  weight: "Weight",
  codAmount: "COD amount",
};

export function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Exact, highest-priority overrides keyed by normalised header.
// >>> Fill these in from the real Delhivery export header row. <<<
export const DELHIVERY_HEADER_OVERRIDES: Record<string, CanonicalField> = {
  // e.g. "waybill": "awb",
};

// Candidate header synonyms (already normalised) per field. Ordered loosely by
// how specific/likely each is. These cover common Delhivery MIS variants.
export const FIELD_SYNONYMS: Record<CanonicalField, string[]> = {
  awb: [
    "awb",
    "awbnumber",
    "awbno",
    "waybill",
    "waybillnumber",
    "waybillno",
    "trackingid",
    "trackingno",
    "trackingnumber",
    "shipmentid",
  ],
  orderDate: [
    "orderdate",
    "ordercreateddate",
    "ordercreationdate",
    "orderdatetime",
    "orderplaceddate",
    "bookingdate",
    "manifestdate",
    "manifestcreationdate",
  ],
  pickupDate: [
    "pickupdate",
    "pickeddate",
    "pickupdatetime",
    "pickeduptime",
    "firstattemptdate",
    "shippeddate",
    "dispatchdate",
    "manifesteddate",
    "outscandate",
  ],
  deliveryDate: [
    "deliverydate",
    "delivereddate",
    "deliverydatetime",
    "deliveredon",
    "deliveredtime",
    "rtodelivereddate",
    "lastupdatedate",
    "edd",
  ],
  status: [
    "status",
    "deliverystatus",
    "shipmentstatus",
    "currentstatus",
    "orderstatus",
    "laststatus",
    "lateststatus",
  ],
  rtoFlag: ["rto", "rtoflag", "isrto", "returntoorigin", "rtostatus", "returnflag"],
  ndrAttempts: [
    "ndr",
    "ndrattempts",
    "ndrcount",
    "noofattempts",
    "numberofattempts",
    "attempts",
    "deliveryattempts",
    "totalattempts",
    "attemptcount",
  ],
  pincode: [
    "pincode",
    "pin",
    "destinationpincode",
    "deliverypincode",
    "consigneepincode",
    "droppincode",
    "topincode",
    "destpincode",
  ],
  state: [
    "state",
    "destinationstate",
    "deliverystate",
    "consigneestate",
    "dropstate",
    "deststate",
    "statename",
  ],
  zone: ["zone", "courierzone", "deliveryzone", "zonecategory", "zonename", "zonetype"],
  weight: [
    "weight",
    "chargedweight",
    "chargeableweight",
    "billedweight",
    "appliedweight",
    "deadweight",
    "weightkg",
    "weightingrams",
  ],
  codAmount: [
    "codamount",
    "cod",
    "codvalue",
    "collectableamount",
    "amounttocollect",
    "codcharges",
    "codprice",
    "codtocollect",
  ],
};

export interface ColumnMap {
  // canonical field -> actual header string from the file (or undefined)
  fields: Partial<Record<CanonicalField, string>>;
  matched: { field: CanonicalField; header: string }[];
  unmatchedHeaders: string[];
  missingRequired: CanonicalField[];
}

/**
 * Build a column map from the file's header row. Matching priority:
 *   1. explicit override (exact normalised header)
 *   2. exact synonym equality
 *   3. fuzzy: header contains a synonym, or a synonym contains the header
 * Each source header is consumed by at most one field.
 */
export function buildColumnMap(headers: string[]): ColumnMap {
  const cols = headers.map((raw) => ({ raw, norm: normalizeHeader(raw) }));
  const usedHeaders = new Set<string>();
  const fields: Partial<Record<CanonicalField, string>> = {};
  const matched: { field: CanonicalField; header: string }[] = [];

  const claim = (field: CanonicalField, rawHeader: string) => {
    fields[field] = rawHeader;
    matched.push({ field, header: rawHeader });
    usedHeaders.add(rawHeader);
  };

  // Pass 1: explicit overrides
  for (const c of cols) {
    const override = DELHIVERY_HEADER_OVERRIDES[c.norm];
    if (override && !fields[override] && !usedHeaders.has(c.raw)) {
      claim(override, c.raw);
    }
  }

  // Pass 2: exact synonym equality
  for (const field of CANONICAL_FIELDS) {
    if (fields[field]) continue;
    const syns = FIELD_SYNONYMS[field];
    const hit = cols.find((c) => !usedHeaders.has(c.raw) && syns.includes(c.norm));
    if (hit) claim(field, hit.raw);
  }

  // Pass 3: fuzzy containment
  for (const field of CANONICAL_FIELDS) {
    if (fields[field]) continue;
    const syns = FIELD_SYNONYMS[field];
    const hit = cols.find(
      (c) =>
        !usedHeaders.has(c.raw) &&
        syns.some((s) => c.norm.includes(s) || s.includes(c.norm))
    );
    if (hit) claim(field, hit.raw);
  }

  const unmatchedHeaders = cols
    .filter((c) => !usedHeaders.has(c.raw))
    .map((c) => c.raw);
  const missingRequired = REQUIRED_FIELDS.filter((f) => !fields[f]);

  return { fields, matched, unmatchedHeaders, missingRequired };
}
