"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import {
  applyInboundMovingAverage,
  recordOutboundCostHistory,
  syncLocationCostSnapshot,
} from "@/lib/costing";
import { requirePermission } from "@/lib/dal/auth";
import { getBranchScope } from "@/lib/dal/scope";
import { withFlashMessage } from "@/lib/flash-toast";
import { getAvailableQuantity } from "@/lib/inventory";
import { calculateDismantleAllocations } from "@/lib/kits";
import { prisma } from "@/lib/prisma";
import {
  dismantleKitSchema,
  parseKitComponentsPayload,
  setKitComponentsSchema,
} from "@/lib/validators/kits";

function buildKitComponentsReturnPath(kitProductId: string) {
  return `/dashboard/products/${kitProductId}/kit-components`;
}

function buildDismantleReturnPath(locationId: string, kitProductId: string) {
  return `/dashboard/inventory/dismantle?locationId=${locationId}&kitProductId=${kitProductId}`;
}

export async function setKitComponentsAction(formData: FormData) {
  const user = await requirePermission("products", "update");

  if (user.role !== "ADMIN" && user.role !== "SYSTEM_MANAGER") {
    redirect("/dashboard");
  }

  const parsed = setKitComponentsSchema.safeParse({
    kitProductId: String(formData.get("kitProductId") ?? "").trim(),
    components: parseKitComponentsPayload(formData),
  });

  if (!parsed.success) {
    const kitProductId = String(formData.get("kitProductId") ?? "").trim();
    redirect(
      withFlashMessage(buildKitComponentsReturnPath(kitProductId), {
        error: parsed.error.issues[0]?.message ?? "Please fix the kit component details.",
      })
    );
  }

  const returnPath = buildKitComponentsReturnPath(parsed.data.kitProductId);
  const duplicateComponentIds = new Set<string>();
  const seenComponentIds = new Set<string>();

  for (const component of parsed.data.components) {
    if (component.componentProductId === parsed.data.kitProductId) {
      redirect(
        withFlashMessage(returnPath, {
          error: "A kit cannot include itself as a component.",
        })
      );
    }

    if (seenComponentIds.has(component.componentProductId)) {
      duplicateComponentIds.add(component.componentProductId);
    }

    seenComponentIds.add(component.componentProductId);
  }

  if (duplicateComponentIds.size > 0) {
    redirect(
      withFlashMessage(returnPath, {
        error: "Each component product can only be listed once per kit.",
      })
    );
  }

  const [kitProduct, componentProducts, kitIsUsedAsComponent] = await Promise.all([
    prisma.product.findFirst({
      where: {
        id: parsed.data.kitProductId,
        status: {
          in: ["ACTIVE", "INACTIVE"],
        },
      },
      select: {
        id: true,
        name: true,
        sku: true,
      },
    }),
    prisma.product.findMany({
      where: {
        id: {
          in: parsed.data.components.map((component) => component.componentProductId),
        },
        status: {
          in: ["ACTIVE", "INACTIVE"],
        },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        kitComponents: {
          select: {
            id: true,
          },
          take: 1,
        },
      },
    }),
    prisma.productKitComponent.findFirst({
      where: {
        componentProductId: parsed.data.kitProductId,
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (!kitProduct) {
    redirect(
      withFlashMessage(returnPath, {
        error: "Select a valid kit product.",
      })
    );
  }

  if (kitIsUsedAsComponent) {
    redirect(
      withFlashMessage(returnPath, {
        error: "This product is already used as a component and cannot become a kit.",
      })
    );
  }

  const componentById = new Map(componentProducts.map((product) => [product.id, product]));

  if (componentById.size !== parsed.data.components.length) {
    redirect(
      withFlashMessage(returnPath, {
        error: "One or more selected component products are no longer available.",
      })
    );
  }

  const invalidComponent = parsed.data.components.find((component) => {
    const product = componentById.get(component.componentProductId);
    return (product?.kitComponents.length ?? 0) > 0;
  });

  if (invalidComponent) {
    const product = componentById.get(invalidComponent.componentProductId);
    redirect(
      withFlashMessage(returnPath, {
        error: `${product?.name ?? "A selected product"} is already configured as a kit and cannot also be a component.`,
      })
    );
  }

  const auditPayload = parsed.data.components.map((component) => {
    const product = componentById.get(component.componentProductId);
    return {
      componentProductId: component.componentProductId,
      componentName: product?.name,
      sku: product?.sku,
      componentQty: component.componentQty,
    };
  });

  await prisma.$transaction(
    async (tx) => {
      await tx.productKitComponent.deleteMany({
        where: {
          kitProductId: parsed.data.kitProductId,
        },
      });

      for (const component of parsed.data.components) {
        await tx.productKitComponent.create({
          data: {
            kitProductId: parsed.data.kitProductId,
            componentProductId: component.componentProductId,
            componentQty: component.componentQty,
          },
        });
      }

      await logAudit(
        {
          userId: user.id,
          action: "kits.set_components",
          entity: "product_kit",
          entityId: parsed.data.kitProductId,
          details: {
            kitProductId: parsed.data.kitProductId,
            kitName: kitProduct.name,
            sku: kitProduct.sku,
            components: auditPayload,
          },
        },
        tx
      );
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  revalidatePath(returnPath);
  revalidatePath(`/dashboard/products/${parsed.data.kitProductId}`);

  redirect(
    withFlashMessage(returnPath, {
      success:
        parsed.data.components.length > 0
          ? `Kit components updated for ${kitProduct.name}.`
          : `${kitProduct.name} no longer has any kit components configured.`,
    })
  );
}

export async function dismantleKitAction(formData: FormData) {
  const user = await requirePermission("inventory", "read");

  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    redirect("/dashboard");
  }

  const parsed = dismantleKitSchema.safeParse({
    kitProductId: String(formData.get("kitProductId") ?? "").trim(),
    locationId: String(formData.get("locationId") ?? "").trim(),
    qty: String(formData.get("qty") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  });

  const fallbackReturnPath = "/dashboard/inventory/dismantle";

  if (!parsed.success) {
    redirect(
      withFlashMessage(fallbackReturnPath, {
        error: parsed.error.issues[0]?.message ?? "Please fix the dismantle details.",
      })
    );
  }

  const branchScope = getBranchScope(user);
  const returnPath = buildDismantleReturnPath(parsed.data.locationId, parsed.data.kitProductId);

  if (branchScope && parsed.data.locationId !== branchScope) {
    redirect(
      withFlashMessage(fallbackReturnPath, {
        error: "You can only dismantle kit stock at your assigned branch.",
      })
    );
  }

  const [location, kitProduct] = await Promise.all([
    prisma.stockLocation.findFirst({
      where: {
        id: parsed.data.locationId,
        isActive: true,
        type: "BRANCH",
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
    }),
    prisma.product.findFirst({
      where: {
        id: parsed.data.kitProductId,
        status: {
          in: ["ACTIVE", "INACTIVE"],
        },
        kitComponents: {
          some: {},
        },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        costPrice: true,
      },
    }),
  ]);

  if (!location) {
    redirect(
      withFlashMessage(fallbackReturnPath, {
        error: "Select a valid active branch for this dismantle.",
      })
    );
  }

  if (!kitProduct) {
    redirect(
      withFlashMessage(fallbackReturnPath, {
        error: "Select a valid kit product.",
      })
    );
  }

  const dismantleReferenceId = randomUUID();

  await prisma.$transaction(
    async (tx) => {
      const kitStockRows = await tx.$queryRaw<
        Array<{
          id: string;
          quantity: number;
          reservedQty: number;
        }>
      >(Prisma.sql`
        SELECT "id", "quantity", "reservedQty"
        FROM "LocationStock"
        WHERE "locationId" = ${location.id}
          AND "productId" = ${kitProduct.id}
        FOR UPDATE
      `);

      const kitStock = kitStockRows[0] ?? null;

      if (!kitStock) {
        throw new Error(`No stock record found for ${kitProduct.name} at ${location.name}.`);
      }

      const availableQty = getAvailableQuantity(kitStock.quantity, kitStock.reservedQty);
      if (availableQty < parsed.data.qty) {
        throw new Error(
          availableQty > 0
            ? `Only ${availableQty} kit unit${availableQty === 1 ? "" : "s"} are available to dismantle at ${location.name}.`
            : `No available kit stock can be dismantled at ${location.name}.`
        );
      }

      const components = await tx.productKitComponent.findMany({
        where: {
          kitProductId: kitProduct.id,
        },
        orderBy: [{ componentProduct: { name: "asc" } }],
        select: {
          componentProductId: true,
          componentQty: true,
          componentProduct: {
            select: {
              id: true,
              name: true,
              sku: true,
              costPrice: true,
            },
          },
        },
      });

      if (components.length === 0) {
        throw new Error("This product does not have kit components configured.");
      }

      const kitLocationCost = await tx.locationProductCost.findUnique({
        where: {
          locationId_productId: {
            locationId: location.id,
            productId: kitProduct.id,
          },
        },
        select: {
          avgUnitCost: true,
        },
      });

      const kitUnitCost = Number(
        (kitLocationCost?.avgUnitCost ?? kitProduct.costPrice).toString()
      );
      const allocations = calculateDismantleAllocations({
        kitAvgUnitCost: kitUnitCost,
        components: components.map((component) => ({
          componentProductId: component.componentProductId,
          componentQty: component.componentQty,
          componentCostPrice: Number(component.componentProduct.costPrice.toString()),
        })),
      });
      const allocationByProductId = new Map(
        allocations.map((allocation) => [allocation.componentProductId, allocation])
      );

      const nextKitQty = kitStock.quantity - parsed.data.qty;

      await tx.locationStock.update({
        where: {
          id: kitStock.id,
        },
        data: {
          quantity: nextKitQty,
        },
      });

      await syncLocationCostSnapshot(tx, {
        locationId: location.id,
        productId: kitProduct.id,
        onHandQtySnapshot: nextKitQty,
      });

      await recordOutboundCostHistory({
        tx,
        locationId: location.id,
        productId: kitProduct.id,
        outboundQty: parsed.data.qty,
        outboundUnitCost: kitUnitCost,
        performedById: user.id,
        sourceType: "inventory.dismantle",
        sourceId: dismantleReferenceId,
        reason: "Kit dismantle out",
      });

      await tx.inventoryMovement.create({
        data: {
          type: "DISMANTLE_OUT",
          productId: kitProduct.id,
          locationId: location.id,
          quantityChange: -parsed.data.qty,
          referenceType: "inventory.dismantle",
          referenceId: dismantleReferenceId,
          notes: [
            `Dismantled ${parsed.data.qty} kit unit${parsed.data.qty === 1 ? "" : "s"}.`,
            parsed.data.notes ? `Notes: ${parsed.data.notes}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
          performedById: user.id,
        },
      });

      for (const component of components) {
        const allocation = allocationByProductId.get(component.componentProductId);
        if (!allocation) {
          throw new Error(`Cost allocation failed for ${component.componentProduct.name}.`);
        }

        const inboundQty = component.componentQty * parsed.data.qty;
        const componentStockRows = await tx.$queryRaw<
          Array<{
            id: string;
            quantity: number;
            reservedQty: number;
          }>
        >(Prisma.sql`
          SELECT "id", "quantity", "reservedQty"
          FROM "LocationStock"
          WHERE "locationId" = ${location.id}
            AND "productId" = ${component.componentProductId}
          FOR UPDATE
        `);

        const existingComponentStock = componentStockRows[0] ?? null;
        const nextComponentQty = (existingComponentStock?.quantity ?? 0) + inboundQty;

        if (existingComponentStock) {
          await tx.locationStock.update({
            where: {
              id: existingComponentStock.id,
            },
            data: {
              quantity: nextComponentQty,
            },
          });
        } else {
          await tx.locationStock.create({
            data: {
              locationId: location.id,
              productId: component.componentProductId,
              quantity: inboundQty,
            },
          });
        }

        await applyInboundMovingAverage({
          tx,
          locationId: location.id,
          productId: component.componentProductId,
          onHandBefore: existingComponentStock?.quantity ?? 0,
          inboundQty,
          inboundUnitCost: allocation.inboundUnitCost,
          performedById: user.id,
          sourceType: "inventory.dismantle",
          sourceId: dismantleReferenceId,
          reason: `Kit dismantle in from ${kitProduct.name}`,
        });

        await tx.inventoryMovement.create({
          data: {
            type: "DISMANTLE_IN",
            productId: component.componentProductId,
            locationId: location.id,
            quantityChange: inboundQty,
            referenceType: "inventory.dismantle",
            referenceId: dismantleReferenceId,
            notes: [
              `Recovered from dismantling ${kitProduct.name}.`,
              `Allocated inbound unit cost: ${allocation.inboundUnitCost.toFixed(2)}.`,
              parsed.data.notes ? `Notes: ${parsed.data.notes}` : null,
            ]
              .filter(Boolean)
              .join("\n"),
            performedById: user.id,
          },
        });
      }

      const dismantleRecord = await tx.dismantleRecord.create({
        data: {
          id: dismantleReferenceId,
          locationId: location.id,
          kitProductId: kitProduct.id,
          qty: parsed.data.qty,
          notes: parsed.data.notes,
          dismantledById: user.id,
        },
        select: {
          id: true,
        },
      });

      await logAudit(
        {
          userId: user.id,
          action: "kits.dismantle",
          entity: "dismantle_record",
          entityId: dismantleRecord.id,
          details: {
            locationId: location.id,
            locationName: location.name,
            kitProductId: kitProduct.id,
            kitProductName: kitProduct.name,
            sku: kitProduct.sku,
            qty: parsed.data.qty,
            notes: parsed.data.notes,
            kitUnitCost,
            allocations: allocations.map((allocation) => {
              const component = components.find(
                (row) => row.componentProductId === allocation.componentProductId
              );

              return {
                componentProductId: allocation.componentProductId,
                componentName: component?.componentProduct.name,
                sku: component?.componentProduct.sku,
                componentQtyPerKit: allocation.componentQty,
                inboundUnitCost: Number(allocation.inboundUnitCost.toFixed(2)),
                totalAllocatedCostPerKit: Number(
                  allocation.totalAllocatedCostPerKit.toFixed(2)
                ),
              };
            }),
          },
        },
        tx
      );
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  ).catch((error) => {
    const message =
      error instanceof Error ? error.message : "Could not dismantle the selected kit.";
    redirect(
      withFlashMessage(returnPath, {
        error: message,
      })
    );
  });

  revalidatePath("/dashboard/inventory");
  revalidatePath(returnPath);
  revalidatePath(`/dashboard/products/${kitProduct.id}`);
  revalidatePath(`/dashboard/inventory/${location.id}`);

  redirect(
    withFlashMessage(returnPath, {
      success: `Dismantled ${parsed.data.qty} unit${parsed.data.qty === 1 ? "" : "s"} of ${kitProduct.name} at ${location.name}.`,
    })
  );
}
