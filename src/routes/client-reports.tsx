import { createServerFn } from "@tanstack/react-start";
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { UserPersonalReports } from "@/components/UserPersonalReports";
import { getCurrentUser } from "@/lib/current-user.server";
import { ArrowLeft } from "lucide-react";

type ClientReportsData = {
  viewer: { id: number; firstName: string; lastName: string; email: string } | null;
};

const getClientReportsData = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = getCurrentUser();
  if (!viewer || viewer.role !== "CLIENT") {
    throw new Error("Not authorized");
  }
  return { viewer } satisfies ClientReportsData;
});

export const Route = createFileRoute("/client-reports")({
  loader: () => getClientReportsData(),
  head: () => ({ meta: [{ title: "My Reports - Servio" }] }),
  component: ClientReportsPage,
});

function ClientReportsPage() {
  const data = useLoaderData({ from: "/client-reports" }) as ClientReportsData;
  const displayName = `${data.viewer?.firstName || ""} ${data.viewer?.lastName || ""}`.trim() || data.viewer?.email || "Client";

  return (
    <AppShell title="My Reports" userName={displayName} userRole="Client" userAvatarUrl={data.viewer?.email ?? undefined}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 px-4 py-8 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Button asChild variant="ghost" size="sm">
              <Link to="/profile-setup">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">My Reports</h1>
          <p className="mt-2 text-lg text-slate-600">View and export your job posts, applications, and reviews.</p>
        </div>

        {/* Reports Component */}
        <UserPersonalReports 
          userRole="CLIENT" 
          userId={data.viewer?.id ?? 0} 
          userName={displayName}
        />
      </div>
    </AppShell>
  );
}
