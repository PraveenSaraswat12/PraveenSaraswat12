// Deterministic sample dataset — two related CSVs (orders ↔ customers)
// so a first-time visitor sees the whole product working in one click.
import { mulberry32 } from '../engine/util';

const REGIONS = ['North', 'South', 'East', 'West'];
const CATEGORIES = ['Electronics', 'Apparel', 'Home', 'Beauty'];
const STATUS = ['Paid', 'Paid', 'Paid', 'Pending', 'Overdue'];
const CITIES = ['Mumbai', 'Delhi', 'Bengaluru', 'Pune', 'Chennai', 'Hyderabad', 'Jaipur', 'Kochi'];
const SEGMENTS = ['Enterprise', 'SMB', 'Consumer'];
const NAMES = [
  'Apex Traders', 'Bluewave Retail', 'Crystal Mart', 'Deccan Supplies', 'Everest Goods',
  'Falcon Distributors', 'Galaxy Stores', 'Horizon Traders', 'Indus Retail', 'Juno Commerce',
  'Kanak Enterprises', 'Lotus Bazaar', 'Meru Markets', 'Nova Trading', 'Orchid Retail',
  'Pinnacle Goods', 'Quartz Traders', 'Riverline Stores', 'Sunrise Mart', 'Trident Supplies',
];

function pad(n: number): string { return String(n).padStart(2, '0'); }

export function buildSampleCSVs(): { orders: string; customers: string } {
  const rnd = mulberry32(20260613);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];

  const customers: string[] = ['customer_id,customer_name,city,segment,signup_date'];
  for (let i = 0; i < 20; i++) {
    const id = `C${pad(i + 1)}`;
    const y = 2023 + Math.floor(rnd() * 2);
    customers.push(`${id},${NAMES[i]},${pick(CITIES)},${pick(SEGMENTS)},${y}-${pad(1 + Math.floor(rnd() * 12))}-${pad(1 + Math.floor(rnd() * 28))}`);
  }

  const orders: string[] = ['order_id,order_date,customer_id,region,category,units,unit_price,revenue,status,due_date'];
  // 10 months of history ending June 2026
  const months: [number, number][] = [];
  for (let m = 8; m <= 12; m++) months.push([2025, m]);
  for (let m = 1; m <= 6; m++) months.push([2026, m]);
  let oid = 1000;
  for (let mi = 0; mi < months.length; mi++) {
    const [y, m] = months[mi];
    const growth = 1 + mi * 0.06; // visible upward trend
    const count = 10 + Math.floor(rnd() * 5);
    for (let k = 0; k < count; k++) {
      oid += 1;
      const day = 1 + Math.floor(rnd() * 28);
      const units = 1 + Math.floor(rnd() * 50);
      const price = Math.round((200 + rnd() * 1800) * growth);
      const revenue = units * price;
      const status = pick(STATUS);
      const dueDay = 1 + Math.floor(rnd() * 28);
      const dueM = m + (rnd() > 0.5 ? 1 : 2);
      const dueY = y + (dueM > 12 ? 1 : 0);
      orders.push([
        `O${oid}`, `${y}-${pad(m)}-${pad(day)}`, `C${pad(1 + Math.floor(rnd() * 20))}`,
        pick(REGIONS), pick(CATEGORIES), units, price, revenue, status,
        `${dueY}-${pad(((dueM - 1) % 12) + 1)}-${pad(dueDay)}`,
      ].join(','));
    }
  }
  return { orders: orders.join('\n'), customers: customers.join('\n') };
}

export function loadSampleFiles(): File[] {
  const { orders, customers } = buildSampleCSVs();
  return [
    new File([orders], 'sample-orders.csv', { type: 'text/csv' }),
    new File([customers], 'sample-customers.csv', { type: 'text/csv' }),
  ];
}
