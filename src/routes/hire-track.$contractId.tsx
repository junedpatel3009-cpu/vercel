import { createServerFn } from "@tanstack/react-start";
import { createFileRoute, Link, notFound, redirect, useLoaderData } from "@tanstack/react-router";
import { Briefcase, CalendarDays, DollarSign, MapPin, MessageSquare } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/current-user.server";
import { prisma } from "@/lib/prisma";

const getHireTracking = createServerFn({ method: "GET" })
  .inputValidator((contractId: string) => contractId)
  .handler(async ({ data: contractId }) => {
    const viewer = getCurrentUser();
    if (!viewer) return null;

    const account = await prisma.user.findUnique({
      where: { email: viewer.email },
      select: { id: true },
    });
    const accountId = String(account?.id ?? viewer.id);
    const contract = await prisma.hireContract.findFirst({
      where: {
        id: contractId,
        OR: [{ clientId: accountId }, { professionalId: accountId }],
      },
      include: { job: true },
    });

    if (!contract) return { viewer, contract: null };
    return {
      viewer,
      contract: {
        id: contract.id,
        status: contract.status,
        clientId: contract.clientId,
        professionalId: contract.professionalId,
        title: contract.job.title,
        description: contract.job.description,
        amount: contract.totalAmount ?? contract.job.budgetMax ?? contract.job.budgetMin,
        workMode: contract.job.jobType,
        location: contract.job.city,
        startDate: contract.startDate?.toISOString() ?? contract.job.jobDate?.toISOString() ?? null,
        deadline: contract.endDate?.toISOString() ?? contract.job.deadline?.toISOString() ?? null,
        updatedAt: contract.updatedAt.toISOString(),
      },
    };
  });

export const Route = createFileRoute("/hire-track/$contractId")({
  loader: async ({ location, params }) => {
    const result = await getHireTracking({ data: params.contractId });
    if (!result) throw redirect({ to: "/login", search: { redirect: location.href } });
    if (!result.contract) throw notFound();
    return result;
  },
  component: HireTrack,
  head: () => ({ meta: [{ title: "Track direct hire - Servio" }] }),
});

function HireTrack() {
  const { viewer, contract } = useLoaderData({ from: "/hire-track/$contractId" });
  const isProfessional = viewer.role === "PROFESSIONAL";

  return (
    <AppShell
      userName={`${viewer.firstName} ${viewer.lastName}`.trim()}
      userRole={isProfessional ? "Professional" : "Client"}
      userAvatarUrl={viewer.avatarUrl}
    >
      <main className="mx-auto max-w-4xl">
        <div className="rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.10] via-card to-card p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2"><Badge>Direct hire</Badge><Badge variant="outline">{contract.status}</Badge></div>
              <h1 className="mt-3 text-2xl font-bold">{contract.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">Your direct-hire project workspace is active.</p>
            </div>
            <Button variant="outline" asChild><Link to={isProfessional ? "/professional-messages" : "/messages"}><MessageSquare className="h-4 w-4" />Message</Link></Button>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TrackingInfo icon={DollarSign} label="Project value" value={contract.amount != null ? `$${contract.amount.toLocaleString()}` : "Not set"} />
            <TrackingInfo icon={Briefcase} label="Work mode" value={contract.workMode || "Not set"} />
            <TrackingInfo icon={CalendarDays} label="Deadline" value={formatDate(contract.deadline)} />
            <TrackingInfo icon={MapPin} label="Location" value={contract.location || "Not set"} />
          </div>
        </div>
        <section className="mt-6 rounded-2xl border bg-card p-6">
          <h2 className="font-semibold">Project brief</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{contract.description || "No project brief was added."}</p>
        </section>
      </main>
    </AppShell>
  );
}

function TrackingInfo({ icon: Icon, label, value }: { icon: typeof Briefcase; label: string; value: string }) {
  return <div className="rounded-xl border bg-background/70 p-3"><Icon className="h-4 w-4 text-primary" /><p className="mt-2 text-xs text-muted-foreground">{label}</p><p className="truncate text-sm font-medium">{value}</p></div>;
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not set" : new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}
