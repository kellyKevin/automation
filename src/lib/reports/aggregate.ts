// Pure report aggregation (Part 11). The API route does the database queries
// and hands the raw rows here, so the number-crunching stays easy to test.

export interface OrderRow {
  total: number;
  paymentStatus: string; // PENDING | PAID | FAILED | REFUNDED
  status: string; // OrderStatus
}

export interface SalesTotals {
  orders: number;
  revenue: number; // total value of all non-cancelled orders
  paidOrders: number;
  paidRevenue: number; // collected (paymentStatus = PAID)
  unpaidOrders: number;
  unpaidValue: number; // outstanding value still to collect
}

const isCancelled = (s: string): boolean => s === "CANCELLED";

export function salesTotals(rows: OrderRow[]): SalesTotals {
  const t: SalesTotals = {
    orders: 0,
    revenue: 0,
    paidOrders: 0,
    paidRevenue: 0,
    unpaidOrders: 0,
    unpaidValue: 0,
  };
  for (const r of rows) {
    if (isCancelled(r.status)) continue;
    t.orders += 1;
    t.revenue += r.total;
    if (r.paymentStatus === "PAID") {
      t.paidOrders += 1;
      t.paidRevenue += r.total;
    } else {
      t.unpaidOrders += 1;
      t.unpaidValue += r.total;
    }
  }
  return t;
}

export interface ItemRow {
  productName: string;
  quantity: number;
  lineTotal: number;
}

export interface ProductSales {
  productName: string;
  quantity: number;
  revenue: number;
  orderLines: number;
}

/** Top products by quantity sold (ties broken by revenue). */
export function topProducts(rows: ItemRow[], limit = 10): ProductSales[] {
  const byName = new Map<string, ProductSales>();
  for (const r of rows) {
    const cur =
      byName.get(r.productName) ??
      { productName: r.productName, quantity: 0, revenue: 0, orderLines: 0 };
    cur.quantity += r.quantity;
    cur.revenue += r.lineTotal;
    cur.orderLines += 1;
    byName.set(r.productName, cur);
  }
  return [...byName.values()]
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, limit);
}
