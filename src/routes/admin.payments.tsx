import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListPayments } from "@/lib/admin.functions";
import { AdminPage, AdminTable } from "@/components/admin/AdminBits";
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from "@/components/site/Bits";
import { formatMoney } from "@/lib/pricing";

export const Route = createFileRoute("/admin/payments")({ component: PaymentsPage });
function PaymentsPage() {
  const fetchPayments = useServerFn(adminListPayments);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin", "payments"], queryFn: () => fetchPayments() });
  return <AdminPage title="Payments" description="Stripe payment records and receipt links. Live charging remains disabled until Stripe is configured.">
    {isLoading && <LoadingBlock label="Loading payments" />}{error && <ErrorBlock error={error} />}{data?.length === 0 && <EmptyBlock title="No payment records yet" />}
    {data && data.length > 0 && <AdminTable head={["Amount", "Status", "Stripe session", "Documents", "Created"]}>{data.map((payment) => <tr key={payment.id} className="[&>td]:px-4 [&>td]:py-3"><td className="font-medium">{formatMoney(Number(payment.amount), payment.currency)}</td><td><StatusPill tone={payment.status === "paid" ? "success" : "muted"}>{payment.status}</StatusPill></td><td className="max-w-48 truncate text-muted-foreground">{payment.stripe_checkout_session_id ?? "-"}</td><td>{payment.invoice_url || payment.receipt_url ? <a className="underline" href={payment.receipt_url ?? payment.invoice_url ?? "#"} target="_blank" rel="noreferrer">Receipt</a> : "-"}</td><td>{new Date(payment.created_at).toLocaleDateString("en-GB")}</td></tr>)}</AdminTable>}
  </AdminPage>;
}
