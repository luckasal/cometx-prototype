import { createServerFn } from "@tanstack/react-start";

export const getAdminAnalytics = createServerFn({ method: "GET" }).handler(async () => {
  await (await import("./auth.server")).requireStaffPermission("reports.read");
  const { readGaReport } = await import("./ga-report.server");
  return readGaReport();
});
