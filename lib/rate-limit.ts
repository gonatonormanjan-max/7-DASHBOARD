import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type RateLimitInput = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

class RateLimitConflictError extends Error {
  constructor() {
    super("Rate limit bucket update conflicted with another request.");
    this.name = "RateLimitConflictError";
  }
}

async function withSerializableRetry<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      const isSerializationRetry =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
      const isUniqueConflict =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      const isBucketConflict = error instanceof RateLimitConflictError;

      if (
        (!isSerializationRetry && !isUniqueConflict && !isBucketConflict) ||
        attempt === 2
      ) {
        throw error;
      }
    }
  }

  throw new Error("Could not consume the rate limit after multiple retries.");
}

export async function consumeRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + input.windowMs);

  return withSerializableRetry(async (tx) => {
    await tx.loginRateLimitBucket.deleteMany({
      where: {
        resetAt: {
          lte: now,
        },
      },
    });

    const bucket = await tx.loginRateLimitBucket.findUnique({
      where: {
        key: input.key,
      },
      select: {
        count: true,
        resetAt: true,
      },
    });

    if (!bucket) {
      await tx.loginRateLimitBucket.create({
        data: {
          key: input.key,
          count: 1,
          resetAt,
        },
      });

      return {
        allowed: true,
        retryAfterSeconds: 0,
      };
    }

    if (bucket.resetAt <= now) {
      await tx.loginRateLimitBucket.update({
        where: {
          key: input.key,
        },
        data: {
          count: 1,
          resetAt,
        },
      });

      return {
        allowed: true,
        retryAfterSeconds: 0,
      };
    }

    if (bucket.count >= input.limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt.getTime() - now.getTime()) / 1000)),
      };
    }

    const updateResult = await tx.loginRateLimitBucket.updateMany({
      where: {
        key: input.key,
        count: bucket.count,
        resetAt: bucket.resetAt,
      },
      data: {
        count: bucket.count + 1,
      },
    });

    if (updateResult.count === 0) {
      throw new RateLimitConflictError();
    }

    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  });
}
