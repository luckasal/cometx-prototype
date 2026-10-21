import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/registrations")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/orders" });
  },
});
