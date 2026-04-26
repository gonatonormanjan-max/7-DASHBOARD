import { createLocationAction } from "@/lib/actions/locations";
import { requirePermission } from "@/lib/dal/auth";
import { PageHeader } from "@/components/ui/page-header";
import { LocationForm } from "@/components/locations/location-form";

export default async function NewLocationPage() {
  await requirePermission("locations", "create");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Infrastructure"
        title="Create location"
        description="Add a warehouse or branch so inventory, user assignment, and sales activity can be tied to a real operating site."
      />

      <LocationForm action={createLocationAction} mode="create" />
    </div>
  );
}
