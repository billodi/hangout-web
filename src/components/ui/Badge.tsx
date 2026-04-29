"use client";

import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export default function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-[color-mix(in_oklab,var(--border)_75%,transparent)] " +
          "bg-[color-mix(in_oklab,var(--surface2)_56%,transparent)] px-2.5 py-1 text-[11px] font-semibold " +
          "text-[color-mix(in_oklab,var(--text)_88%,transparent)]",
        className,
      )}
      {...props}
    />
  );
}

