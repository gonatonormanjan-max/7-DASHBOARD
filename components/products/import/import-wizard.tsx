"use client";

import { useCallback, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  autoMapColumns,
  validateRows,
  getUnknownCategoryNames,
  type SystemField,
  type RawRow,
  type ValidatedRow,
} from "@/lib/validators/product-import";
import { checkBatchSkus } from "@/lib/actions/import-products";
import { StepPaste } from "./step-paste";
import { StepReview } from "./step-review";
import { StepResult } from "./step-result";

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

type WizardStep = 1 | 2 | 3;

type WizardState = {
  step: WizardStep;

  // Step 1 output
  rawText: string;
  headers: string[];
  parsedRows: RawRow[];
  wasTruncated: boolean;

  // Step 2 data (loaded after parse)
  columnMapping: Record<string, SystemField | null>;
  existingSkus: Set<string>;
  validatedRows: ValidatedRow[];
  unknownCategories: string[];
  categoryResolutions: Record<string, "create" | "skip">;
};

const INITIAL_STATE: WizardState = {
  step: 1,
  rawText: "",
  headers: [],
  parsedRows: [],
  wasTruncated: false,
  columnMapping: {},
  existingSkus: new Set(),
  validatedRows: [],
  unknownCategories: [],
  categoryResolutions: {},
};

// ----------------------------------------------------------------
// Step indicator
// ----------------------------------------------------------------

const STEPS = [
  { label: "Paste Data", number: 1 },
  { label: "Map & Review", number: 2 },
  { label: "Confirm & Import", number: 3 },
];

function StepIndicator({ currentStep }: { currentStep: WizardStep }) {
  return (
    <nav aria-label="Import steps" className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const isCompleted = step.number < currentStep;
        const isActive = step.number === currentStep;
        const isFuture = step.number > currentStep;

        return (
          <div key={step.number} className="flex items-center">
            <div className="flex items-center gap-3">
              {/* Circle */}
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all",
                  isCompleted && "bg-emerald-500 text-white",
                  isActive && "bg-primary text-white shadow-sm",
                  isFuture && "border-2 border-slate-200 bg-white text-slate-400"
                )}
              >
                {isCompleted ? (
                  <Check className="size-4" strokeWidth={2.5} />
                ) : (
                  step.number
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  "text-sm",
                  isActive && "font-semibold text-slate-900",
                  isCompleted && "font-medium text-emerald-700",
                  isFuture && "text-slate-400"
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector */}
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-4 h-px w-12 transition-all",
                  step.number < currentStep ? "bg-emerald-400" : "bg-slate-200"
                )}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}

// ----------------------------------------------------------------
// Wizard
// ----------------------------------------------------------------

type ImportWizardProps = {
  initialCategories: Array<{ id: string; name: string }>;
  initialBrands: Array<{ id: string; name: string }>;
};

