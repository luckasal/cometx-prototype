import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();
  // Avoid replaying remote staff reads on every tab switch/navigation. Mutations
  // still invalidate their data and every server handler verifies current access.
  queryClient.setQueryDefaults(["admin"], {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
