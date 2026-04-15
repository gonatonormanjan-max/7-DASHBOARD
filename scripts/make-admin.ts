/**
 * Script to make a user an ADMIN
 * Usage: npx tsx scripts/make-admin.ts user@email.com
 */

import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

async function main() {
  const email = process.argv[2];
  
  if (!email) {
    console.error("❌ Usage: npx tsx scripts/make-admin.ts user@email.com");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.error(`❌ User ${email} not found`);
    process.exit(1);
  }

  console.log(`Found user: ${user.firstName} ${user.lastName}`);
  console.log(`Current role: ${user.role}`);
  console.log(`Active: ${user.isActive}`);

  const updated = await prisma.user.update({
    where: { email },
    data: {
      role: "ADMIN" as Role,
      isActive: true,
    },
  });

  console.log("✅ User role updated to ADMIN");
  console.log(`New role: ${updated.role}`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
