import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminIntegrationStatus } from "@/lib/admin.functions";
import { AdminPage, AdminTable } from "@/components/admin/AdminBits";
import { ErrorBlock, LoadingBlock, StatusPill } from "@/components/site/Bits";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });
function SettingsPage() {
  const fetchStatus = useServerFn(getAdminIntegrationStatus);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin", "settings"], queryFn: () => fetchStatus() });
  return <AdminPage title="Settings" description="Integration readiness. Secrets stay in Vercel/Supabase environment settings, never in this admin.">
    {isLoading && <LoadingBlock label="Checking integrations" />}{error && <ErrorBlock error={error} />}
    {data && <AdminTable head={["Integration", "Status", "What to configure"]}>{[["Resend", data.resend, "RESEND_API_KEY"], ["Stripe", data.stripe, "STRIPE_SECRET_KEY"], ["Stripe webhook", data.stripeWebhook, "STRIPE_WEBHOOK_SECRET"], ["Google Analytics", data.gaMeasurementId, "VITE_GA_MEASUREMENT_ID"], ["Google Tag Manager", data.gtmContainerId, "VITE_GTM_CONTAINER_ID"]].map(([name, enabled, variable]) => <tr key={name as string} className="[&>td]:px-4 [&>td]:py-3"><td className="font-medium">{name as string}</td><td><StatusPill tone={enabled ? "success" : "muted"}>{enabled ? "Configured" : "Not configured"}</StatusPill></td><td className="font-mono text-xs">{variable as string}</td></tr>)}</AdminTable>}
  </AdminPage>;
}
