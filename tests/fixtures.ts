import type { Catalog } from "@/lib/bot/types";

export const catalog: Catalog = {
  products: [
    { slug: "tomatoes", name: "Tomatoes", category: "produce", unit: "kg", price: 120, available: true, stock: 200, origin: "JUJA_HUB" },
    { slug: "eggs", name: "Eggs", category: "produce", unit: "tray", price: 420, available: true, stock: 60, origin: "JUJA_HUB" },
    { slug: "kale-sukuma", name: "Kale (Sukuma Wiki)", category: "produce", unit: "bunch", price: 30, available: false, stock: 0, origin: "JUJA_HUB" },
    { slug: "tomato-seedling", name: "Tomato Seedling", category: "seedling", unit: "seedling", price: 8, available: true, stock: 5000, origin: "ELDORET_NURSERY" },
  ],
  zones: [
    { id: "z-juja", name: "Juja Town", type: "LOCAL", fee: 100, minimumOrder: 300, cutoffTime: "14:00" },
    { id: "z-thika", name: "Thika Town", type: "LOCAL", fee: 150, minimumOrder: 300, cutoffTime: "14:00" },
    { id: "z-cw", name: "Countrywide", type: "COUNTRYWIDE", fee: 400, minimumOrder: 0, cutoffTime: null },
  ],
};

// Morning time, before any cutoff, so "Today" is always offered in tests.
export const morning = new Date("2026-01-05T08:00:00");
