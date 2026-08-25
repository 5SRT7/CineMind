"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";

const YEAR_MIN = 1895;
const YEAR_MAX = new Date().getFullYear();

export function YearRangeSlider({
  min,
  max,
  onChange,
}: {
  min: number | null;
  max: number | null;
  onChange: (min: number, max: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<"min" | "max" | null>(null);
  const currentMin = min ?? YEAR_MIN;
  const currentMax = max ?? YEAR_MAX;

  function yearFromClientX(clientX: number) {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return currentMin;
    const ratio = Math.min(
      1,
      Math.max(0, (clientX - rect.left) / rect.width),
    );
    return Math.round(YEAR_MIN + ratio * (YEAR_MAX - YEAR_MIN));
  }

  function startDrag(
    event: ReactPointerEvent<HTMLDivElement>,
    handle: "min" | "max" | null,
  ) {
    event.preventDefault();
    const value = yearFromClientX(event.clientX);
    draggingRef.current =
      handle ??
      (Math.abs(value - currentMin) <= Math.abs(value - currentMax)
        ? "min"
        : "max");
    trackRef.current?.setPointerCapture?.(event.pointerId);
    updateFromClientX(event.clientX);
  }

  function updateFromClientX(clientX: number) {
    const value = yearFromClientX(clientX);
    if (draggingRef.current === "min") {
      onChange(Math.min(value, currentMax), currentMax);
    } else if (draggingRef.current === "max") {
      onChange(currentMin, Math.max(value, currentMin));
    }
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (trackRef.current?.hasPointerCapture?.(event.pointerId)) {
      trackRef.current.releasePointerCapture(event.pointerId);
    }
    draggingRef.current = null;
  }

  const minPercent = ((currentMin - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100;
  const maxPercent = ((currentMax - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100;
  const rangeWidth = Math.max(0, maxPercent - minPercent);
  const handlesOverlap = currentMin === currentMax;

  return (
    <div className="pt-1">
      <div
        ref={trackRef}
        onPointerDown={(event) => startDrag(event, null)}
        onPointerMove={(event) => {
          if (draggingRef.current) updateFromClientX(event.clientX);
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative h-9 cursor-pointer select-none touch-none"
      >
        <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/10" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent/70"
          style={{ left: `${minPercent}%`, width: `${rangeWidth}%` }}
        />
        <div
          role="slider"
          aria-label="起始年份"
          aria-valuemin={YEAR_MIN}
          aria-valuemax={YEAR_MAX}
          aria-valuenow={currentMin}
          onPointerDown={(event) => {
            event.stopPropagation();
            startDrag(event, "min");
          }}
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent shadow-lg"
          style={{
            left: `${minPercent}%`,
            zIndex: handlesOverlap ? 30 : 20,
          }}
        />
        <div
          role="slider"
          aria-label="结束年份"
          aria-valuemin={YEAR_MIN}
          aria-valuemax={YEAR_MAX}
          aria-valuenow={currentMax}
          onPointerDown={(event) => {
            event.stopPropagation();
            startDrag(event, "max");
          }}
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent shadow-lg"
          style={{
            left: `${maxPercent}%`,
            zIndex: handlesOverlap ? 20 : 30,
          }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-muted">
        <span>{currentMin}</span>
        <span className="font-semibold text-muted-strong">
          {min === null && max === null
            ? "全部年份"
            : `${currentMin} - ${currentMax}`}
        </span>
        <span>{currentMax}</span>
      </div>
    </div>
  );
}
