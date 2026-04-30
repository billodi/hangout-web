"use client";

import type { SelectHTMLAttributes } from "react";
import { cn } from "./cn";

export default function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full appearance-none rounded-[var(--radius-sm)] border border-[color-mix(in_oklab,var(--border)_80%,transparent)] " +
          "bg-[color-mix(in_oklab,var(--surface)_78%,transparent)] px-3 py-2 text-sm text-[var(--text)] " +
          "transition focus:outline-none focus-visible:ring-0 focus-visible:border-[color-mix(in_oklab,var(--accent2)_68%,transparent)] focus-visible:[box-shadow:var(--ring)]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
