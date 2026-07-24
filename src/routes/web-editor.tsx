import { createFileRoute, Link, useLoaderData, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ArrowLeft, ExternalLink, FileText, Pencil, Save } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/current-user.server";
import type { WebsitePageRecord, WebsitePageStatus } from "@/lib/website-page-cms.server";

const getWebEditorData = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = getCurrentUser();
  if (!viewer || viewer.role !== "ADMIN") return { viewer: null, pages: [] as WebsitePageRecord[] };
  const { listWebsitePages } = await import("@/lib/website-page-cms.server");
  return { viewer, pages: listWebsitePages() };
});

const saveWebEditorPage = createServerFn({ method: "POST" })
  .inputValidator((input: { pageKey: string; content: string; status: WebsitePageStatus }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();
    if (!viewer || viewer.role !== "ADMIN") throw new Error("Admin access required.");
    const { saveWebsitePage } = await import("@/lib/website-page-cms.server");
    return saveWebsitePage(data.pageKey, data);
  });

export const Route = createFileRoute("/web-editor")({
  loader: () => getWebEditorData(),
  head: () => ({ meta: [{ title: "Web Editor - Servio" }] }),
  component: WebEditorPage,
});

function ClientOnlyEditor({
  content,
  onChange,
}: {
  content: string;
  onChange: (value: string) => void;
}) {
  const [editorSetup, setEditorSetup] = useState<{
    CKEditorComponent: any;
    ClassicEditor: any;
    config: Record<string, unknown>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      import("@ckeditor/ckeditor5-react").then((module) => module.CKEditor),
      import("ckeditor5").then((module) => module),
      import("ckeditor5/ckeditor5.css"),
    ])
      .then(([CKEditorComponent, ckeditorModules]) => {
        if (cancelled) return;

        const config = {
          licenseKey: "GPL",
          plugins: [
            ckeditorModules.Essentials,
            ckeditorModules.Paragraph,
            ckeditorModules.Heading,
            ckeditorModules.Bold,
            ckeditorModules.Italic,
            ckeditorModules.Underline,
            ckeditorModules.Strikethrough,
            ckeditorModules.Alignment,
            ckeditorModules.RemoveFormat,
            ckeditorModules.Table,
            ckeditorModules.TableToolbar,
            ckeditorModules.List,
            ckeditorModules.SourceEditing,
            ckeditorModules.GeneralHtmlSupport,
            ckeditorModules.ImageBlock,
            ckeditorModules.ImageCaption,
            ckeditorModules.ImageStyle,
            ckeditorModules.ImageResize,
            ckeditorModules.ImageToolbar,
            ckeditorModules.ImageInsertViaUrl,
            ckeditorModules.ImageTextAlternative,
            ckeditorModules.LinkImage,
            ckeditorModules.Link,
          ],
          toolbar: {
            items: [
              "undo",
              "redo",
              "|",
              "heading",
              "|",
              "bold",
              "italic",
              "underline",
              "strikethrough",
              "removeFormat",
              "|",
              "alignment",
              "|",
              "link",
              "bulletedList",
              "numberedList",
              "|",
              "insertTable",
              "insertImageViaUrl",
              "|",
              "sourceEditing",
            ],
            shouldNotGroupWhenFull: false,
          },
          image: {
            toolbar: [
              "imageStyle:inline",
              "imageStyle:block",
              "imageStyle:side",
              "|",
              "toggleImageCaption",
              "imageTextAlternative",
              "linkImage",
            ],
          },
          table: { contentToolbar: ["tableColumn", "tableRow", "mergeTableCells"] },
          link: { addTargetToExternalLinks: true, defaultProtocol: "https://" },
          htmlSupport: {
            allow: [{ name: /.*/, attributes: true, classes: true, styles: true }],
          },
        };

        setEditorSetup({
          CKEditorComponent,
          ClassicEditor: ckeditorModules.ClassicEditor,
          config,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setEditorSetup(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!editorSetup) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
        Loading editor...
      </div>
    );
  }

  const { CKEditorComponent, ClassicEditor, config } = editorSetup;

  return (
    <CKEditorComponent
      editor={ClassicEditor}
      config={config}
      data={content}
      onChange={(_, editor) => onChange(editor.getData())}
    />
  );
}

function WebEditorPage() {
  const data = useLoaderData({ from: "/web-editor" });
  const router = useRouter();
  const [pages, setPages] = useState<WebsitePageRecord[]>(data.pages);
  const [selectedPageKey, setSelectedPageKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const selectedPage = pages.find((page) => page.pageKey === selectedPageKey) || null;

  if (!data.viewer || data.viewer.role !== "ADMIN") {
    return (
      <div className="grid min-h-screen place-items-center bg-muted/30 px-4">
        <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-center">
          <h1 className="text-xl font-semibold">Admin access required</h1>
          <Button asChild className="mt-5 w-full">
            <Link to="/admin">Open admin panel</Link>
          </Button>
        </div>
      </div>
    );
  }

  const displayName =
    `${data.viewer.firstName} ${data.viewer.lastName}`.trim() || data.viewer.email;

  async function persistPage(status: WebsitePageStatus) {
    if (!selectedPage) return;
    setSaving(true);
    setMessage(null);
    try {
      const saved = await saveWebEditorPage({
        data: { pageKey: selectedPage.pageKey, content: selectedPage.content, status },
      });
      setPages((current) => current.map((page) => (page.pageKey === saved.pageKey ? saved : page)));
      await router.invalidate();
      setMessage(
        status === "PUBLISHED" ? "Page published." : "Draft saved. The public page is unchanged.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save page.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell userName={displayName} userRole="Admin" userAvatarUrl={data.viewer.avatarUrl}>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Admin / Website editor
        </p>
        <h1 className="mt-1 text-3xl font-semibold">
          {selectedPage?.title || "Web Page UI Editor"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {selectedPage
            ? "Edit visually or use Source Editing for HTML, then save as a draft or publish."
            : "Choose a public page to edit."}
        </p>
        {selectedPage?.pageKey === "home" ? (
          <p className="mt-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
            Home keeps its live jobs and professionals. Only the first &lt;section&gt; in this
            editor is published; edit the Welcome section at the top.
          </p>
        ) : null}
      </div>

      {!selectedPage ? (
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Website pages</h2>
            <p className="text-sm text-muted-foreground">
              Published editor content replaces the coded page. Drafts do not affect the public
              site.
            </p>
          </div>
          <div className="divide-y">
            {pages.map((page) => (
              <div key={page.pageKey} className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-medium">{page.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {page.path} · {page.status === "PUBLISHED" ? "Published" : "Draft"}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    setSelectedPageKey(page.pageKey);
                    setMessage(null);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Open Editor
                </Button>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => setSelectedPageKey(null)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to page list
            </Button>
            <Button asChild variant="outline">
              <a href={selectedPage.path} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                View page
              </a>
            </Button>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${selectedPage.status === "PUBLISHED" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}
            >
              {selectedPage.status}
            </span>
          </div>
          <section className="website-ckeditor full-page-ckeditor rounded-2xl border border-border bg-card p-4 shadow-soft">
            <ClientOnlyEditor
              content={selectedPage.content}
              onChange={(value) =>
                setPages((current) =>
                  current.map((page) =>
                    page.pageKey === selectedPage.pageKey ? { ...page, content: value } : page,
                  ),
                )
              }
            />
          </section>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button disabled={saving} variant="outline" onClick={() => persistPage("DRAFT")}>
              <Save className="mr-2 h-4 w-4" />
              Save draft
            </Button>
            <Button disabled={saving} onClick={() => persistPage("PUBLISHED")}>
              {saving ? "Saving..." : "Publish page"}
            </Button>
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          </div>
        </>
      )}
    </AppShell>
  );
}
