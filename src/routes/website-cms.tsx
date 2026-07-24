import { createServerFn } from "@tanstack/react-start";
import { createFileRoute, Link, useLoaderData, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentUser } from "@/lib/current-user.server";
import {
  listLegalPages,
  type LegalPageRecord,
  type LegalPageSlug,
  type LegalPageStatus,
} from "@/lib/legal-cms.server";

const loadWebsiteCmsData = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = getCurrentUser();
  if (!viewer || viewer.role !== "ADMIN") {
    return { viewer: null, pages: [] as LegalPageRecord[] };
  }

  return { viewer, pages: listLegalPages() };
});

const saveWebsiteCmsPage = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { slug: LegalPageSlug; title: string; content: string; status: LegalPageStatus }) =>
      input,
  )
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();
    if (!viewer || viewer.role !== "ADMIN") {
      throw new Error("Only admins can update website CMS pages.");
    }

    const { saveLegalPage } = await import("@/lib/legal-cms.server");
    return saveLegalPage(data.slug, {
      title: data.title,
      content: data.content,
      status: data.status,
    });
  });

export const Route = createFileRoute("/website-cms")({
  loader: () => loadWebsiteCmsData(),
  head: () => ({ meta: [{ title: "Website CMS - Servio Admin" }] }),
  component: WebsiteCms,
});

function WebsiteCms() {
  const data = useLoaderData({ from: "/website-cms" });
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<LegalPageSlug>("faq");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("faq");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<LegalPageStatus>("PUBLISHED");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pages = data.pages as LegalPageRecord[];
  const selectedPage = useMemo(
    () => pages.find((page) => page.slug === selectedSlug),
    [pages, selectedSlug],
  );

  useEffect(() => {
    if (!selectedPage) return;
    setIsCreating(false);
    setSlug(selectedPage.slug);
    setTitle(selectedPage.title);
    setContent(selectedPage.content);
    setStatus(selectedPage.status);
    setMessage(null);
  }, [selectedPage]);

  if (!data.viewer || data.viewer.role !== "ADMIN") {
    return (
      <div className="grid min-h-screen place-items-center bg-muted/30 px-4">
        <div className="w-full max-w-sm rounded-lg border border-border bg-white p-6 text-center shadow-soft">
          <h1 className="mt-4 text-xl font-semibold">Admin access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in from the admin panel to manage website pages.
          </p>
          <Button asChild className="mt-5 w-full bg-primary hover:bg-primary/90">
            <Link to="/admin">Open admin panel</Link>
          </Button>
        </div>
      </div>
    );
  }

  const displayName =
    `${data.viewer.firstName} ${data.viewer.lastName}`.trim() || data.viewer.email;

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const targetSlug = isCreating ? slug.trim() : selectedSlug;
      if (isCreating && !targetSlug) {
        setMessage("Page slug is required.");
        return;
      }
      const saved = await saveWebsiteCmsPage({
        data: { slug: targetSlug, title, content, status },
      });
      setSelectedSlug(saved.slug);
      setTitle(saved.title);
      setSlug(saved.slug);
      setContent(saved.content);
      setStatus(saved.status);
      setMessage(`Saved ${saved.slug}.`);
      setIsCreating(false);
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save page.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell userName={displayName} userRole="Admin" userAvatarUrl={data.viewer.avatarUrl}>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Admin / Website CMS
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Website Pages CMS</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Edit FAQ, Terms & Conditions, and Privacy Policy only.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setIsCreating(true);
              setSlug("");
              setTitle("");
              setContent("");
              setStatus("DRAFT");
              setMessage(null);
            }}
          >
            Add new page
          </Button>
          {isCreating ? (
            <p className="text-sm text-muted-foreground">Create a new footer page or legal page.</p>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-[240px_1fr]">
          <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
            <label className="text-sm font-medium text-foreground" htmlFor="legal-page-select">
              Select page
            </label>
            <select
              id="legal-page-select"
              value={selectedSlug}
              onChange={(event) => setSelectedSlug(event.target.value as LegalPageSlug)}
              className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              {pages.map((page) => (
                <option key={page.slug} value={page.slug}>
                  {page.title}
                </option>
              ))}
            </select>
            <div className="mt-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Status</p>
              <p>{status}</p>
              <p className="mt-2 font-medium text-foreground">Last updated</p>
              <p>
                {selectedPage?.updatedAt
                  ? new Date(selectedPage.updatedAt).toLocaleString()
                  : "Never"}
              </p>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-soft">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium" htmlFor="legal-page-title">
                  Page title
                </label>
                <Input
                  id="legal-page-title"
                  className="mt-2"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              {isCreating ? (
                <div>
                  <label className="text-sm font-medium" htmlFor="legal-page-slug">
                    Page slug
                  </label>
                  <Input
                    id="legal-page-slug"
                    className="mt-2"
                    value={slug}
                    onChange={(event) => setSlug(event.target.value)}
                  />
                </div>
              ) : null}
              <div>
                <label className="text-sm font-medium" htmlFor="legal-page-status">
                  Publish status
                </label>
                <select
                  id="legal-page-status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as LegalPageStatus)}
                  className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium" htmlFor="legal-page-content">
                Page content HTML
              </label>
              <Textarea
                id="legal-page-content"
                className="mt-2 min-h-[340px] font-mono text-sm"
                value={content}
                onChange={(event) => setContent(event.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {saving ? "Saving..." : isCreating ? "Create page" : "Save page"}
              </Button>
              {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
