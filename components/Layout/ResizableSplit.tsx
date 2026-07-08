"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ResizableSplitProps {
  consoleHeight: number;
  onResize: (height: number) => void;
  minHeight?: number;
  maxHeight?: number;
}

export function ResizableSplit({
  consoleHeight,
  onResize,
  minHeight = 100,
  maxHeight,
}: ResizableSplitProps) {
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const startHeight = useRef(consoleHeight);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (event: MouseEvent) => {
      const delta = startY.current - event.clientY;
      const max = maxHeight ?? window.innerHeight * 0.6;
      const next = Math.min(
        max,
        Math.max(minHeight, startHeight.current + delta)
      );
      onResize(next);
    };

    const onUp = () => setDragging(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, maxHeight, minHeight, onResize]);

  return (
    <div
      className={cn(
        "splitter cursor-ns-resize bg-[var(--vscode-border)] hover:bg-[var(--vscode-blue)] transition-colors",
        dragging && "bg-[var(--vscode-blue)]"
      )}
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize console"
      onMouseDown={(event) => {
        startY.current = event.clientY;
        startHeight.current = consoleHeight;
        setDragging(true);
      }}
      onDoubleClick={() => onResize(consoleHeight > 120 ? 40 : 200)}
    />
  );
}
