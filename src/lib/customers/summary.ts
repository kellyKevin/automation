// Pure per-customer aggregation (Part 11). The API route fetches a customer's
// orders and hands the rows here, keeping the maths easy to test.

export interface CustomerOrderRow {
  total: number;
  paymentStatus: string; // PENDING | PAID | FAILED | REFUNDED
  status: string; // OrderStatus
  createdAt: string | Date;
}

export interface CustomerStats {
  orders: number; // non-cancelled orders placed
  paidOrders: number;
  totalSpent: number; // collected (paymentStatus = PAID)
  outstanding: number; // unpaid, non-cancelled value
  lastOrderAt: string | null;
}

const time = (d: string | Date): number => new Date(d).getTime();

export function customerStats(rows: CustomerOrderRow[]): CustomerStats {
  const s: CustomerStats = {
    orders: 0,
    paidOrders: 0,
    totalSpent: 0,
    outstanding: 0,
    lastOrderAt: null,
  };
  let latest = -Infinity;
  for (const r of rows) {
    if (r.status === "CANCELLED") continue;
    s.orders += 1;
    if (r.paymentStatus === "PAID") {
      s.paidOrders += 1;
      s.totalSpent += r.total;
    } else {
      s.outstanding += r.total;
    }
    const t = time(r.createdAt);
    if (t > latest) {
      latest = t;
      s.lastOrderAt = new Date(r.createdAt).toISOString();
    }
  }
  return s;
}
