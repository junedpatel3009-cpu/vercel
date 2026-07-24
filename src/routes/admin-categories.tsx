import { createServerFn } from "@tanstack/react-start";
import { createFileRoute, Link, useLoaderData, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, FolderKanban, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReportExportActions } from "@/components/ReportExportActions";
import { Textarea } from "@/components/ui/textarea";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSection } from "@/components/admin/AdminSection";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { getCurrentUser } from "@/lib/current-user.server";
import {
  createServiceCategory,
  deleteServiceCategory,
  getServiceCategories,
  type ServiceCategoryInput,
  type ServiceCategoryRecord,
  updateServiceCategory,
} from "@/lib/services-db.server";

const loadAdminCategoriesData = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = getCurrentUser();
  if (!viewer || viewer.role !== "ADMIN") {
    return { viewer: null, categories: [] as ServiceCategoryRecord[] };
  }

  return {
    viewer,
    categories: getServiceCategories(),
  };
});

const saveServiceCategory = createServerFn({ method: "POST" })
  .inputValidator((input: { id?: number } & ServiceCategoryInput) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();
    if (!viewer || viewer.role !== "ADMIN") {
      throw new Error("Only admins can manage service categories.");
    }

    if (data.id) {
      return updateServiceCategory(data.id, data);
    }

    return createServiceCategory(data);
  });

const removeServiceCategory = createServerFn({ method: "POST" })
  .inputValidator((input: { id: number }) => input)
  .handler(async ({ data }) => {
    const viewer = getCurrentUser();
    if (!viewer || viewer.role !== "ADMIN") {
      throw new Error("Only admins can manage service categories.");
    }

    return deleteServiceCategory(data.id);
  });

export const Route = createFileRoute("/admin-categories")({
  loader: () => loadAdminCategoriesData(),
  head: () => ({ meta: [{ title: "Service Categories - Servio" }] }),
  component: AdminCategories,
});

