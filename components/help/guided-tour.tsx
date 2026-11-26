"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TOURS } from "@/constants/help";
import type { HelpRole } from "@/hooks/useWorkspace";
import { useTourStore } from "@/store/tourStore";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/de";

const PAD = 4;
const GAP = 12;
const MARGIN = 16;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function findTarget(target: string): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(`[data-tour="${CSS.escape(target)}"]`);
  for (const el of candidates) {
    if (el.offsetParent !== null) return el;
  }
  return null;
}

interface Layout {
  hole: Rect | null;
  pop: { top: number; left: number };
}

function computeLayout(target: string, pop: HTMLElement): Layout {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const w = pop.offsetWidth;
  const h = pop.offsetHeight;
  const el = findTarget(target);
  if (!el) {
    return {
      hole: null,
      pop: { top: Math.max(MARGIN, (vh - h) / 2), left: Math.max(MARGIN, (vw - w) / 2) },
    };
  }
  const b = el.getBoundingClientRect();
  const hole = { top: b.top - PAD, left: b.left - PAD, width: b.width + PAD * 2, height: b.height + PAD * 2 };
  const left = Math.min(Math.max(MARGIN, hole.left + hole.width / 2 - w / 2), vw - w - MARGIN);
  const below = hole.top + hole.height + GAP;
  const top = below + h > vh - MARGIN ? Math.max(MARGIN, hole.top - GAP - h) : below;
  return { hole, pop: { top, left } };
}

/**
 * Rundgang: dunkelt die Seite ab, hebt den Navigationseintrag des aktuellen Schritts hervor
 * und erklärt ihn in einer Sprechblase. Fehlt der Eintrag (z.B. Rolle ohne diesen Bereich),
 * wird der Schritt ohne Hervorhebung mittig gezeigt.
 */
function TourOverlay({ role }: { role: HelpRole }) {
  const stop = useTourStore((s) => s.stop);
  const notify = useTourStore((s) => s.notify);
  const [index, setIndex] = useState(0);
  const [layout, setLayout] = useState<Layout | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const steps = TOURS[role];
  const step = steps[index];
  const isLast = index === steps.length - 1;

  useLayoutEffect(() => {
    findTarget(step.target)?.scrollIntoView({ block: "nearest", inline: "center" });
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (popRef.current) setLayout(computeLayout(step.target, popRef.current));
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    nextRef.current?.focus();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step.target]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        stop();
      } else if (e.key === "ArrowRight") {
        if (index === steps.length - 1) {
          stop();
          notify(t.help.tour.done);
        } else {
          setIndex(index + 1);
        }
      } else if (e.key === "ArrowLeft" && index > 0) {
        setIndex(index - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, steps.length, stop, notify]);

  function next() {
    if (isLast) {
      stop();
      notify(t.help.tour.done);
    } else {
      setIndex(index + 1);
    }
  }

  const hole = layout?.hole ?? null;

  return (
    <div className="fixed inset-0 z-[60]" aria-live="polite">
      {hole ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-xl outline-2 outline-white/90 transition-all duration-200 ease-out"
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
            boxShadow: "0 0 0 9999px rgb(19 18 17 / 0.6)",
          }}
        />
      ) : (
        <div aria-hidden="true" className="fixed inset-0 bg-neutral-950/60" />
      )}

      <div
        ref={popRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-text"
        className={cn(
          "fixed grid w-[min(340px,calc(100vw-32px))] gap-2.5 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-2xl transition-[top,left] duration-200",
          !layout && "invisible",
        )}
        style={layout?.pop ?? { top: 0, left: 0 }}
      >
        <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
          {t.help.tour.stepOf
            .replace("{current}", String(index + 1))
            .replace("{total}", String(steps.length))}
        </p>
        <h2 id="tour-title" className="font-heading text-base font-bold">
          {step.title}
        </h2>
        <p id="tour-text" className="text-sm">
          {step.text}
        </p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="flex gap-1.5" aria-hidden="true">
            {steps.map((s, i) => (
              <span
                key={s.target}
                className={cn("size-1.5 rounded-full", i === index ? "bg-primary" : "bg-border")}
              />
            ))}
          </div>
          <div className="flex gap-1.5">
            <Button type="button" size="sm" variant="ghost" onClick={stop}>
              {t.help.tour.close}
            </Button>
            {index > 0 && (
              <Button type="button" size="sm" variant="outline" onClick={() => setIndex(index - 1)}>
                {t.help.tour.back}
              </Button>
            )}
            <Button ref={nextRef} type="button" size="sm" onClick={next}>
              {isLast ? t.help.tour.finish : t.help.tour.next}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GuidedTour() {
  const role = useTourStore((s) => s.role);
  if (!role) return null;
  return <TourOverlay key={role} role={role} />;
}
