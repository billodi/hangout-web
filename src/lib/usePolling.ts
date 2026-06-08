"use client";

import { useEffect, useRef } from "react";

export function usePolling(task: () => void, intervalMs: number | null, enabled = true, runImmediately = false) {
  const taskRef = useRef(task);
  useEffect(() => {
    taskRef.current = task;
  }, [task]);

  useEffect(() => {
    if (!enabled) return;

    let immediateId: number | null = null;
    if (runImmediately) {
      immediateId = window.requestAnimationFrame(() => taskRef.current());
    }

    if (intervalMs === null) {
      return () => {
        if (immediateId !== null) window.cancelAnimationFrame(immediateId);
      };
    }

    const timer = window.setInterval(() => taskRef.current(), intervalMs);
    return () => {
      if (immediateId !== null) window.cancelAnimationFrame(immediateId);
      window.clearInterval(timer);
    };
  }, [intervalMs, enabled, runImmediately]);
}

