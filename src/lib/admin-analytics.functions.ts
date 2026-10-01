import { createServerFn } from "@tanstack/react-start";

export const getAdminAnalytics = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./auth.server");
  await requireAdmin();
  const { readGaReport } = await import("./ga-report.server");
  return readGaReport();
});
