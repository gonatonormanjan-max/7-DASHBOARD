"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";

type AnalyticsStatCard = {
  label: string;
  value: string;
  description?: string;
  tone?: "default" | "primary" | "success" | "warning";
};

type AnalyticsStatCardsCarouselProps = {
  cards: AnalyticsStatCard[];
};

function getCardsPerView(width: number) {
  if (width >= 1280) {
    return 3;
  }

  if (width >= 768) {
    return 2;
  }

  return 1;
}

export function AnalyticsStatCardsCarousel({ cards }: AnalyticsStatCardsCarouselProps) {
  const [cardsPerView, setCardsPerView] = useState(1);
  const [startIndex, setStartIndex] = useState(0);

  useEffect(() => {
    const updateCardsPerView = () => {
      setCardsPerView(getCardsPerView(window.innerWidth));
    };

    updateCardsPerView();
    window.addEventListener("resize", updateCardsPerView);

    return () => {
      window.removeEventListener("resize", updateCardsPerView);
    };
  }, []);

  const maxStartIndex = Math.max(0, cards.length - cardsPerView);
  const clampedStartIndex = Math.min(startIndex, maxStartIndex);
  const canGoPrev = clampedStartIndex > 0;
  const canGoNext = clampedStartIndex < maxStartIndex;
  const translatePercentage = (clampedStartIndex * 100) / cardsPerView;

  const visibleRange = useMemo(() => {
    if (cards.length === 0) {
      return "No metrics";
    }

    const start = clampedStartIndex + 1;
    const end = Math.min(cards.length, clampedStartIndex + cardsPerView);
    return `Showing ${start}-${end} of ${cards.length}`;
  }, [cards.length, cardsPerView, clampedStartIndex]);

  if (cards.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          {visibleRange}
        </p>
        <div className="flex items-center gap-2">
          <Button
            aria-label="Previous metrics"
            disabled={!canGoPrev}
            onClick={() =>
              setStartIndex((current) => Math.max(0, Math.min(current, maxStartIndex) - 1))
            }
            size="sm"
            type="button"
            variant="outline"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            aria-label="Next metrics"
            disabled={!canGoNext}
            onClick={() =>
              setStartIndex((current) => Math.min(maxStartIndex, Math.min(current, maxStartIndex) + 1))
            }
            size="sm"
            type="button"
            variant="outline"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-hidden">
        <div
          className="-mx-2 flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${translatePercentage}%)` }}
        >
          {cards.map((card, index) => (
            <div
              key={`${card.label}-${index}`}
              className="w-full shrink-0 px-2"
              style={{ flexBasis: `${100 / cardsPerView}%` }}
            >
              <StatCard
                description={card.description}
                label={card.label}
                tone={card.tone}
                value={card.value}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
