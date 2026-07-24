import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { getProjectData, checkProjectAuth } from "@/client/project.$projectId.server";
import { Project } from "@/client/project.$projectId";

export const Route = createFileRoute("/project/$projectId")({
  head: () => ({ meta: [{ title: "Project tracking — Servio" }] }),
  beforeLoad: async ({ location }) => {
    const auth = await checkProjectAuth();

    if (!auth.authenticated) {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }

    if (!auth.isClient) {
      throw redirect({
        to: "/dashboard",
      });
    }
  },
  loader: async ({ params }) => {
    const result = await getProjectData({ data: params.projectId });

    if (!result || !result.job) {
      throw notFound();
    }

    return result;
  },
  component: Project,
  errorComponent: ({ error }) => (
    <div className="p-10 text-center">
      <h2 className="text-xl font-semibold">Project not found</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {error?.message || "This project doesn't exist or you don't have access to it."}
      </p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-10 text-center">
      <h2 className="text-xl font-semibold">Project not found</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        The project you're looking for doesn't exist.
      </p>
    </div>
  ),
});
