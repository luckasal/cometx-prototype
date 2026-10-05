import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { assetRecoveryUrl } from "./lib/asset-recovery";

const ASSET_RELOAD_ATTEMPT_KEY = "cometx:asset-reload-attempted";

if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (event) => {
    try {
      if (window.sessionStorage.getItem(ASSET_RELOAD_ATTEMPT_KEY)) {
        window.sessionStorage.removeItem(ASSET_RELOAD_ATTEMPT_KEY);
        return;
      }
      window.sessionStorage.setItem(ASSET_RELOAD_ATTEMPT_KEY, "1");
    } catch {
      // Leave the original preload error visible if the browser blocks session storage.
      return;
    }

    event.preventDefault();
    window.location.replace(assetRecoveryUrl(window.location.href));
  });

  window.addEventListener(
    "pageshow",
    () => window.sessionStorage.removeItem(ASSET_RELOAD_ATTEMPT_KEY),
    { once: true },
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