function AdminCategories() {
  const data = useLoaderData({ from: "/admin-categories" });
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: "success" | "error" } | null>(null);
  const [categoryForm, setCategoryForm] = useState<ServiceCategoryInput>({
    name: "",
    slug: "",
    description: "",
    iconName: "",
    sortOrder: 0,
  });

  const categories = data.categories as ServiceCategoryRecord[];
  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedId) ?? null,
    [categories, selectedId],
  );

  useEffect(() => {
    if (selectedCategory) {
      setCategoryForm({
        name: selectedCategory.name,
        slug: selectedCategory.slug,
        description: selectedCategory.description,
        iconName: selectedCategory.iconName,
        sortOrder: selectedCategory.sortOrder,
      });
      return;
    }

    setCategoryForm({
      name: "",
      slug: "",
      description: "",
      iconName: "",
      sortOrder: 0,
    });
  }, [selectedCategory]);

  const filteredCategories = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return categories;
    }

    return categories.filter((category) =>
      [category.name, category.slug, category.description, category.iconName]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [categories, search]);

  const isEditing = selectedCategory !== null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSaving(true);

    try {
      await saveServiceCategory({
        data: {
          id: selectedCategory?.id,
          name: categoryForm.name,
          slug: categoryForm.slug,
          description: categoryForm.description,
          iconName: categoryForm.iconName,
          sortOrder: categoryForm.sortOrder,
        },
      });

      await router.invalidate();
      setMessage({ text: "Category saved successfully.", type: "success" });
      if (!selectedCategory) {
        setSelectedId(null);
      }
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Failed to save category.", type: "error" });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedCategory) return;

    if (!confirm("Are you sure you want to delete this category? This action cannot be undone.")) return;

    setMessage(null);
    setIsDeleting(true);
    try {
      await removeServiceCategory({ data: { id: selectedCategory.id } });
      await router.invalidate();
      setSelectedId(null);
      setMessage({ text: "Category deleted.", type: "success" });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Failed to delete category.", type: "error" });
    } finally {
      setIsDeleting(false);
    }
  }

  if (!data.viewer || data.viewer.role !== "ADMIN") {
    return (
      <div className="grid min-h-screen place-items-center bg-muted/30 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
          <ShieldCheck className="mx-auto h-8 w-8 text-primary" />
          <h1 className="mt-6 text-xl font-bold">Admin access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in from the admin panel to manage service categories.
          </p>
          <Button asChild className="mt-8 w-full">
            <Link to="/admin">Open admin panel</Link>
          </Button>
        </div>
      </div>
    );
  }

  const displayName =
    `${data.viewer.firstName} ${data.viewer.lastName}`.trim() || data.viewer.email;

  return (
    <AppShell userName={displayName} userRole="Admin" userAvatarUrl={data.viewer.avatarUrl}>
      <AdminPageHeader
        title="Service Categories"
        description="Manage the directory of service types used for job posts and professional profiles."
        breadcrumbs={[{ label: "Categories" }]}
        actions={
          <div className="flex gap-2">
            <ReportExportActions
              table="ServiceCategory"
              reportName="Admin categories export"
              variant="outline"
            />
            <Button asChild variant="outline">
              <Link to="/admin">Back to admin</Link>
            </Button>
            <Button
              className="gap-2 rounded-xl font-bold h-10 px-6"
              onClick={() => {
                setSelectedId(null);
                setMessage(null);
              }}
            >
              <Plus className="h-4 w-4" />
              Create Category
            </Button>
          </div>
        }
      />

      <div className="grid gap-8 xl:grid-cols-[400px_1fr]">
        <AdminSection
          title="Browse Categories"
          description={`${categories.length} items defined`}
          icon={FolderKanban}
          actions={
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Quick search..."
                className="pl-9 h-9 rounded-lg"
              />
            </div>
          }
        >
          <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar bg-muted/20">
            {filteredCategories.length ? (
              filteredCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedId(category.id)}
                  className={cn(
                    "block w-full rounded-2xl border p-5 text-left transition-all hover:shadow-md active:scale-[0.98]",
                    selectedId === category.id
                      ? "border-primary bg-primary/[0.03] ring-1 ring-primary/20 shadow-sm"
                      : "border-border bg-background hover:border-primary/40"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={cn("font-bold text-lg truncate", selectedId === category.id ? "text-primary" : "text-foreground")}>{category.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-1 font-medium italic">"{category.description}"</p>
                    </div>
                    <Badge variant="outline" className="rounded-lg h-6 font-bold text-[9px] uppercase tracking-wider bg-background shrink-0">
                      {category.jobCount} Jobs
                    </Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                    <div className="flex items-center gap-1.5"><span className="text-primary/40">SLUG:</span> <span className="text-foreground/80">{category.slug}</span></div>
                    <div className="flex items-center gap-1.5"><span className="text-primary/40">ICON:</span> <span className="text-foreground/80">{category.iconName || "NONE"}</span></div>
                    <div className="flex items-center gap-1.5"><span className="text-primary/40">ORDER:</span> <span className="text-foreground/80">{category.sortOrder}</span></div>
                    <div className="flex items-center gap-1.5"><span className="text-primary/40">PROS:</span> <span className="text-foreground/80">{category.proCount}</span></div>
                  </div>
                </button>
              ))
            ) : (
              <AdminEmptyState
                title="No categories found"
                description="Try a different search term or create a new category."
                className="py-12"
              />
            )}
          </div>
        </AdminSection>

        <AdminSection
          title={isEditing ? "Modify Category" : "Register New Category"}
          description={isEditing ? "Update platform category details." : "Add a fresh work vertical to the marketplace."}
          icon={BriefcaseBusiness}
          actions={isEditing && (
            <Button variant="destructive" size="sm" className="rounded-xl font-bold h-9 px-4" onClick={handleDelete} disabled={isDeleting}>
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? "DELETING..." : "DELETE"}
            </Button>
          )}
        >
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1" htmlFor="category-name">
                  Category Name
                </label>
                <Input
                  id="category-name"
                  value={categoryForm.name}
                  onChange={(event) =>
                    setCategoryForm((current) => ({ ...current, name: event.target.value }))
                  }
                  required
                  placeholder="e.g. Graphic Design"
                  className="h-12 rounded-xl bg-background border-border shadow-sm focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1" htmlFor="category-slug">
                  URL Slug
                </label>
                <Input
                  id="category-slug"
                  value={categoryForm.slug}
                  onChange={(event) =>
                    setCategoryForm((current) => ({ ...current, slug: event.target.value }))
                  }
                  placeholder="e.g. graphic-design"
                  className="h-12 rounded-xl bg-background border-border shadow-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1" htmlFor="category-icon">
                  Lucide Icon Name
                </label>
                <Input
                  id="category-icon"
                  value={categoryForm.iconName}
                  onChange={(event) =>
                    setCategoryForm((current) => ({ ...current, iconName: event.target.value }))
                  }
                  placeholder="e.g. Palette, Code, Camera"
                  className="h-12 rounded-xl bg-background border-border shadow-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1" htmlFor="category-sort-order">
                  Sort Priority (Order)
                </label>
                <Input
                  id="category-sort-order"
                  type="number"
                  value={categoryForm.sortOrder ?? 0}
                  onChange={(event) =>
                    setCategoryForm((current) => ({
                      ...current,
                      sortOrder: Number(event.target.value) || 0,
                    }))
                  }
                  className="h-12 rounded-xl bg-background border-border shadow-sm font-bold tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1" htmlFor="category-description">
                Marketplace Description
              </label>
              <Textarea
                id="category-description"
                value={categoryForm.description}
                onChange={(event) =>
                  setCategoryForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Describe what kind of services fall under this category..."
                className="min-h-[120px] rounded-xl bg-background border-border shadow-sm p-4 leading-relaxed"
              />
            </div>

            {message && (
              <div className={cn(
                "rounded-xl p-4 text-sm font-bold flex items-center gap-2 animate-in fade-in duration-300",
                message.type === "error" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              )}>
                {message.type === "error" ? <Trash2 className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                {message.text}
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-4">
              <Button type="submit" size="lg" className="h-12 px-8 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all active:scale-95" disabled={isSaving}>
                {isSaving ? "SAVING RECORD..." : isEditing ? "UPDATE CATEGORY" : "REGISTER CATEGORY"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-12 px-8 rounded-xl font-bold"
                onClick={() => {
                  setSelectedId(null);
                  setMessage(null);
                }}
              >
                CLEAR FORM
              </Button>
            </div>
          </form>
        </AdminSection>
      </div>
    </AppShell>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
