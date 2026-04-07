"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal/auth";
import { withFlashMessage } from "@/lib/flash-toast";
import { clearMockData, seedMockData } from "@/lib/mock-data";

function revalidateMockDataPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/categories");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/inventory");
}

export async function seedMockDataAction(formData: FormData) {
  void formData;
  const user = await requireRole(["ADMIN"]);
  const seeded = await seedMockData(user.id);

  revalidateMockDataPaths();
  redirect(
    withFlashMessage("/dashboard", {
      success: `Mock data loaded: ${seeded.products} products, ${seeded.stockRows} stock rows, and ${seeded.movements} movements.`,
    })
  );
}

export async function clearMockDataAction(formData: FormData) {
  void formData;
  const user = await requireRole(["ADMIN"]);
  const cleared = await clearMockData(user.id);
  const retainedSummary =
    cleared.retainedProducts > 0 || cleared.retainedLocations > 0
      ? ` ${cleared.retainedProducts} product${cleared.retainedProducts === 1 ? "" : "s"} and ${cleared.retainedLocations} location${cleared.retainedLocations === 1 ? "" : "s"} were kept because they are linked to recorded transactions.`
      : "";

  revalidateMockDataPaths();
  redirect(
    withFlashMessage("/dashboard", {
      success: `Mock data removed where safe: ${cleared.products} products, ${cleared.stockRows} stock rows, and ${cleared.movements} movements.${retainedSummary}`,
    })
  );
}
