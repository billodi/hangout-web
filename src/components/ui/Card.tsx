"use client";

import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--border)] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--surface)_92%,var(--accent2)_8%),color-mix(in_oklab,var(--surface)_84%,#2fc6ff_16%))] " +
          "[box-shadow:var(--shadow),var(--shadow-inset)] backdrop-blur-[var(--blur)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-3 sm:p-4 lg:p-5", className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-3 pt-3 sm:px-4 sm:pt-4 lg:px-5 lg:pt-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-3 pb-3 sm:px-4 sm:pb-4 lg:px-5 lg:pb-5", className)} {...props} />;
}

