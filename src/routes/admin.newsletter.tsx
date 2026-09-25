import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListContacts } from "@/lib/admin.functions";
import { AdminPage, AdminTable } from "@/components/admin/AdminBits";
import { ErrorBlock, LoadingBlock } from "@/components/site/Bits";

export const Route = createFileRoute("/admin/newsletter")({ component: NewsletterPage });
function NewsletterPage() {
  const fetchContacts = useServerFn(adminListContacts);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin", "newsletter"], queryFn: () => fetchContacts({ data: { query: "", status: "subscribed" } }) });
  return <AdminPage title="Newsletter" description="Subscribed contacts ready for a Resend audience or campaign export." action={<Link to="/admin/contacts" className="text-sm underline">Manage contacts</Link>}>
    {isLoading && <LoadingBlock label="Loading subscribers" />}{error && <ErrorBlock error={error} />}
    {data && <><p className="mb-5 text-sm text-muted-foreground">{data.length} subscribed contacts. Delivery is intentionally not enabled until Resend is configured.</p><AdminTable head={["Name", "Email", "Source", "Consent"]}>{data.map((contact) => <tr key={contact.id} className="[&>td]:px-4 [&>td]:py-3"><td>{[contact.first_name, contact.last_name].filter(Boolean).join(" ") || "-"}</td><td>{contact.email}</td><td>{contact.source}</td><td>{contact.consent_at ? new Date(contact.consent_at).toLocaleDateString("en-GB") : "-"}</td></tr>)}</AdminTable></>}
  </AdminPage>;
}
