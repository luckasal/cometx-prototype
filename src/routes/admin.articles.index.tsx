import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminListArticles, adminDeleteArticle } from "@/lib/admin.functions";
import { AdminPage, AdminTable } from "@/components/admin/AdminBits";
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from "@/components/site/Bits";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/articles/")({
  component: AdminArticlesPage,
});

function AdminArticlesPage() {
  const queryClient = useQueryClient();
  const fetchArticles = useServerFn(adminListArticles);
  const deleteArticle = useServerFn(adminDeleteArticle);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "articles"],
    queryFn: () => fetchArticles(),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteArticle({ data: { id } }),
    onSuccess: () => {
      toast.success("Article deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "articles"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <AdminPage
      title="Articles"
      description="Gating is enforced on the server: locked articles never send their full text to the browser."
      action={
        <Button asChild variant="ink">
          <Link to="/admin/articles/new">New article</Link>
        </Button>
      }
    >
      {isLoading && <LoadingBlock label="Loading articles" />}
      {error && <ErrorBlock error={error} />}
      {data && data.length === 0 && <EmptyBlock title="No articles yet" />}
      {data && data.length > 0 && (
        <AdminTable head={["Title", "Visibility", "Status", "Published", ""]}>
          {data.map((article) => (
            <tr key={article.id} className="[&>td]:px-4 [&>td]:py-3">
              <td>
                <Link
                  to="/admin/articles/$id"
                  params={{ id: article.id }}
                  className="font-medium hover:underline"
                >
                  {article.title}
                </Link>
                <span className="block text-xs text-muted-foreground">/{article.slug}</span>
              </td>
              <td>
                <StatusPill tone="muted">{article.visibility}</StatusPill>
              </td>
              <td>
                <StatusPill tone={article.status === "published" ? "signal" : "muted"}>
                  {article.status}
                </StatusPill>
              </td>
              <td className="text-muted-foreground">
                {article.published_at
                  ? new Date(article.published_at).toLocaleDateString("en-GB")
                  : "-"}
              </td>
              <td className="text-right">
                <button
                  className="text-xs text-destructive underline underline-offset-4"
                  onClick={() => {
                    if (confirm(`Delete "${article.title}"?`)) remove.mutate(article.id);
                  }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </AdminPage>
  );
}
