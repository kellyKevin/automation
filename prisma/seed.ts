// The dashboard shares ONE database with the site (FARM-CITY). The product
// catalogue and delivery zones are owned by the site's seed (which reads the
// storefront's mockData), so this seed only creates the operational rows the
// dashboard needs — and never a competing catalogue.

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

async function main() {
  // The sequential order-number counter.
  await prisma.counter.upsert({
    where: { name: "order" },
    create: { name: "order", value: 0 },
    update: {},
  });

  // A first staff/owner user with a dashboard login. Set STAFF_DEFAULT_PASSWORD
  // in the env (defaults to "farmcity" for local dev — change before launch).
  const ownerPassword = hashPassword(process.env.STAFF_DEFAULT_PASSWORD || "farmcity");
  await prisma.staffUser.upsert({
    where: { phone: "254711911690" },
    create: { name: "Farm City Owner", role: "owner", phone: "254711911690", passwordHash: ownerPassword },
    update: { passwordHash: ownerPassword },
  });

  console.log(
    "Seeded operational rows (order counter, owner user). The product catalogue " +
      "and delivery zones are seeded from the site repo (FARM-CITY).",
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
