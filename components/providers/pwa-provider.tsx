"use client";

import { useEffect } from "react";

export function PwaProvider() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      const cleanupDevServiceWorkers = async () => {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));
          if ("caches" in window) {
            const cacheNames = await caches.keys();
            await Promise.all(
              cacheNames
                .filter((cacheName) => cacheName.startsWith("churchflow-pwa-"))
                .map((cacheName) => caches.delete(cacheName)),
            );
          }
        } catch (error) {
          console.error("Failed to clear development service workers", error);
        }
      };

      void cleanupDevServiceWorkers();
      return;
    }

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch (error) {
        console.error("Failed to register service worker", error);
      }
    };

    void register();
  }, []);

  return null;
}