export function ImportWizard({ initialCategories }: ImportWizardProps) {
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [isChecking, setIsChecking] = useState(false);

  // Build a stable category lookup so downstream callbacks can safely depend on it.
  const categoryNameMap = useMemo(
    () =>
      new Map(
        initialCategories.map((category) => [category.name.toLowerCase(), category.id])
      ),
    [initialCategories]
  );

  // ------------------------------------------------------------------
  // Step 1 → Step 2 transition
  // ------------------------------------------------------------------

  const handleParsed = useCallback(
    async (params: {
      headers: string[];
      rows: RawRow[];
      rawText: string;
      wasTruncated: boolean;
    }) => {
      setIsChecking(true);

      const { headers, rows, rawText, wasTruncated } = params;
      const mapping = autoMapColumns(headers);

      // Fetch existing SKUs from DB for this batch
      const batchSkuField = Object.keys(mapping).find((h) => mapping[h] === "sku");
      const batchSkus = batchSkuField
        ? rows
            .map((r) => (r[batchSkuField] ?? "").trim().toUpperCase())
            .filter(Boolean)
        : [];

      let existingSkusList: string[] = [];
      try {
        existingSkusList = await checkBatchSkus(batchSkus);
      } catch {
        // Non-fatal — validation will just miss the DB duplicate check client-side
        // The server action re-checks anyway
      }

      const existingSkus = new Set(existingSkusList);
      const validatedRows = validateRows(rows, mapping, existingSkus);
      const unknownCategories = getUnknownCategoryNames(rows, mapping, categoryNameMap);

      // Default all unknown categories to "skip"
      const categoryResolutions: Record<string, "create" | "skip"> = {};
      for (const cat of unknownCategories) {
        categoryResolutions[cat] = "skip";
      }

      setState({
        step: 2,
        rawText,
        headers,
        parsedRows: rows,
        wasTruncated,
        columnMapping: mapping,
        existingSkus,
        validatedRows,
        unknownCategories,
        categoryResolutions,
      });

      setIsChecking(false);
    },
    [categoryNameMap]
  );

  // ------------------------------------------------------------------
  // Mapping changes (Step 2) — re-validate on every change
  // ------------------------------------------------------------------

  const handleMappingChange = useCallback(
    (header: string, field: SystemField | null) => {
      setState((prev) => {
        const newMapping = { ...prev.columnMapping, [header]: field };
        const validatedRows = validateRows(prev.parsedRows, newMapping, prev.existingSkus);
        const unknownCategories = getUnknownCategoryNames(
          prev.parsedRows,
          newMapping,
          categoryNameMap
        );

        // Preserve existing resolutions; add defaults for newly discovered unknowns
        const categoryResolutions: Record<string, "create" | "skip"> = {
          ...prev.categoryResolutions,
        };
        for (const cat of unknownCategories) {
          if (!categoryResolutions[cat]) {
            categoryResolutions[cat] = "skip";
          }
        }
        // Remove resolutions for categories no longer unknown
        for (const cat of Object.keys(categoryResolutions)) {
          if (!unknownCategories.includes(cat)) {
            delete categoryResolutions[cat];
          }
        }

        return {
          ...prev,
          columnMapping: newMapping,
          validatedRows,
          unknownCategories,
          categoryResolutions,
        };
      });
    },
    [categoryNameMap]
  );

  // ------------------------------------------------------------------
  // Category resolution changes (Step 2)
  // ------------------------------------------------------------------

  const handleResolutionChange = useCallback(
    (categoryName: string, resolution: "create" | "skip") => {
      setState((prev) => ({
        ...prev,
        categoryResolutions: { ...prev.categoryResolutions, [categoryName]: resolution },
      }));
    },
    []
  );

  // ------------------------------------------------------------------
  // Step navigation
  // ------------------------------------------------------------------

  function goToStep(step: WizardStep) {
    setState((prev) => ({ ...prev, step }));
  }

  function handleStartOver() {
    setState(INITIAL_STATE);
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="space-y-8">
      {/* Step indicator */}
      <div className="flex justify-center">
        <StepIndicator currentStep={state.step} />
      </div>

      {/* Step content card */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        {/* Checking overlay */}
        {isChecking && (
          <div className="flex items-center justify-center py-16">
            <div className="space-y-3 text-center">
              <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
              <p className="text-sm text-slate-500">Checking existing data…</p>
            </div>
          </div>
        )}

        {!isChecking && state.step === 1 && (
          <StepPaste initialText={state.rawText} onParsed={handleParsed} />
        )}

        {!isChecking && state.step === 2 && (
          <StepReview
            headers={state.headers}
            parsedRows={state.parsedRows}
            columnMapping={state.columnMapping}
            validatedRows={state.validatedRows}
            categoryNameMap={categoryNameMap}
            unknownCategories={state.unknownCategories}
            categoryResolutions={state.categoryResolutions}
            wasTruncated={state.wasTruncated}
            onMappingChange={handleMappingChange}
            onResolutionChange={handleResolutionChange}
            onBack={() => goToStep(1)}
            onContinue={() => goToStep(3)}
          />
        )}

        {!isChecking && state.step === 3 && (
          <StepResult
            validatedRows={state.validatedRows}
            parsedRows={state.parsedRows}
            columnMapping={state.columnMapping}
            categoryNameMap={categoryNameMap}
            categoryResolutions={state.categoryResolutions}
            onBack={() => goToStep(2)}
            onStartOver={handleStartOver}
          />
        )}
      </div>
    </div>
  );
}
