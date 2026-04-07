"use client";

import Link from "next/link";
import { useActionState, useState, useRef, useEffect, useCallback } from "react";
import {
  initialSalesOrderFormState,
  type SalesOrderFormState,
} from "@/lib/validators/sales-orders";
import { formatCurrency } from "@/lib/products";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  unitPrice: string;
};

type WarehouseOption = {
  id: string;
  name: string;
  code: string;
};

type StockRow = {
  warehouseId: string;
  productId: string;
  availableQty: number;
};

type SaleLineItem = {
  productId: string;
  warehouseId: string;
  quantity: string;
  unitPrice: string;
};

type SalesOrderFormProps = {
  action: (
    state: SalesOrderFormState,
    formData: FormData
  ) => Promise<SalesOrderFormState>;
  products: ProductOption[];
  warehouses: WarehouseOption[];
  stockRows: StockRow[];
  prefill?: {
    customerName?: string;
    customerEmail?: string;
    notes?: string;
    items?: Array<{
      productId: string;
      warehouseId: string;
      quantity: number;
      unitPrice: string;
    }>;
  };
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function createEmptyItem(defaultWarehouseId: string): SaleLineItem {
  return {
    productId: "",
    warehouseId: defaultWarehouseId,
    quantity: "1",
    unitPrice: "",
  };
}

function parseItemsFromState(
  payload: string | undefined,
  defaultWarehouseId: string
): SaleLineItem[] {
  if (!payload) return [createEmptyItem(defaultWarehouseId)];

  try {
    const parsed = JSON.parse(payload);
    if (!Array.isArray(parsed) || parsed.length === 0)
      return [createEmptyItem(defaultWarehouseId)];

    return parsed.map((item: Record<string, unknown>) => ({
      productId: typeof item.productId === "string" ? item.productId : "",
      warehouseId:
        typeof item.warehouseId === "string"
          ? item.warehouseId
          : defaultWarehouseId,
      quantity:
        typeof item.quantity === "number" || typeof item.quantity === "string"
          ? String(item.quantity)
          : "1",
      unitPrice:
        typeof item.unitPrice === "number" || typeof item.unitPrice === "string"
          ? String(item.unitPrice)
          : "",
    }));
  } catch {
    return [createEmptyItem(defaultWarehouseId)];
  }
}

function fieldValue(
  state: SalesOrderFormState,
  key: string,
  fallback: string | null | undefined
) {
  return state.values?.[key] ?? fallback ?? "";
}

function lineTotal(quantity: string, unitPrice: string): number {
  const qty = Number(quantity) || 0;
  const price = Number(unitPrice) || 0;
  return qty * price;
}

/* ------------------------------------------------------------------ */
/*  Product Combobox                                                   */
/* ------------------------------------------------------------------ */

function ProductCombobox({
  products,
  selectedProductId,
  onSelect,
  disabled,
}: {
  products: ProductOption[];
  selectedProductId: string;
  onSelect: (product: ProductOption | null) => void;
  disabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const filtered = query.trim()
    ? products.filter((p) => {
        const q = query.trim().toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)
        );
      })
    : products;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectProduct = useCallback(
    (product: ProductOption) => {
      onSelect(product);
      setQuery("");
      setOpen(false);
      setHighlightIndex(-1);
    },
    [onSelect]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightIndex >= 0 && filtered[highlightIndex]) {
          selectProduct(filtered[highlightIndex]);
        }
        break;
      case "Escape":
        setOpen(false);
        setHighlightIndex(-1);
        break;
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  return (
    <div ref={wrapperRef} className="relative">
      {selectedProduct && !open ? (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
          <div className="min-w-0 flex-1">
            <span className="font-medium text-slate-900">
              {selectedProduct.name}
            </span>
            <span className="ml-2 text-slate-400">
              {selectedProduct.sku}
            </span>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            onClick={() => {
              onSelect(null);
              setOpen(true);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            aria-label="Change product"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ) : (
        <input
          ref={inputRef}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-[var(--ring)]"
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlightIndex(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Type name or SKU..."
          type="text"
          value={query}
          autoComplete="off"
        />
      )}

      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {filtered.map((product, i) => (
            <li
              key={product.id}
              className={cn(
                "cursor-pointer px-3 py-2 text-sm transition",
                i === highlightIndex
                  ? "bg-primary/10 text-primary"
                  : "text-slate-700 hover:bg-slate-50"
              )}
              onMouseDown={() => selectProduct(product)}
              onMouseEnter={() => setHighlightIndex(i)}
            >
              <span className="font-medium">{product.name}</span>
              <span className="ml-2 text-xs text-slate-400">
                {product.sku}
              </span>
            </li>
          ))}
        </ul>
      )}

      {open && query.trim() && filtered.length === 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-500 shadow-lg">
          No products match &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Quantity Stepper                                                    */
/* ------------------------------------------------------------------ */

function QuantityStepper({
  value,
  onChange,
  max,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  max: number | null;
  disabled: boolean;
}) {
  const numVal = Number(value) || 0;

  return (
    <div className="flex items-center gap-0">
      <button
        type="button"
        disabled={disabled || numVal <= 1}
        className="rounded-l-xl border border-r-0 border-slate-200 bg-white px-2.5 py-2 text-sm font-bold text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
        onClick={() => onChange(String(Math.max(1, numVal - 1)))}
        aria-label="Decrease quantity"
      >
        &minus;
      </button>
      <input
        className="w-16 border border-slate-200 bg-white px-2 py-2 text-center text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[var(--ring)]"
        disabled={disabled}
        min={1}
        onChange={(e) => onChange(e.target.value)}
        type="number"
        value={value}
      />
      <button
        type="button"
        disabled={disabled || (max !== null && numVal >= max)}
        className="rounded-r-xl border border-l-0 border-slate-200 bg-white px-2.5 py-2 text-sm font-bold text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
        onClick={() => onChange(String(numVal + 1))}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Form                                                          */
/* ------------------------------------------------------------------ */

export function SalesOrderForm({
  action,
  products,
  warehouses,
  stockRows,
  prefill,
}: SalesOrderFormProps) {
  const [state, formAction] = useActionState(
    action,
    initialSalesOrderFormState
  );

  const defaultWh = warehouses.length === 1 ? warehouses[0].id : "";

  const [defaultWarehouseId, setDefaultWarehouseId] = useState(defaultWh);

  const [items, setItems] = useState<SaleLineItem[]>(() => {
    // If prefill items exist (duplicate flow), use those
    if (prefill?.items && prefill.items.length > 0) {
      return prefill.items.map((item) => ({
        productId: item.productId,
        warehouseId: item.warehouseId || defaultWh,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
      }));
    }
    return parseItemsFromState(state.values?.itemsPayload, defaultWh);
  });

  const [customerName, setCustomerName] = useState(
    prefill?.customerName || fieldValue(state, "customerName", "")
  );

  const isReady = products.length > 0 && warehouses.length > 0;

  /* -- Item operations -- */

  function updateItem(index: number, patch: Partial<SaleLineItem>) {
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  }

  function addItem() {
    setItems((current) => [
      ...current,
      createEmptyItem(defaultWarehouseId),
    ]);
  }

  function removeItem(index: number) {
    setItems((current) =>
      current.length === 1
        ? [createEmptyItem(defaultWarehouseId)]
        : current.filter((_, i) => i !== index)
    );
  }

  function applyDefaultWarehouse(warehouseId: string) {
    setDefaultWarehouseId(warehouseId);
    // Apply to all lines that still use the old default (or are empty)
    setItems((current) =>
      current.map((item) =>
        !item.warehouseId || item.warehouseId === defaultWarehouseId
          ? { ...item, warehouseId: warehouseId }
          : item
      )
    );
  }

  /* -- Stock lookup -- */

  function getAvailableQty(
    productId: string,
    warehouseId: string
  ): number | null {
    if (!productId || !warehouseId) return null;
    const row = stockRows.find(
      (r) => r.productId === productId && r.warehouseId === warehouseId
    );
    return row?.availableQty ?? 0;
  }

  /* -- Totals -- */

  const orderTotal = items.reduce(
    (sum, item) => sum + lineTotal(item.quantity, item.unitPrice),
    0
  );

  const itemCount = items.filter((item) => item.productId).length;

  /* -- Serialization -- */

  const serializedItems = JSON.stringify(
    items.map((item) => ({
      productId: item.productId,
      warehouseId: item.warehouseId,
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice || 0),
    }))
  );

  return (
    <form action={formAction} className="space-y-6">
      <input name="itemsPayload" type="hidden" value={serializedItems} />

      {state.message ? (
        <div className="rounded-2xl bg-[#fff4e4] px-4 py-3 text-sm text-[#8a5610]">
          {state.message}
        </div>
      ) : null}

      {/* ---- Customer & Warehouse header ---- */}
      <div className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr_1fr]">
          {/* Customer name with walk-in shortcut */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">
                Customer name
              </span>
              <button
                type="button"
                className="rounded-lg px-2 py-0.5 text-xs font-medium text-primary transition hover:bg-primary/10"
                onClick={() => setCustomerName("Walk-in Customer")}
              >
                Walk-in
              </button>
            </div>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
              name="customerName"
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer or account name"
              required
              type="text"
              value={customerName}
            />
            {state.fieldErrors?.customerName ? (
              <p className="text-sm text-destructive">
                {state.fieldErrors.customerName[0]}
              </p>
            ) : null}
          </div>

          {/* Customer email */}
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Customer email
            </span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
              defaultValue={
                prefill?.customerEmail ||
                fieldValue(state, "customerEmail", "")
              }
              name="customerEmail"
              placeholder="Optional"
              type="email"
            />
            {state.fieldErrors?.customerEmail ? (
              <p className="text-sm text-destructive">
                {state.fieldErrors.customerEmail[0]}
              </p>
            ) : null}
          </label>

          {/* Default warehouse */}
          <div className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Selling from
            </span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
              value={defaultWarehouseId}
              onChange={(e) => applyDefaultWarehouse(e.target.value)}
            >
              {warehouses.length > 1 && (
                <option value="">Select default warehouse</option>
              )}
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name} ({wh.code})
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400">
              Applies to all lines. Override per line if needed.
            </p>
          </div>
        </div>

        {/* Notes - collapsed by default */}
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-500 hover:text-slate-700">
            Add notes
          </summary>
          <textarea
            className="mt-2 min-h-20 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            defaultValue={
              prefill?.notes || fieldValue(state, "notes", "")
            }
            name="notes"
            placeholder="Optional order note, delivery note, or cashier comment."
          />
          {state.fieldErrors?.notes ? (
            <p className="text-sm text-destructive">
              {state.fieldErrors.notes[0]}
            </p>
          ) : null}
        </details>
      </div>

      {/* ---- Line Items ---- */}
      <div className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Sale items
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {itemCount} item{itemCount !== 1 ? "s" : ""} &middot;{" "}
              {formatCurrency(orderTotal.toFixed(2))}
            </p>
          </div>
          <Button
            disabled={!isReady}
            onClick={addItem}
            type="button"
            variant="outline"
            size="sm"
          >
            + Add line
          </Button>
        </div>

        {!isReady ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-4 text-sm leading-6 text-slate-500">
            At least one active product and one active warehouse are required
            before recording a sale.
          </div>
        ) : null}

        {state.fieldErrors?.itemsPayload ? (
          <p className="mt-4 text-sm text-destructive">
            {state.fieldErrors.itemsPayload[0]}
          </p>
        ) : null}

        {/* Column headers (desktop) */}
        {isReady && items.length > 0 && (
          <div className="mt-5 hidden grid-cols-[2fr_1fr_140px_120px_100px_36px] items-end gap-3 border-b border-slate-100 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400 xl:grid">
            <span>Product</span>
            <span>Warehouse</span>
            <span>Qty</span>
            <span>Unit price</span>
            <span className="text-right">Line total</span>
            <span />
          </div>
        )}

        <div className="mt-3 space-y-2">
          {items.map((item, index) => {
            const availableQty = getAvailableQty(
              item.productId,
              item.warehouseId
            );
            const qty = Number(item.quantity) || 0;
            const isOverStock =
              availableQty !== null && qty > availableQty;
            const total = lineTotal(item.quantity, item.unitPrice);

            return (
              <div
                key={`line-${index}`}
                className={cn(
                  "rounded-2xl border p-3 transition",
                  isOverStock
                    ? "border-red-300 bg-red-50/50"
                    : "border-slate-200 bg-slate-50/50"
                )}
              >
                {/* Desktop: single row */}
                <div className="hidden grid-cols-[2fr_1fr_140px_120px_100px_36px] items-start gap-3 xl:grid">
                  {/* Product combobox */}
                  <div>
                    <ProductCombobox
                      products={products}
                      selectedProductId={item.productId}
                      onSelect={(product) => {
                        updateItem(index, {
                          productId: product?.id ?? "",
                          unitPrice: product?.unitPrice ?? item.unitPrice,
                        });
                      }}
                      disabled={!isReady}
                    />
                  </div>

                  {/* Warehouse */}
                  <div>
                    <select
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-[var(--ring)]"
                      disabled={!isReady}
                      onChange={(e) =>
                        updateItem(index, { warehouseId: e.target.value })
                      }
                      value={item.warehouseId}
                    >
                      <option value="">Warehouse</option>
                      {warehouses.map((wh) => (
                        <option key={wh.id} value={wh.id}>
                          {wh.name} ({wh.code})
                        </option>
                      ))}
                    </select>
                    {availableQty !== null && (
                      <p
                        className={cn(
                          "mt-1 text-xs",
                          isOverStock
                            ? "font-medium text-red-600"
                            : "text-slate-400"
                        )}
                      >
                        {isOverStock
                          ? `Only ${availableQty} in stock!`
                          : `${availableQty} available`}
                      </p>
                    )}
                  </div>

                  {/* Quantity stepper */}
                  <QuantityStepper
                    value={item.quantity}
                    onChange={(val) =>
                      updateItem(index, { quantity: val })
                    }
                    max={availableQty}
                    disabled={!isReady}
                  />

                  {/* Unit price */}
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-[var(--ring)]"
                    disabled={!isReady}
                    min={0}
                    onChange={(e) =>
                      updateItem(index, { unitPrice: e.target.value })
                    }
                    step="0.01"
                    type="number"
                    value={item.unitPrice}
                  />

                  {/* Line total */}
                  <p className="py-2 text-right text-sm font-semibold text-slate-700">
                    {formatCurrency(total.toFixed(2))}
                  </p>

                  {/* Remove */}
                  <button
                    type="button"
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                    onClick={() => removeItem(index)}
                    aria-label={`Remove line ${index + 1}`}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>

                {/* Mobile: stacked layout */}
                <div className="space-y-3 xl:hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      Line {index + 1}
                    </span>
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-red-50 hover:text-red-500"
                      onClick={() => removeItem(index)}
                    >
                      Remove
                    </button>
                  </div>

                  <ProductCombobox
                    products={products}
                    selectedProductId={item.productId}
                    onSelect={(product) => {
                      updateItem(index, {
                        productId: product?.id ?? "",
                        unitPrice: product?.unitPrice ?? item.unitPrice,
                      });
                    }}
                    disabled={!isReady}
                  />

                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-[var(--ring)]"
                    disabled={!isReady}
                    onChange={(e) =>
                      updateItem(index, { warehouseId: e.target.value })
                    }
                    value={item.warehouseId}
                  >
                    <option value="">Select warehouse</option>
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.name} ({wh.code})
                      </option>
                    ))}
                  </select>

                  {availableQty !== null && (
                    <p
                      className={cn(
                        "text-xs",
                        isOverStock
                          ? "font-medium text-red-600"
                          : "text-slate-400"
                      )}
                    >
                      {isOverStock
                        ? `Only ${availableQty} in stock!`
                        : `${availableQty} available`}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-xs text-slate-500">Qty</span>
                      <QuantityStepper
                        value={item.quantity}
                        onChange={(val) =>
                          updateItem(index, { quantity: val })
                        }
                        max={availableQty}
                        disabled={!isReady}
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-slate-500">
                        Unit price
                      </span>
                      <input
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-[var(--ring)]"
                        disabled={!isReady}
                        min={0}
                        onChange={(e) =>
                          updateItem(index, { unitPrice: e.target.value })
                        }
                        step="0.01"
                        type="number"
                        value={item.unitPrice}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end border-t border-slate-100 pt-2">
                    <span className="text-sm font-semibold text-slate-700">
                      {formatCurrency(total.toFixed(2))}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick add another line (inline) */}
        {isReady && items.length > 0 && (
          <button
            type="button"
            className="mt-3 w-full rounded-2xl border border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-400 transition hover:border-slate-400 hover:text-slate-600"
            onClick={addItem}
          >
            + Add another item
          </button>
        )}
      </div>

      {/* ---- Order Total & Submit ---- */}
      <div className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Order total</p>
            <p className="text-2xl font-bold text-slate-950">
              {formatCurrency(orderTotal.toFixed(2))}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {itemCount} item{itemCount !== 1 ? "s" : ""} &middot;{" "}
              {items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)}{" "}
              units total
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link href="/dashboard/sales-orders">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <SubmitButton
              disabled={!isReady}
              pendingLabel="Recording..."
              variant="outline"
              name="intent"
              value="record_and_new"
            >
              Record &amp; start new
            </SubmitButton>
            <SubmitButton
              disabled={!isReady}
              pendingLabel="Recording sale..."
              name="intent"
              value="record"
            >
              Record sale
            </SubmitButton>
          </div>
        </div>
      </div>
    </form>
  );
}
