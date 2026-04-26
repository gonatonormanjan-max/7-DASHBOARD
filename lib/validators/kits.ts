import { z } from "zod";

const optionalNotes = z
  .string()
  .trim()
  .max(500, "Notes must be 500 characters or fewer.")
  .optional()
  .transform((value) => value || null);

export const kitComponentInputSchema = z.object({
  componentProductId: z.string().uuid("Select a valid component product."),
  componentQty: z.coerce.number().int().min(1, "Component quantity must be at least 1."),
});

export const setKitComponentsSchema = z.object({
  kitProductId: z.string().uuid("Select a valid kit product."),
  components: z.array(kitComponentInputSchema),
});

export const dismantleKitSchema = z.object({
  kitProductId: z.string().uuid("Select a valid kit product."),
  locationId: z.string().uuid("Select a valid location."),
  qty: z.coerce.number().int().min(1, "Quantity must be at least 1."),
  notes: optionalNotes,
});

export type SetKitComponentsData = z.output<typeof setKitComponentsSchema>;
export type DismantleKitData = z.output<typeof dismantleKitSchema>;

export function parseKitComponentsPayload(formData: FormData) {
  const rawPayload = String(formData.get("componentsPayload") ?? "[]");

  try {
    const parsed = JSON.parse(rawPayload);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
