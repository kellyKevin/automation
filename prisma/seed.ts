import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const products = [
  // Fresh produce (Juja/Thika hub)
  { slug: "tomatoes", name: "Tomatoes", category: "produce", unit: "kg", price: 120, stock: 200, origin: "JUJA_HUB" },
  { slug: "kale-sukuma", name: "Kale (Sukuma Wiki)", category: "produce", unit: "bunch", price: 30, stock: 300, origin: "JUJA_HUB" },
  { slug: "spinach", name: "Spinach", category: "produce", unit: "bunch", price: 40, stock: 150, origin: "JUJA_HUB" },
  { slug: "onions", name: "Red Onions", category: "produce", unit: "kg", price: 90, stock: 180, origin: "JUJA_HUB" },
  { slug: "eggs", name: "Eggs", category: "produce", unit: "tray", price: 420, stock: 60, origin: "JUJA_HUB" },
  { slug: "potatoes", name: "Potatoes", category: "produce", unit: "kg", price: 80, stock: 400, origin: "JUJA_HUB" },
  { slug: "avocado", name: "Avocado (Hass)", category: "produce", unit: "piece", price: 25, stock: 500, origin: "JUJA_HUB" },
  // Seedlings (Eldoret/Kapseret nursery)
  { slug: "tomato-seedling", name: "Tomato Seedling", category: "seedling", variety: "Rio Grande", unit: "seedling", price: 8, stock: 5000, origin: "ELDORET_NURSERY" },
  { slug: "cabbage-seedling", name: "Cabbage Seedling", category: "seedling", variety: "Gloria F1", unit: "seedling", price: 6, stock: 5000, origin: "ELDORET_NURSERY" },
  { slug: "kale-seedling", name: "Kale Seedling", category: "seedling", variety: "Thousand Headed", unit: "seedling", price: 5, stock: 8000, origin: "ELDORET_NURSERY" },
  { slug: "capsicum-seedling", name: "Capsicum Seedling", category: "seedling", variety: "California Wonder", unit: "seedling", price: 10, stock: 3000, origin: "ELDORET_NURSERY" },
  { slug: "hass-avocado-seedling", name: "Hass Avocado Seedling", category: "seedling", variety: "Grafted Hass", unit: "seedling", price: 250, stock: 800, origin: "ELDORET_NURSERY" },
];

const zones = [
  { name: "Juja Town", type: "LOCAL", fee: 100, minimumOrder: 300, cutoffTime: "14:00", daysAvailable: "Mon,Tue,Wed,Thu,Fri,Sat" },
  { name: "Thika Town", type: "LOCAL", fee: 150, minimumOrder: 300, cutoffTime: "14:00", daysAvailable: "Mon,Tue,Wed,Thu,Fri,Sat" },
  { name: "Ruiru", type: "LOCAL", fee: 200, minimumOrder: 500, cutoffTime: "13:00", daysAvailable: "Mon,Wed,Fri" },
  { name: "Kalimoni", type: "LOCAL", fee: 120, minimumOrder: 300, cutoffTime: "14:00", daysAvailable: "Mon,Tue,Wed,Thu,Fri,Sat" },
  { name: "Countrywide (courier)", type: "COUNTRYWIDE", fee: 400, minimumOrder: 0, cutoffTime: null, daysAvailable: "Mon,Tue,Wed,Thu,Fri" },
];

async function main() {
  for (const p of products) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      create: { ...p, available: true },
      update: { ...p, available: true },
    });
  }
  for (const z of zones) {
    await prisma.deliveryZone.upsert({
      where: { name: z.name },
      create: { ...z, active: true },
      update: { ...z, active: true },
    });
  }

  await prisma.counter.upsert({
    where: { name: "order" },
    create: { name: "order", value: 0 },
    update: {},
  });

  await prisma.staffUser.upsert({
    where: { phone: "254700000000" },
    create: { name: "Farm City Owner", role: "owner", phone: "254700000000" },
    update: {},
  });

  console.log(`Seeded ${products.length} products and ${zones.length} zones.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
