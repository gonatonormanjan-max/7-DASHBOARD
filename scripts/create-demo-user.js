const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const adapter = new PrismaPg(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = "staff@demo.com";
  const password = "Staff@1234";

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log("User already exists — skipping.");
    console.log("  Email   :", email);
    console.log("  Password:", password);
    console.log("  Role    : SALES_STAFF");
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

  console.log("Created:", user.email, "|", user.role);
}

main()
  .catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
