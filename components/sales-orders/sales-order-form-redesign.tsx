"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  WALK_IN_CUSTOMER_NAME,
  initialSalesOrderFormState,
  type SalesOrderFormState,
} from "@/lib/validators/sales-orders";
import { formatCurrency } from "@/lib/products";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  unitPrice: string;
};

type LocationOption = {
  id: string;
  name: string;
  code: string;
};

type StockRow = {
  locationId: string;
  productId: string;
  availableQty: number;
};

type CustomerMode = "named" | "walk_in";
type PaymentMode = "" | "CASH" | "ONLINE" | "MIXED";

type SaleLineItem = {
  localId: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  unitPrice: string;
  priceOverridden: boolean;
  warehouseOverridden: boolean;
};

type SalesOrderFormProps = {
  action: (
    state: SalesOrderFormState,
    formData: FormData
  ) => Promise<SalesOrderFormState>;
  products: ProductOption[];
  locations: LocationOption[];
  stockRows: StockRow[];
  lockedLocationId?: string;
  pricesLocked?: boolean;
  prefill?: {
    customerName?: string;
    customerEmail?: string;
    notes?: string;
    items?: Array<{
      productId: string;
      locationId: string;
      quantity: number;
      unitPrice: string;
    }>;
  };
  rememberedDefaults?: {
    locationId?: string;
    customerMode?: CustomerMode;
  };
};

function fieldValue(
  state: SalesOrderFormState,
  key: string,
  fallback: string | null | undefined
) {
  return state.values?.[key] ?? fallback ?? "";
}

function normalizeMoney(value: number | string | undefined, fallback = "0.00") {
  const numericValue =
    typeof value === "number" ? value : Number(value ?? Number.NaN);

  return Number.isFinite(numericValue) ? numericValue.toFixed(2) : fallback;
}

function lineTotal(quantity: number, unitPrice: string) {
  return quantity * (Number(unitPrice) || 0);
}

function readPayloadItems(
  payload: string | undefined,
  saleWarehouseId: string,
  products: ProductOption[]
) {
  if (!payload) return [];

  try {
    const parsed = JSON.parse(payload);

    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item: Record<string, unknown>, index) => {
        const productId = typeof item.productId === "string" ? item.productId : "";
        const product = products.find((entry) => entry.id === productId);
        const warehouseId =
          typeof item.locationId === "string" ? item.locationId : saleWarehouseId;
        const unitPrice = normalizeMoney(
          item.unitPrice as number | string | undefined,
          product?.unitPrice ?? "0.00"
        );

        return {
          localId: `payload-${index}-${productId || "missing"}`,
          productId,
          warehouseId,
          quantity: Math.max(1, Number(item.quantity) || 1),
          unitPrice,
          priceOverridden:
            typeof item.priceOverridden === "boolean"
              ? item.priceOverridden
              : unitPrice !== normalizeMoney(product?.unitPrice, unitPrice),
          warehouseOverridden:
            typeof item.warehouseOverridden === "boolean"
              ? item.warehouseOverridden
              : Boolean(saleWarehouseId && warehouseId !== saleWarehouseId),
        } satisfies SaleLineItem;
      })
      .filter((item) => item.productId);
  } catch {
    return [];
  }
}

function mergeCartItems(
  items: SaleLineItem[],
  saleWarehouseId: string,
  products: ProductOption[]
) {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const merged = new Map<string, SaleLineItem>();

  for (const item of items) {
    if (!item.productId) continue;

    const product = productMap.get(item.productId);
    const warehouseId = item.warehouseId || saleWarehouseId;
    const unitPrice = normalizeMoney(item.unitPrice, product?.unitPrice ?? "0.00");
    const key = `${item.productId}:${warehouseId}:${unitPrice}`;
    const existing = merged.get(key);

    if (existing) {
      existing.quantity += Math.max(1, Math.floor(Number(item.quantity) || 1));
      existing.priceOverridden =
        existing.priceOverridden ||
        unitPrice !== normalizeMoney(product?.unitPrice, unitPrice);
      existing.warehouseOverridden =
        existing.warehouseOverridden || Boolean(saleWarehouseId && warehouseId !== saleWarehouseId);
      continue;
    }

    merged.set(key, {
      ...item,
      warehouseId,
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
      unitPrice,
      priceOverridden:
        item.priceOverridden ||
        unitPrice !== normalizeMoney(product?.unitPrice, unitPrice),
      warehouseOverridden:
        item.warehouseOverridden || Boolean(saleWarehouseId && warehouseId !== saleWarehouseId),
    });
  }

  return [...merged.values()];
}

