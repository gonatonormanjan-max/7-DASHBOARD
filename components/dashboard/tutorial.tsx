"use client";

import { useState, useSyncExternalStore } from "react";
import type { Role } from "@prisma/client";
import { BookOpen, X } from "lucide-react";
import { getRoleLabel } from "@/lib/permissions";
import { Button } from "@/components/ui/button";

const TUTORIAL_STORAGE_KEY = "northstar-dashboard-tutorial:v1";

function getTutorialSteps(role: Role) {
  return [
    {
      title: "Start from the sidebar",
      description:
        "Use the left navigation to move between catalog, operations, reporting, and system modules. The menu is filtered by your role, so you only see what you can access.",
    },
    {
      title: "Read the header for context",
      description:
        "The top bar shows your current access level, email, sign-out control, and a quick way to reopen this tutorial anytime.",
    },
    {
      title: "Work module by module",
      description:
        "Each module uses the same pattern: summary cards first, then filters, then a focused table or form. Start broad with the cards, narrow down with filters, then act from the table.",
    },
    {
      title: `${getRoleLabel(role)} workflow tips`,
      description:
        role === "ADMIN"
          ? "You can manage users, roles, and the highest-level system controls. Use the Users module to create Admin, System Manager, and Sales Staff accounts safely."
          : role === "SYSTEM_MANAGER"
            ? "You can manage operational work and user accounts, but not Admin ownership. Use the Users module for System Manager and Sales Staff access."
            : "You can work inside the modules available to your role, with restricted access to ownership-level settings and user management.",
    },
  ];
}

export function DashboardTutorial({
  firstName,
  role,
}: {
  firstName: string;
  role: Role;
}) {
  const [manualOpen, setManualOpen] = useState(false);
  const [manualClosed, setManualClosed] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const steps = getTutorialSteps(role);
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const shouldAutoOpen =
    isHydrated &&
    !manualClosed &&
    (() => {
      try {
        return window.localStorage.getItem(TUTORIAL_STORAGE_KEY) !== "dismissed";
      } catch {
        return true;
      }
    })();
  const isOpen = manualOpen || shouldAutoOpen;

  const openTutorial = () => {
    setStepIndex(0);
    setManualClosed(true);
    setManualOpen(true);
  };

  const closeTutorial = () => {
    setManualClosed(true);
    setManualOpen(false);
  };

  const dismissTutorial = () => {
    try {
      window.localStorage.setItem(TUTORIAL_STORAGE_KEY, "dismissed");
    } catch {}

    setManualClosed(true);
    setManualOpen(false);
  };

  const nextStep = () => {
    if (stepIndex >= steps.length - 1) {
      closeTutorial();
      return;
    }

    setStepIndex((current) => current + 1);
  };

  const previousStep = () => {
    setStepIndex((current) => Math.max(0, current - 1));
  };

  return (
    <>
      <Button onClick={openTutorial} type="button" variant="outline">
        <BookOpen className="mr-2 size-4" />
        Tutorial
      </Button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6">
          <div className="w-full max-w-2xl rounded-[28px] border border-white/80 bg-white p-6 shadow-[0_40px_80px_-45px_rgba(15,23,42,0.55)] sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Dashboard tutorial
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                  Welcome, {firstName}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  This guide is skippable now and repeatable anytime from the header.
                </p>
              </div>

              <button
                aria-label="Close tutorial"
                className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                onClick={closeTutorial}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50/80 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Step {stepIndex + 1} of {steps.length}
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-slate-950">
                {steps[stepIndex].title}
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                {steps[stepIndex].description}
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Button
                  disabled={stepIndex === 0}
                  onClick={previousStep}
                  type="button"
                  variant="outline"
                >
                  Back
                </Button>
                <Button onClick={nextStep} type="button">
                  {stepIndex === steps.length - 1 ? "Finish" : "Next"}
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={closeTutorial} type="button" variant="ghost">
                  Skip for now
                </Button>
                <Button onClick={dismissTutorial} type="button" variant="outline">
                  Don&apos;t auto-open again
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
