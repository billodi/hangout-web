"use client";

import { useEffect } from "react";

const SW_URL = "/sw.js?v=3";
const ACTIVE_CACHE = "hangout-shell-v3";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          regs.map(async (reg) => {
            const activeUrl = reg.active?.scriptURL ?? "";
            const waitingUrl = reg.waiting?.scriptURL ?? "";
            const installingUrl = reg.installing?.scriptURL ?? "";
            const urls = `${activeUrl} ${waitingUrl} ${installingUrl}`;
            if (urls.includes("/sw.js") && !urls.includes("v=3")) {
              await reg.unregister();
            }
          }),
        );

        const reg = await navigator.serviceWorker.register(SW_URL);
        await reg.update();

        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.filter((k) => k.startsWith("hangout-shell-") && k !== ACTIVE_CACHE).map((k) => caches.delete(k)));
        }
      } catch {
        // No-op: app works without background caching.
      }
    })();
  }, []);

  return null;
}
