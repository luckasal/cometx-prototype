import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminGetArticle } from "@/lib/admin.functions";
import { AdminPage } from "@/components/admin/AdminBits";
import { ArticleForm } from "@/components/admin/ArticleForm";
import { ErrorBlock, LoadingBlock } from "@/components/site/Bits";

export const Route = createFileRoute("/admin/articles/$id")({
  component: EditArticlePage,
});

function EditArticlePage() {
  const { id } = Route.useParams();
  const fetchArticle = useServerFn(adminGetArticle);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "article", id],
    queryFn: () => fetchArticle({ data: { id } }),
  });

  if (isLoading)
    return (
      <AdminPage title="Edit article">
        <LoadingBlock label="Loading article" />
      </AdminPage>
    );
  if (error)
    return (
      <AdminPage title="Edit article">
        <ErrorBlock error={error} />
      </AdminPage>
    );
  if (!data)
    return (
      <AdminPage title="Edit article">
        <p className="text-sm text-muted-foreground">This article no longer exists.</p>
      </AdminPage>
    );

  return (
    <AdminPage title={data.title} description={`Editing /community/articles/${data.slug}`}>
      <ArticleForm
        initial={{
          id: data.id,
          title: data.title,
          slug: data.slug,
          excerpt: data.excerpt ?? "",
          body: data.body ?? "",
          hero_image_url: data.hero_image_url ?? "",
          status: data.status,
          visibility: data.visibility,
          required_entitlement: data.required_entitlement ?? "",
        }}
      />
    </AdminPage>
  );
}
