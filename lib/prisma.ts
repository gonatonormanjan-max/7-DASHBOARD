import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Define DATABASE_URL before starting the application."
  );
}

const adapter = new PrismaPg(databaseUrl);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    transactionOptions: {
      maxWait: 10000, // 10s — allows for Vercel cold-start connection to Neon
      timeout: 15000, // 15s — generous timeout for the transaction itself
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
