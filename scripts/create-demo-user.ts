/**
 * One-time script to create a SALES_STAFF demo account.
 * Run with: npx tsx scripts/create-demo-user.ts
 */

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = "staff@demo.com";
  const password = "Staff@1234";

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log(`User ${email} already exists — skipping.`);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      firstName: "Demo",
      lastName: "Staff",
      email,
      hashedPassword,
      role: "SALES_STAFF",
      isActive: true,
    },
  });

  console.log("✅ Demo SALES_STAFF account created:");
  console.log(`   Email   : ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   Role    : ${user.role}`);
  console.log(`   ID      : ${user.id}`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
