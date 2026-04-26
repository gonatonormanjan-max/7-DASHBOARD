import { notFound } from "next/navigation";
import { updateLocationAction } from "@/lib/actions/locations";
import { requirePermission } from "@/lib/dal/auth";
import { getLocationById } from "@/lib/dal/locations";
import { PageHeader } from "@/components/ui/page-header";
import { LocationForm } from "@/components/locations/location-form";

type EditLocationPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditLocationPage({ params }: EditLocationPageProps) {
  await requirePermission("locations", "update");
  const { id } = await params;
  const location = await getLocationById(id);

  if (!location) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Infrastructure"
        title={`Edit ${location.name}`}
        description="Update the operating details for this location. Location type stays locked once the site has been created."
      />

      <LocationForm
        action={updateLocationAction}
        location={{
          id: location.id,
          name: location.name,
          code: location.code,
          type: location.type,
          address: location.address,
          managerName: location.managerName,
          contactNumber: location.contactNumber,
        }}
        mode="edit"
      />
    </div>
  );
}
