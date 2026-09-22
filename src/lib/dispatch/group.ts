// Pure grouping for the printable rider / dispatch lists (Part 11). The API
// route fetches the orders being fulfilled; this arranges them into the runs a
// rider or the dispatch desk actually works from, and tallies what to pack.

export interface DispatchItem {
  productName: string;
  quantity: number;
  unit: string;
}

export interface DispatchOrder {
  id: string;
  number: string;
  status: string;
  paymentStatus: string;
  total: number;
  origin: string; // JUJA_HUB | ELDORET_NURSERY
  method: string | null; // LOCAL_RIDER | COURIER | BUS | PICKUP
  zoneName: string | null;
  county: string | null;
  town: string | null;
  address: string | null;
  landmark: string | null;
  receiverName: string | null;
  receiverPhone: string | null;
  assignedTo: string | null;
  trackingNumber: string | null;
  items: DispatchItem[];
}

export interface DispatchGroup {
  key: string;
  label: string;
  orders: DispatchOrder[];
}

export interface GroupedDispatch {
  /** Same-day produce runs (local rider), grouped by delivery zone. */
  rider: DispatchGroup[];
  /** Seedlings / countrywide, grouped by method and region. */
  courier: DispatchGroup[];
}

export function methodLabel(method: string | null | undefined): string {
  switch (method) {
    case "LOCAL_RIDER":
      return "Local rider";
    case "COURIER":
      return "Courier";
    case "BUS":
      return "Bus / courier office";
    case "PICKUP":
      return "Nursery pickup";
    default:
      return "Delivery";
  }
}

function pushInto(map: Map<string, DispatchGroup>, key: string, label: string, order: DispatchOrder) {
  const g = map.get(key) ?? { key, label, orders: [] };
  g.orders.push(order);
  map.set(key, g);
}

const sortGroups = (groups: DispatchGroup[]): DispatchGroup[] =>
  groups
    .map((g) => ({ ...g, orders: [...g.orders].sort((a, b) => a.number.localeCompare(b.number)) }))
    .sort((a, b) => a.label.localeCompare(b.label));

export function groupDispatch(orders: DispatchOrder[]): GroupedDispatch {
  const rider = new Map<string, DispatchGroup>();
  const courier = new Map<string, DispatchGroup>();

  for (const o of orders) {
    if (o.method === "LOCAL_RIDER") {
      const zone = o.zoneName ?? "Unassigned area";
      pushInto(rider, `zone:${zone}`, zone, o);
    } else {
      const region = o.county ?? o.town ?? "—";
      pushInto(courier, `${o.method}:${region}`, `${methodLabel(o.method)} — ${region}`, o);
    }
  }

  return { rider: sortGroups([...rider.values()]), courier: sortGroups([...courier.values()]) };
}

/** Aggregate the items across a set of orders, so a packer sees the totals to
 * pull for the whole run (e.g. "Tomatoes — 42 kg"). */
export function packTotals(orders: DispatchOrder[]): DispatchItem[] {
  const byKey = new Map<string, DispatchItem>();
  for (const o of orders) {
    for (const it of o.items) {
      const key = `${it.productName}|${it.unit}`;
      const cur = byKey.get(key) ?? { productName: it.productName, unit: it.unit, quantity: 0 };
      cur.quantity += it.quantity;
      byKey.set(key, cur);
    }
  }
  return [...byKey.values()].sort((a, b) => a.productName.localeCompare(b.productName));
}
