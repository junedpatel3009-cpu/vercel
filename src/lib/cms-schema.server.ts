import { prisma } from "@/lib/prisma";

let cmsSchemaInitializationPromise: Promise<void> | undefined;

export async function ensureCmsSchema() {
  if (cmsSchemaInitializationPromise) {
    return cmsSchemaInitializationPromise;
  }

  cmsSchemaInitializationPromise = (async () => {
    const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'WebsitePage'
    ) AS "exists"
  `;

  const websitePageExists = result?.[0]?.exists ?? false;
  if (!websitePageExists) {
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'CmsPageStatus'
        ) THEN
          CREATE TYPE "CmsPageStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'WebsitePage'
        ) THEN
          CREATE TABLE "WebsitePage" (
            "pageKey" TEXT NOT NULL PRIMARY KEY,
            "path" TEXT NOT NULL UNIQUE,
            "title" TEXT NOT NULL,
            "content" TEXT NOT NULL DEFAULT '',
            "status" "CmsPageStatus" NOT NULL DEFAULT 'DRAFT',
            "updatedAt" TIMESTAMP(3) NOT NULL
          );
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'LegalPage'
        ) THEN
          CREATE TABLE "LegalPage" (
            "slug" TEXT NOT NULL PRIMARY KEY,
            "title" TEXT NOT NULL,
            "content" TEXT NOT NULL DEFAULT '',
            "status" "CmsPageStatus" NOT NULL DEFAULT 'PUBLISHED',
            "updatedAt" TIMESTAMP(3) NOT NULL
          );
        END IF;
      END$$;
    `);
  }
})();

  return cmsSchemaInitializationPromise;
}
