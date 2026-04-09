import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditClient = Prisma.TransactionClient | typeof prisma;

type AuditPayload = {
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  details?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
};

export async function logAudit({
  userId,
  action,
  entity,
  entityId,
  details,
}: AuditPayload, client: AuditClient = prisma) {
  return client.auditLog.create({
    data: {
      userId,
      action,
      entity,
      entityId,
      details: details ?? undefined,
    },
  });
}
