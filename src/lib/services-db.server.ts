import { prisma } from "@/lib/prisma";

export type ServiceCategoryRecord = {
  id: number;
  name: string;
  slug: string;
  description: string;
  iconName: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  proCount: number;
  jobCount: number;
};

export type ServiceCategoryInput = {
  name: string;
  slug?: string;
  description?: string;
  iconName?: string;
  sortOrder?: number;
};

async function ensureServiceCategories() {
  const count = await prisma.serviceCategory.count();
  if (count > 0) return;

  const now = new Date();
  await prisma.$transaction(
    [
      "Home Services",
      "Development",
      "Design",
      "Photography",
      "Marketing",
      "Tutoring",
      "Repair",
      "Cleaning",
      "Moving",
      "Events",
      "Business",
      "Wellness",
    ].map((name, index) =>
      prisma.serviceCategory.create({
        data: {
          name,
          slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
          iconName: {
            "Home Services": "Wrench",
            Development: "Code",
            Design: "Paintbrush",
            Photography: "Camera",
            Marketing: "Megaphone",
            Tutoring: "GraduationCap",
            Repair: "Hammer",
            Cleaning: "Sparkles",
            Moving: "Truck",
            Events: "Music",
            Business: "Briefcase",
            Wellness: "HeartPulse",
          }[name] ?? "",
          sortOrder: index + 1,
          createdAt: now,
          updatedAt: now,
        },
      }),
    ),
  );
}

export async function getServiceCategories() {
  await ensureServiceCategories();

  const categories = await prisma.serviceCategory.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return Promise.all(
    categories.map(async (category) => ({
      ...category,
      proCount: await prisma.user.count({
        where: {
          professionalCategory: category.name,
          role: "PROFESSIONAL",
          isActive: true,
        },
      }),
      jobCount: await prisma.clientJob.count({
        where: {
          category: category.name,
          status: "OPEN",
        },
      }),
    })),
  );
}

export async function getTotalProfessionalsCount(): Promise<number> {
  return prisma.user.count({
    where: {
      role: "PROFESSIONAL",
      isActive: true,
    },
  });
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function getServiceCategoryById(id: number) {
  const category = await prisma.serviceCategory.findUnique({
    where: { id },
  });

  if (!category) return undefined;

  const [proCount, jobCount] = await Promise.all([
    prisma.user.count({
      where: {
        professionalCategory: category.name,
        role: "PROFESSIONAL",
        isActive: true,
      },
    }),
    prisma.clientJob.count({
      where: {
        category: category.name,
        status: "OPEN",
      },
    }),
  ]);

  return {
    ...category,
    proCount,
    jobCount,
  };
}

export async function createServiceCategory(input: ServiceCategoryInput) {
  const slug = input.slug ? slugify(input.slug) : slugify(input.name);
  const now = new Date();

  const category = await prisma.serviceCategory.create({
    data: {
      name: input.name.trim(),
      slug,
      description: input.description?.trim() ?? "",
      iconName: input.iconName?.trim() ?? "",
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    },
  });

  return getServiceCategoryById(category.id);
}

export async function updateServiceCategory(id: number, input: ServiceCategoryInput) {
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.slug !== undefined) data.slug = slugify(input.slug);
  if (input.description !== undefined) data.description = input.description.trim();
  if (input.iconName !== undefined) data.iconName = input.iconName.trim();
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  if (!Object.keys(data).length) return getServiceCategoryById(id);

  data.updatedAt = new Date();

  await prisma.serviceCategory.update({
    where: { id },
    data,
  });

  return getServiceCategoryById(id);
}

export async function deleteServiceCategory(id: number) {
  const result = await prisma.serviceCategory.deleteMany({ where: { id } });
  return result.count > 0;
}
