"use client";

import { cn } from "@/lib/utils";

interface CollapsibleSidebarProps {
  open: boolean;
  children: React.ReactNode;
}

export function CollapsibleSidebar({ open, children }: CollapsibleSidebarProps) {
  return (
    <aside
      className={cn(
        "sidebar overflow-hidden border-r border-[var(--vscode-border)] bg-[var(--vscode-bg-secondary)] transition-[width] duration-200 ease-out",
        open ? "w-[220px]" : "w-0"
      )}
      aria-label="File explorer"
      aria-hidden={!open}
    >
      <div className="h-full w-[220px]">{children}</div>
    </aside>
  );
}
