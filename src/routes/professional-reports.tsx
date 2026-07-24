import { createServerFn } from "@tanstack/react-start";
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { UserPersonalReports } from "@/components/UserPersonalReports";
import { getCurrentUser } from "@/lib/current-user.server";
import { ArrowLeft } from "lucide-react";

type ProfessionalReportsData = {
  viewer: { id: number; firstName: string; lastName: string; email: string } | null;
};

const getProfessionalReportsData = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = getCurrentUser();
  if (!viewer || viewer.role !== "PROFESSIONAL") {
    throw new Error("Not authorized");
  }
  return { viewer } satisfies ProfessionalReportsData;
});

export const Route = createFileRoute("/professional-reports")({
  loader: () => getProfessionalReportsData(),
  head: () => ({ meta: [{ title: "My Reports - Servio" }] }),
  component: ProfessionalReportsPage,
});

function ProfessionalReportsPage() {
  const data = useLoaderData({ from: "/professional-reports" }) as ProfessionalReportsData;
  const displayName = `${data.viewer?.firstName || ""} ${data.viewer?.lastName || ""}`.trim() || data.viewer?.email || "Professional";

  return (
    <AppShell title="My Reports" userName={displayName} userRole="Professional" userAvatarUrl={data.viewer?.email ?? undefined}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 px-4 py-8 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Button asChild variant="ghost" size="sm">
              <Link to="/professional-profile">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">My Reports</h1>
          <p className="mt-2 text-lg text-slate-600">View and export your applications, reviews, and contact requests.</p>
        </div>

        {/* Reports Component */}
        <UserPersonalReports 
          userRole="PROFESSIONAL" 
          userId={data.viewer?.id ?? 0} 
          userName={displayName}
        />
      </div>
    </AppShell>
  );
}
