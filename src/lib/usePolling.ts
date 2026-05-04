"use client";

import { useEffect, useRef } from "react";

export function usePolling(task: () => void, intervalMs: number | null, enabled = true) {
  const taskRef = useRef(task);
  useEffect(() => {
    taskRef.current = task;
  }, [task]);

  useEffect(() => {
    if (!enabled || intervalMs === null) return;
    const timer = window.setInterval(() => taskRef.current(), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, enabled]);
}

