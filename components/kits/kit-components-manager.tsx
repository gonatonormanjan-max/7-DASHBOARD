"use client";

import { useMemo, useState } from "react";
import { setKitComponentsAction } from "@/lib/actions/kits";
import { SubmitButton } from "@/components/ui/submit-button";

type ComponentOption = {
  id: string;
  name: string;
  sku: string;
};

type ExistingComponent = {
  id: string;
  componentQty: number;
  componentProduct: {
    id: string;
    name: string;
    sku: string;
  };
};

type KitComponentsManagerProps = {
  kitProductId: string;
  existingComponents: ExistingComponent[];
  componentOptions: ComponentOption[];
};

type DraftComponent = {
  componentProductId: string;
  componentName: string;
  sku: string;
  componentQty: number;
};

export function KitComponentsManager({
  kitProductId,
  existingComponents,
  componentOptions,
}: KitComponentsManagerProps) {
  const [components, setComponents] = useState<DraftComponent[]>(
    existingComponents.map((component) => ({
      componentProductId: component.componentProduct.id,
      componentName: component.componentProduct.name,
      sku: component.componentProduct.sku,
      componentQty: component.componentQty,
    }))
  );
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedQty, setSelectedQty] = useState("1");

  const optionById = useMemo(
    () => new Map(componentOptions.map((option) => [option.id, option])),
    [componentOptions]
  );
  const availableOptions = componentOptions.filter(
    (option) => !components.some((component) => component.componentProductId === option.id)
  );

  function addComponent() {
    const option = optionById.get(selectedProductId);
    const componentQty = Number.parseInt(selectedQty, 10);

    if (!option || !Number.isFinite(componentQty) || componentQty < 1) {
      return;
    }

    setComponents((current) => [
      ...current,
      {
        componentProductId: option.id,
        componentName: option.name,
        sku: option.sku,
        componentQty,
      },
    ]);
    setSelectedProductId("");
    setSelectedQty("1");
  }

  return (
    <form
      action={setKitComponentsAction}
      className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm"
    >
      <input name="kitProductId" type="hidden" value={kitProductId} />
      <input
        name="componentsPayload"
        type="hidden"
        value={JSON.stringify(
          components.map((component) => ({
            componentProductId: component.componentProductId,
            componentQty: component.componentQty,
          }))
        )}
      />

      <div>
        <h2 className="text-lg font-semibold text-slate-950">Component list</h2>
        <p className="mt-1 text-sm text-slate-500">
          Add the component products and per-kit quantities that should be recovered when this
          product is dismantled.
        </p>
      </div>

      <div className="grid gap-4 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-4 md:grid-cols-[1fr_160px_auto]">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Component product</span>
          <select
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring/30"
            onChange={(event) => setSelectedProductId(event.target.value)}
            value={selectedProductId}
          >
            <option value="">Select a product</option>
            {availableOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name} ({option.sku})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Qty per kit</span>
          <input
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring/30"
            min={1}
            onChange={(event) => setSelectedQty(event.target.value)}
            type="number"
            value={selectedQty}
          />
        </label>

        <div className="flex items-end">
          <button
            className="inline-flex h-10 items-center justify-center rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!selectedProductId || availableOptions.length === 0}
            onClick={addComponent}
            type="button"
          >
            Add component
          </button>
        </div>
      </div>

      {components.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/80 px-6 py-10 text-center">
          <h3 className="text-base font-semibold text-slate-900">No components configured</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Add at least one component to treat this product as a dismantle-ready kit.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/70">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                <th className="px-4 py-3">Component</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Qty per kit</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
              {components.map((component) => (
                <tr key={component.componentProductId}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {component.componentName}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{component.sku}</td>
                  <td className="px-4 py-3">
                    <input
                      className="w-24 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring/30"
                      min={1}
                      onChange={(event) => {
                        const nextQty = Number.parseInt(event.target.value, 10);

                        setComponents((current) =>
                          current.map((item) =>
                            item.componentProductId === component.componentProductId
                              ? {
                                  ...item,
                                  componentQty:
                                    Number.isFinite(nextQty) && nextQty > 0 ? nextQty : 1,
                                }
                              : item
                          )
                        );
                      }}
                      type="number"
                      value={component.componentQty}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="text-sm font-medium text-red-600 transition hover:text-red-700"
                      onClick={() =>
                        setComponents((current) =>
                          current.filter(
                            (item) =>
                              item.componentProductId !== component.componentProductId
                          )
                        )
                      }
                      type="button"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving components...">Save kit components</SubmitButton>
      </div>
    </form>
  );
}