function resolveInitialWarehouseId({
  locations,
  prefill,
  rememberedDefaults,
  state,
}: {
  locations: LocationOption[];
  prefill?: SalesOrderFormProps["prefill"];
  rememberedDefaults?: SalesOrderFormProps["rememberedDefaults"];
  state: SalesOrderFormState;
}) {
  const stateLocationId = fieldValue(state, "defaultLocationId", "");

  if (stateLocationId && locations.some((location) => location.id === stateLocationId)) {
    return stateLocationId;
  }

  if (
    rememberedDefaults?.locationId &&
    locations.some((location) => location.id === rememberedDefaults.locationId)
  ) {
    return rememberedDefaults.locationId;
  }

  const uniqueLocations = new Set(prefill?.items?.map((item) => item.locationId) ?? []);

  if (uniqueLocations.size === 1) {
    const [locationId] = uniqueLocations;

    if (locationId && locations.some((location) => location.id === locationId)) {
      return locationId;
    }
  }

  return locations.length === 1 ? locations[0].id : "";
}

function resolveInitialCustomerMode({
  prefill,
  rememberedDefaults,
  state,
}: {
  prefill?: SalesOrderFormProps["prefill"];
  rememberedDefaults?: SalesOrderFormProps["rememberedDefaults"];
  state: SalesOrderFormState;
}): CustomerMode {
  const stateMode = fieldValue(state, "customerMode", "");

  if (stateMode === "walk_in") return "walk_in";
  if (stateMode === "named") return "named";
  if (prefill?.customerName === WALK_IN_CUSTOMER_NAME) return "walk_in";

  return rememberedDefaults?.customerMode === "named" ? "named" : "walk_in";
}

