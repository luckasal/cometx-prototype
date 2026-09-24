import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/components/admin/AdminBits";
import { ArticleForm, emptyArticle } from "@/components/admin/ArticleForm";

export const Route = createFileRoute("/admin/articles/new")({
  component: NewArticlePage,
});

function NewArticlePage() {
  return (
    <AdminPage title="New article" description="Write it, choose who can read it, then publish.">
      <ArticleForm initial={emptyArticle} />
    </AdminPage>
  );
}
