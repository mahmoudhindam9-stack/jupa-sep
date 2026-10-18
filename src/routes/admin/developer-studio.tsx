import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/developer-studio")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/studio" });
  },
  head: () => ({
    meta: [{ title: "استوديو المطور Pro" }],
  }),
  component: LegacyDeveloperStudioRedirect,
});

function LegacyDeveloperStudioRedirect() {
  return null;
}