function ProductSearchCombobox({
  products,
  onSelect,
  disabled,
  placeholder,
  inputRef,
}: {
  products: ProductOption[];
  onSelect: (product: ProductOption) => void;
  disabled: boolean;
  placeholder: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = query.trim()
    ? products.filter((product) => {
        const normalizedQuery = query.trim().toLowerCase();

        return (
          product.name.toLowerCase().includes(normalizedQuery) ||
          product.sku.toLowerCase().includes(normalizedQuery)
        );
      })
    : products;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const activeItem = listRef.current.children[highlightIndex] as HTMLElement | undefined;
      activeItem?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  function selectProduct(product: ProductOption) {
    onSelect(product);
    setQuery("");
    setOpen(false);
    setHighlightIndex(-1);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
      setOpen(true);
      event.preventDefault();
      return;
    }

    if (!open) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setHighlightIndex((current) => Math.min(current + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlightIndex((current) => Math.max(current - 1, 0));
        break;
      case "Enter":
        event.preventDefault();
        if (highlightIndex >= 0 && filtered[highlightIndex]) {
          selectProduct(filtered[highlightIndex]);
          return;
        }
        if (filtered.length === 1) {
          selectProduct(filtered[0]);
        }
        break;
      case "Escape":
        setOpen(false);
        setHighlightIndex(-1);
        break;
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-[var(--ring)]"
        disabled={disabled}
        onChange={(event) => {
          setQuery(event.target.value);
          setHighlightIndex(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        type="text"
        value={query}
      />

      {open && filtered.length > 0 ? (
        <ul
          ref={listRef}
          className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-lg"
        >
          {filtered.map((product, index) => (
            <li
              key={product.id}
              className={cn(
                "cursor-pointer rounded-xl px-3 py-2 text-sm transition",
                index === highlightIndex
                  ? "bg-primary/10 text-primary"
                  : "text-slate-700 hover:bg-slate-50"
              )}
              onMouseDown={() => selectProduct(product)}
              onMouseEnter={() => setHighlightIndex(index)}
            >
              <div className="font-medium">{product.name}</div>
              <div className="mt-0.5 text-xs text-slate-400">
                {product.sku}
                <span className="ml-2 font-medium text-slate-500">
                  {formatCurrency(product.unitPrice)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {open && query.trim() && filtered.length === 0 ? (
        <div className="absolute z-30 mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-lg">
          No products match &ldquo;{query}&rdquo;.
        </div>
      ) : null}
    </div>
  );
}

function QuantityStepper({
  value,
  onChange,
  max,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  max: number | null;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        className="px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
        disabled={disabled || value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        -
      </button>
      <input
        className="w-16 border-x border-slate-200 px-2 py-2 text-center text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[var(--ring)]"
        disabled={disabled}
        min={1}
        onChange={(event) => onChange(Math.max(1, Number(event.target.value) || 1))}
        type="number"
        value={value}
      />
      <button
        type="button"
        className="px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
        disabled={disabled || (max !== null && value >= max)}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}

export function SalesOrderFormRedesign({
  action,
  products,
  locations,
  stockRows,
  lockedLocationId,
  pricesLocked = false,
  prefill,
  rememberedDefaults,
}: SalesOrderFormProps) {
  const [state, formAction] = useActionState(action, initialSalesOrderFormState);
  const addItemInputRef = useRef<HTMLInputElement>(null);
  const [inReview, setInReview] = useState(false);

  const initialWarehouseId = lockedLocationId ?? resolveInitialWarehouseId({
    locations,
    prefill,
    rememberedDefaults,
    state,
  });
  const initialCustomerMode = resolveInitialCustomerMode({
    prefill,
    rememberedDefaults,
    state,
  });
  const [saleWarehouseId, setSaleWarehouseId] = useState(initialWarehouseId);
  const [customerMode, setCustomerMode] = useState<CustomerMode>(initialCustomerMode);
  const [customerName, setCustomerName] = useState(() => {
    if (prefill?.customerName) return prefill.customerName;
    if (initialCustomerMode === "walk_in") return WALK_IN_CUSTOMER_NAME;
    return fieldValue(state, "customerName", "");
  });
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(() => {
    const savedPaymentMode = fieldValue(state, "paymentMode", "");
    return savedPaymentMode === "ONLINE" || savedPaymentMode === "MIXED"
      ? savedPaymentMode
      : "CASH";
  });
  const [cashAmount, setCashAmount] = useState(() =>
    fieldValue(state, "cashAmount", "")
  );
  const [onlineAmount, setOnlineAmount] = useState(() =>
    fieldValue(state, "onlineAmount", "")
  );
  const initialCart =
    prefill?.items && prefill.items.length > 0
      ? mergeCartItems(
          prefill.items.map((item, index) => ({
            localId: `prefill-${index}-${item.productId}`,
            productId: item.productId,
            warehouseId: item.locationId || initialWarehouseId,
            quantity: Math.max(1, item.quantity),
            unitPrice: normalizeMoney(item.unitPrice),
            priceOverridden: false,
            warehouseOverridden: Boolean(
              initialWarehouseId && item.locationId && item.locationId !== initialWarehouseId
            ),
          })),
          initialWarehouseId,
          products
        )
      : mergeCartItems(
          readPayloadItems(state.values?.itemsPayload, initialWarehouseId, products),
          initialWarehouseId,
          products
        );
  const nextIdRef = useRef(initialCart.length + 1);
  const [cart, setCart] = useState<SaleLineItem[]>(initialCart);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const isReady = products.length > 0 && locations.length > 0;
  const stockMap = new Map(
    stockRows.map((row) => [`${row.productId}:${row.locationId}`, row.availableQty])
  );
  const productMap = new Map(products.map((product) => [product.id, product]));

  function focusAddItemInput() {
    window.setTimeout(() => addItemInputRef.current?.focus(), 0);
  }

  function setCartWithMerge(updater: (current: SaleLineItem[]) => SaleLineItem[]) {
    setCart((current) => mergeCartItems(updater(current), saleWarehouseId, products));
  }

  function toggleExpanded(localId: string) {
    setExpandedItems((current) => {
      const next = new Set(current);
      if (next.has(localId)) {
        next.delete(localId);
      } else {
        next.add(localId);
      }
      return next;
    });
  }

  function addProductToCart(product: ProductOption) {
    if (!saleWarehouseId) {
      focusAddItemInput();
      return;
    }

    setCartWithMerge((current) => [
      ...current,
      {
        localId: `cart-${nextIdRef.current++}`,
        productId: product.id,
        warehouseId: saleWarehouseId,
        quantity: 1,
        unitPrice: normalizeMoney(product.unitPrice),
        priceOverridden: false,
        warehouseOverridden: false,
      },
    ]);
  }

  function removeItem(localId: string) {
    setCart((current) => current.filter((item) => item.localId !== localId));
    focusAddItemInput();
  }

  function updateQuantity(localId: string, quantity: number) {
    setCart((current) =>
      current.map((item) =>
        item.localId === localId
          ? { ...item, quantity: Math.max(1, Math.floor(quantity || 1)) }
          : item
      )
    );
  }

  function togglePriceOverride(localId: string, enabled: boolean) {
    setCartWithMerge((current) =>
      current.map((item) => {
        if (item.localId !== localId) return item;

        const product = productMap.get(item.productId);

        return {
          ...item,
          unitPrice: enabled
            ? item.unitPrice
            : normalizeMoney(product?.unitPrice, item.unitPrice),
          priceOverridden: enabled,
        };
      })
    );
  }

  function updateUnitPrice(localId: string, unitPrice: string) {
    setCart((current) =>
      current.map((item) =>
        item.localId === localId
          ? {
              ...item,
              unitPrice: normalizeMoney(unitPrice, item.unitPrice),
              priceOverridden: true,
            }
          : item
      )
    );
  }

  function toggleWarehouseOverride(localId: string, enabled: boolean) {
    if (!saleWarehouseId && !enabled) return;

    setCartWithMerge((current) =>
      current.map((item) =>
        item.localId === localId
          ? {
              ...item,
              warehouseId: enabled ? item.warehouseId : saleWarehouseId,
              warehouseOverridden: enabled,
            }
          : item
      )
    );
  }

  function updateWarehouse(localId: string, warehouseId: string) {
    setCartWithMerge((current) =>
      current.map((item) =>
        item.localId === localId
          ? {
              ...item,
              warehouseId,
              warehouseOverridden: Boolean(saleWarehouseId && warehouseId !== saleWarehouseId),
            }
          : item
      )
    );
  }

  function updateSaleWarehouse(warehouseId: string) {
    setSaleWarehouseId(warehouseId);
    setCart((current) =>
      mergeCartItems(
        current.map((item) =>
          item.warehouseOverridden ? item : { ...item, warehouseId }
        ),
        warehouseId,
        products
      )
    );
  }

  function changeCustomerMode(nextMode: CustomerMode) {
    setCustomerMode(nextMode);

    if (nextMode === "walk_in") {
      setCustomerName(WALK_IN_CUSTOMER_NAME);
      return;
    }

    setCustomerName((current) =>
      current === WALK_IN_CUSTOMER_NAME ? "" : current
    );
  }

  const serializedItems = JSON.stringify(
    cart.map((item) => ({
      productId: item.productId,
      locationId: item.warehouseId,
      quantity: item.quantity,
      unitPrice: Number(normalizeMoney(item.unitPrice)),
      priceOverridden: item.priceOverridden,
      locationOverridden: item.warehouseOverridden,
    }))
  );

  const unitsTotal = cart.reduce((sum, item) => sum + item.quantity, 0);
  const orderTotal = cart.reduce(
    (sum, item) => sum + lineTotal(item.quantity, item.unitPrice),
    0
  );
  const overriddenLines = cart.filter(
    (item) => item.priceOverridden || item.warehouseOverridden
  ).length;
  const submittedCashAmount =
    paymentMode === "CASH"
      ? normalizeMoney(orderTotal)
      : paymentMode === "ONLINE"
        ? "0.00"
        : normalizeMoney(cashAmount, "");
  const submittedOnlineAmount =
    paymentMode === "ONLINE"
      ? normalizeMoney(orderTotal)
      : paymentMode === "CASH"
        ? "0.00"
        : normalizeMoney(onlineAmount, "");
  const mixedCashValue = Number(submittedCashAmount);
  const mixedOnlineValue = Number(submittedOnlineAmount);
  const mixedBalance =
    paymentMode === "MIXED" &&
    Number.isFinite(mixedCashValue) &&
    Number.isFinite(mixedOnlineValue)
      ? orderTotal - (mixedCashValue + mixedOnlineValue)
      : orderTotal;

  return (
    <form action={formAction} className="space-y-6">
      <input name="itemsPayload" type="hidden" value={serializedItems} />
      <input name="defaultLocationId" type="hidden" value={saleWarehouseId} />
      <input name="customerMode" type="hidden" value={customerMode} />
      <input name="paymentMode" type="hidden" value={paymentMode} />
      <input name="cashAmount" type="hidden" value={submittedCashAmount} />
      <input name="onlineAmount" type="hidden" value={submittedOnlineAmount} />

      {state.message ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {state.message}
        </div>
      ) : null}

      <section className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          Sale context
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition",
              customerMode === "walk_in"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            )}
            onClick={() => changeCustomerMode("walk_in")}
          >
            Walk-in sale
          </button>
          <button
            type="button"
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition",
              customerMode === "named"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            )}
            onClick={() => changeCustomerMode("named")}
          >
            Named customer
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-4">
          {lockedLocationId ? (
            <div className="space-y-2 lg:w-56">
              <span className="text-sm font-medium text-slate-700">Selling from</span>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700">
                <span className="text-xs text-slate-400">🔒</span>
                <span className="font-medium">
                  {locations.find((loc) => loc.id === lockedLocationId)?.name ?? "Assigned branch"}
                </span>
              </div>
              <p className="text-xs text-slate-400">Locked to your assigned branch.</p>
            </div>
          ) : (
            <label className="space-y-2 lg:w-56">
              <span className="text-sm font-medium text-slate-700">Selling from</span>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
                onChange={(event) => updateSaleWarehouse(event.target.value)}
                value={saleWarehouseId}
              >
                {locations.length > 1 ? <option value="">Select sale location</option> : null}
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} ({location.code})
                  </option>
                ))}
              </select>
            </label>
          )}

          {customerMode === "named" ? (
            <div className="space-y-2 lg:w-56">
              <span className="text-sm font-medium text-slate-700">Customer</span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
                name="customerName"
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Optional for drafts, or use walk-in sale"
                type="text"
                value={customerName}
              />
              {state.fieldErrors?.customerName ? (
                <p className="text-sm text-destructive">{state.fieldErrors.customerName[0]}</p>
              ) : null}
            </div>
          ) : null}
          {customerMode === "walk_in" ? (
            <input name="customerName" type="hidden" value={WALK_IN_CUSTOMER_NAME} />
          ) : null}

          {customerMode === "named" ? (
            <label className="space-y-2 lg:w-56">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
                defaultValue={prefill?.customerEmail || fieldValue(state, "customerEmail", "")}
                name="customerEmail"
                placeholder="Optional"
                type="email"
              />
              {state.fieldErrors?.customerEmail ? (
                <p className="text-sm text-destructive">{state.fieldErrors.customerEmail[0]}</p>
              ) : null}
            </label>
          ) : null}
        </div>

        <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            Add notes
          </summary>
          <textarea
            className="mt-3 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-[var(--ring)]"
            defaultValue={prefill?.notes || fieldValue(state, "notes", "")}
            name="notes"
            placeholder="Optional cashier note, delivery detail, or internal instruction."
          />
          {state.fieldErrors?.notes ? (
            <p className="mt-2 text-sm text-destructive">{state.fieldErrors.notes[0]}</p>
          ) : null}
        </details>
      </section>

      <section className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Customer cart
            </p>
            <div className="flex flex-wrap gap-2 text-sm text-slate-500">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
                {cart.length} line{cart.length === 1 ? "" : "s"}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
                {unitsTotal} unit{unitsTotal === 1 ? "" : "s"}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
                {formatCurrency(orderTotal)}
              </span>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
            <ProductSearchCombobox
              disabled={!isReady || !saleWarehouseId}
              inputRef={addItemInputRef}
              onSelect={addProductToCart}
              placeholder={
                saleWarehouseId
                  ? "Type product name or SKU to add to cart"
                  : "Select a sale warehouse before building the cart"
              }
              products={products}
            />

            {!isReady ? (
              <p className="mt-3 text-sm text-slate-500">
                At least one active product and one active warehouse are required before recording a sale.
              </p>
            ) : null}

            {isReady && !saleWarehouseId ? (
              <p className="mt-3 text-sm text-amber-700">
                Choose the sale warehouse first so new items inherit the right stock location.
              </p>
            ) : null}

            {state.fieldErrors?.itemsPayload ? (
              <p className="mt-3 text-sm text-destructive">{state.fieldErrors.itemsPayload[0]}</p>
            ) : null}
          </div>

          {cart.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/70 px-6 py-8 text-center">
              <p className="text-sm text-slate-500">Search or scan to add the first cart item.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((item, index) => {
                const product = productMap.get(item.productId);
                const stockKey = `${item.productId}:${item.warehouseId}`;
                const availableQty = stockMap.has(stockKey)
                  ? (stockMap.get(stockKey) ?? 0)
                  : item.warehouseId
                    ? 0
                    : null;
                const isOverStock = availableQty !== null && item.quantity > availableQty;
                const rowError = state.itemErrors?.[index];
                const lineAmount = lineTotal(item.quantity, item.unitPrice);
                const warehouseLabel =
                  locations.find((location) => location.id === item.warehouseId)?.name ??
                  "selected location";
                const isExpanded = expandedItems.has(item.localId);
                const hasOverrides = item.priceOverridden || item.warehouseOverridden;
                const rowAlert =
                  rowError ??
                  (isOverStock
                    ? availableQty === 0
                      ? `Out of stock in ${warehouseLabel}. Remove this item or switch branches.`
                      : `Only ${availableQty} unit${availableQty === 1 ? "" : "s"} available in ${warehouseLabel}.`
                    : null);

                return (
                  <article
                    key={item.localId}
                    className={cn(
                      "rounded-2xl border transition",
                      rowError || isOverStock
                        ? "border-red-300 bg-red-50/60"
                        : "border-slate-200 bg-white/90"
                    )}
                  >
                    {/* Compact row */}
                    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-slate-950">
                            {product?.name ?? "Unknown product"}
                          </h3>
                          {hasOverrides ? (
                            <span className="flex shrink-0 gap-1">
                              {item.priceOverridden ? (
                                <span className="size-2 rounded-full bg-violet-400" title="Price override" />
                              ) : null}
                              {item.warehouseOverridden ? (
                                <span className="size-2 rounded-full bg-sky-400" title="Warehouse override" />
                              ) : null}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {product?.sku ?? "Missing SKU"}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 sm:gap-4">
                        <QuantityStepper
                          disabled={!isReady}
                          max={availableQty}
                          onChange={(quantity) => updateQuantity(item.localId, quantity)}
                          value={item.quantity}
                        />
                        <span className={cn(
                          "text-xs whitespace-nowrap",
                          isOverStock ? "font-medium text-red-600" : "text-slate-400"
                        )}>
                          {availableQty !== null ? `(${availableQty} avail)` : ""}
                        </span>

                        <div className="w-20 text-right text-sm font-medium text-slate-700">
                          {formatCurrency(item.unitPrice)}
                        </div>

                        <div className="w-24 text-right text-sm font-semibold text-slate-950">
                          {formatCurrency(lineAmount)}
                        </div>

                        <button
                          type="button"
                          className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                          onClick={() => removeItem(item.localId)}
                          title="Remove item"
                        >
                          <span className="text-base leading-none">&times;</span>
                        </button>

                        <button
                          type="button"
                          className={cn(
                            "shrink-0 rounded-lg p-1.5 text-sm transition",
                            isExpanded
                              ? "bg-slate-100 text-slate-700"
                              : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          )}
                          onClick={() => toggleExpanded(item.localId)}
                          title={isExpanded ? "Collapse" : "More options"}
                        >
                          {isExpanded ? "▾" : "⋯"}
                        </button>
                      </div>
                    </div>
                    {rowAlert ? (
                      <div className="border-t border-red-200 bg-red-50/80 px-4 py-2.5">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs font-medium text-red-700">{rowAlert}</p>
                          <div className="flex flex-wrap gap-2">
                            {isOverStock && availableQty !== null && availableQty > 0 ? (
                              <Button
                                className="h-8 text-xs"
                                onClick={() => updateQuantity(item.localId, availableQty)}
                                type="button"
                                variant="outline"
                              >
                                Set to {availableQty}
                              </Button>
                            ) : null}
                            <Button
                              className="h-8 text-xs"
                              onClick={() => removeItem(item.localId)}
                              type="button"
                              variant="outline"
                            >
                              Remove item
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {/* Row error — always visible when present */}
                    {rowError && !isExpanded && !rowAlert ? (
                      <div className="border-t border-red-200 px-4 py-2">
                        <p className="text-xs font-medium text-red-700">{rowError}</p>
                      </div>
                    ) : null}

                    {/* Expanded section */}
                    {isExpanded ? (
                      <div className="border-t border-slate-100 px-4 py-3 space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {!pricesLocked ? (
                            <Button
                              onClick={() =>
                                togglePriceOverride(item.localId, !item.priceOverridden)
                              }
                              type="button"
                              variant="outline"
                              className="text-xs"
                            >
                              {item.priceOverridden ? "Use list price" : "Override price"}
                            </Button>
                          ) : null}
                          {!lockedLocationId ? (
                            <Button
                              onClick={() =>
                                toggleWarehouseOverride(
                                  item.localId,
                                  !item.warehouseOverridden
                                )
                              }
                              type="button"
                              variant="outline"
                              className="text-xs"
                            >
                              {item.warehouseOverridden
                                ? "Use sale location"
                                : "Split location"}
                            </Button>
                          ) : null}
                        </div>

                        {item.priceOverridden && !pricesLocked ? (
                          <label className="flex items-center gap-3">
                            <span className="text-xs font-medium text-slate-500">Custom price</span>
                            <input
                              className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-[var(--ring)]"
                              min={0}
                              onChange={(event) =>
                                updateUnitPrice(item.localId, event.target.value)
                              }
                              step="0.01"
                              type="number"
                              value={item.unitPrice}
                            />
                          </label>
                        ) : null}

                        {item.warehouseOverridden && !lockedLocationId ? (
                          <label className="flex items-center gap-3">
                            <span className="text-xs font-medium text-slate-500">Location</span>
                            <select
                              className="w-56 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-[var(--ring)]"
                              onChange={(event) => updateWarehouse(item.localId, event.target.value)}
                              value={item.warehouseId}
                            >
                              {locations.map((location) => (
                                <option key={location.id} value={location.id}>
                                  {location.name} ({location.code})
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}

                        <div className="space-y-1 text-xs">
                          <p className={cn("font-medium", isOverStock ? "text-red-700" : "text-slate-500")}>
                            {availableQty === null
                              ? "Availability will appear once the warehouse is set."
                              : isOverStock
                                ? `Only ${availableQty} unit${availableQty === 1 ? "" : "s"} available in this warehouse.`
                                : `${availableQty} unit${availableQty === 1 ? "" : "s"} available in ${warehouseLabel}.`}
                          </p>
                          <p className="text-slate-400">
                            {item.warehouseOverridden
                              ? "Deducts from its own warehouse override."
                              : "Deducts from the sale warehouse."}
                          </p>
                          {rowError ? (
                            <p className="font-medium text-red-700">{rowError}</p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="mt-2 rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
        {inReview ? (
          /* ── CASHIER: Review & confirm panel ── */
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Review sale
              </p>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
                <span>
                  <span className="font-medium text-slate-800">Branch: </span>
                  {locations.find((loc) => loc.id === saleWarehouseId)?.name ?? saleWarehouseId}
                </span>
                <span>
                  <span className="font-medium text-slate-800">Customer: </span>
                  {customerMode === "walk_in" ? "Walk-in" : customerName || "Customer not set yet"}
                </span>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Product</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-right">Unit price</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cart.map((item) => {
                    const product = productMap.get(item.productId);
                    return (
                      <tr key={item.localId}>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {product?.name ?? item.productId}
                          <span className="ml-2 text-xs font-normal text-slate-400">
                            {product?.sku}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">{item.quantity}</td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {formatCurrency(item.unitPrice)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">
                          {formatCurrency(lineTotal(item.quantity, item.unitPrice))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">Mode of payment</p>
                  <p className="text-sm text-slate-500">
                    Choose how the sale will be settled before recording it.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["CASH", "ONLINE", "MIXED"] as const).map((option) => (
                    <button
                      key={option}
                      className={cn(
                        "rounded-full border px-4 py-2 text-sm font-medium transition",
                        paymentMode === option
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      )}
                      onClick={() => setPaymentMode(option)}
                      type="button"
                    >
                      {option === "CASH"
                        ? "Cash"
                        : option === "ONLINE"
                          ? "Online payment"
                          : "Mixed"}
                    </button>
                  ))}
                </div>
              </div>

              {state.fieldErrors?.paymentMode ? (
                <p className="mt-3 text-sm text-destructive">{state.fieldErrors.paymentMode[0]}</p>
              ) : null}

              {paymentMode === "MIXED" ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Cash amount</span>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-[var(--ring)]"
                      min={0}
                      onChange={(event) => setCashAmount(event.target.value)}
                      step="0.01"
                      type="number"
                      value={cashAmount}
                    />
                    {state.fieldErrors?.cashAmount ? (
                      <p className="text-sm text-destructive">{state.fieldErrors.cashAmount[0]}</p>
                    ) : null}
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Online amount</span>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-[var(--ring)]"
                      min={0}
                      onChange={(event) => setOnlineAmount(event.target.value)}
                      step="0.01"
                      type="number"
                      value={onlineAmount}
                    />
                    {state.fieldErrors?.onlineAmount ? (
                      <p className="text-sm text-destructive">{state.fieldErrors.onlineAmount[0]}</p>
                    ) : null}
                  </label>

                  <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                    Remaining balance:{" "}
                    <span
                      className={cn(
                        "font-semibold",
                        Math.abs(mixedBalance) < 0.005 ? "text-emerald-700" : "text-red-600"
                      )}
                    >
                      {formatCurrency(mixedBalance)}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <h2 className="text-2xl font-semibold text-slate-950">
                  {formatCurrency(orderTotal)}
                </h2>
                <p className="text-sm text-slate-500">
                  {cart.length} line{cart.length === 1 ? "" : "s"} / {unitsTotal} unit
                  {unitsTotal === 1 ? "" : "s"}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  className="text-sm text-slate-500 underline decoration-slate-300 underline-offset-2 transition hover:text-slate-700 hover:decoration-slate-500"
                  onClick={() => setInReview(false)}
                >
                  Back to edit
                </button>
                <SubmitButton
                  disabled={!isReady || !saleWarehouseId || cart.length === 0}
                  name="intent"
                  pendingLabel="Recording..."
                  value="record_and_new"
                  variant="outline"
                >
                  Record and start new
                </SubmitButton>
                <SubmitButton
                  className="px-8 py-3 text-base font-semibold"
                  disabled={!isReady || !saleWarehouseId || cart.length === 0}
                  name="intent"
                  pendingLabel="Recording sale..."
                  value="record"
                >
                  Record sale
                </SubmitButton>
              </div>
            </div>
          </div>
        ) : (
          /* ── Default bottom bar (admin / manager, or cashier pre-review) ── */
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold text-slate-950">
                {formatCurrency(orderTotal)}
              </h2>
              <p className="text-sm text-slate-500">
                {cart.length} line{cart.length === 1 ? "" : "s"} {" / "} {unitsTotal} unit
                {unitsTotal === 1 ? "" : "s"}
                {overriddenLines > 0
                  ? ` / ${overriddenLines} override${overriddenLines === 1 ? "" : "s"}`
                  : ""}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/dashboard/sales-orders"
                className="text-sm text-slate-500 underline decoration-slate-300 underline-offset-2 transition hover:text-slate-700 hover:decoration-slate-500"
              >
                Cancel
              </Link>
              <SubmitButton
                disabled={!isReady || !saleWarehouseId || cart.length === 0}
                name="intent"
                pendingLabel="Saving draft..."
                value="draft"
                variant="outline"
              >
                Save draft
              </SubmitButton>
              <Button
                type="button"
                className="px-8 py-3 text-base font-semibold"
                disabled={!isReady || !saleWarehouseId || cart.length === 0}
                onClick={() => setInReview(true)}
              >
                Review sale
              </Button>
            </div>
          </div>
        )}
      </section>
    </form>
  );
}
