import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { issueAccessToken, opaqueToken, readAccessToken, tokenHash } from "./auth.server";
import { getApiDatabase } from "./database.server";
import { ApiError, body, errorResponse, json } from "./http.server";
import { sendAccountLink } from "./email.server";
import { readSessionFromCookieHeader } from "@/lib/auth-session.server";
import { hashPassword, verifyPassword } from "@/lib/password.server";
import {
  createUserRecord,
  findUserByEmail,
  findUserById,
  updateUserPasswordByEmail,
  type PublicUser,
  type UserRole,
} from "@/lib/user-db.server";
import { listWebsitePages, saveWebsitePage } from "@/lib/website-page-cms.server";
import { clientJobSchema, type ClientJobInput } from "@/lib/validation/client-job";
import {
  createClientJob,
  deleteClientJob,
  getClientJobById,
  getClientJobsByUserId,
  getOpenClientJobs,
  updateClientJob,
} from "@/lib/job-db.server";
import {
  createProjectRequest,
  getClientProjectRequests,
  getProfessionalProjectRequests,
  getProfessionalTransactions,
  getProfessionalWithdrawals,
  createProfessionalWithdrawalRequest,
  rateCompletedProject,
} from "@/lib/project-request-db.server";
import { createHireContract } from "@/lib/hire-db.server";
import { getUserNotifications, markUserNotificationsRead } from "@/lib/notification-db.server";
import {
  getAdminDashboardSnapshot,
  getAdminJobRecords,
  getAdminPaymentTransactions,
} from "@/lib/admin-dashboard-db.server";
import {
  getAdminUsers,
  updateProfessionalVerifiedStatusByAdmin,
  updateUserActiveStatusByAdmin,
} from "@/lib/user-db.server";

const API_PREFIX = "/api/v1";
const email = z
  .string()
  .trim()
  .email()
  .transform((value) => value.toLowerCase());
const registration = z.object({
  role: z.enum(["CLIENT", "PROFESSIONAL"]),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email,
  phone: z.string().trim().max(30).nullable().optional(),
  password: z.string().min(8).max(128),
});
const login = z.object({ email, password: z.string().min(1).max(128) });
const profile = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  companyName: z.string().trim().max(160).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  professionalCategory: z.string().trim().max(120).nullable().optional(),
  professionalCity: z.string().trim().max(120).nullable().optional(),
  skills: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  hourlyRate: z.number().int().nonnegative().nullable().optional(),
  serviceRadiusKm: z.number().int().positive().max(1000).nullable().optional(),
});

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new ApiError(422, "Validation failed.", result.error.flatten());
  return result.data;
}

function publicAccount(user: ReturnType<typeof findUserByEmail> | PublicUser) {
  if (!user) return null;
  const { id, role, firstName, lastName, email, phone, avatarUrl, authProvider } = user;
  return { id, role, firstName, lastName, email, phone, avatarUrl, authProvider };
}

function currentUser(request: Request, roles?: UserRole[]) {
  const jwt = readAccessToken(request);
  const session = readSessionFromCookieHeader(request.headers.get("cookie"));
  const id = jwt?.sub ?? session?.userId;
  const user = id ? findUserById(id) : null;
  const account = user ? findUserByEmail(user.email) : null;
  if (!user || !account?.isActive) throw new ApiError(401, "Authentication required.");
  if (roles && !roles.includes(user.role))
    throw new ApiError(403, "You do not have permission to perform this action.");
  return user;
}

function match(pathname: string, pattern: RegExp) {
  return pathname.match(pattern);
}
function now() {
  return new Date().toISOString();
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
}

export async function handleBackendApi(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(API_PREFIX)) return null;
  const startedAt = Date.now();
  const requestId = request.headers.get("x-request-id") || randomUUID();
  try {
    const response = await route(request, url);
    response.headers.set("x-request-id", requestId);
    console.info(
      JSON.stringify({
        level: "info",
        requestId,
        method: request.method,
        path: url.pathname,
        status: response.status,
        durationMs: Date.now() - startedAt,
      }),
    );
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

async function route(request: Request, url: URL): Promise<Response> {
  const db = getApiDatabase();
  const method = request.method;
  const pathname = url.pathname;

  if (method === "GET" && pathname === `${API_PREFIX}/health`)
    return json({ ok: true, database: "connected", timestamp: now() });
  if (method === "POST" && pathname === `${API_PREFIX}/auth/register`) {
    const input = parse(registration, await body(request));
    if (findUserByEmail(input.email)) throw new ApiError(409, "Email is already registered.");
    const user = createUserRecord({
      ...input,
      phone: input.phone ?? null,
      passwordHash: hashPassword(input.password),
      authProvider: "LOCAL",
    });
    const verificationToken = createAccountToken(user.id, "EMAIL_VERIFY", 24 * 60);
    const verificationEmailSent = await sendAccountLink(user.email, "verify", verificationToken);
    return json(
      {
        user: publicAccount(user),
        accessToken: issueAccessToken(user),
        verificationEmailSent,
        verificationToken: process.env.NODE_ENV === "production" ? undefined : verificationToken,
      },
      201,
    );
  }
  if (method === "POST" && pathname === `${API_PREFIX}/auth/login`) {
    const input = parse(login, await body(request));
    const user = findUserByEmail(input.email);
    const check = await verifyPassword(input.password, user?.passwordHash ?? null);
    if (!user || !user.isActive || !check.valid)
      throw new ApiError(401, "Invalid email or password.");
    if (check.needsUpgrade) updateUserPasswordByEmail(user.email, hashPassword(input.password));
    return json({ user: publicAccount(user), accessToken: issueAccessToken(user) });
  }
  if (method === "GET" && pathname === `${API_PREFIX}/auth/me`)
    return json(publicAccount(currentUser(request)));
  if (method === "POST" && pathname === `${API_PREFIX}/auth/verify-email`) {
    const input = parse(z.object({ token: z.string().min(20) }), await body(request));
    consumeAccountToken(input.token, "EMAIL_VERIFY", (userId) =>
      db
        .prepare(`UPDATE "User" SET emailVerifiedAt = ?, updatedAt = ? WHERE id = ?`)
        .run(now(), now(), userId),
    );
    return json({ verified: true });
  }
  if (method === "POST" && pathname === `${API_PREFIX}/auth/password/forgot`) {
    const input = parse(z.object({ email }), await body(request));
    const user = findUserByEmail(input.email);
    const resetToken = user ? createAccountToken(user.id, "PASSWORD_RESET", 30) : undefined;
    if (user && resetToken) await sendAccountLink(user.email, "reset", resetToken);
    return json({
      accepted: true,
      resetToken: process.env.NODE_ENV === "production" ? undefined : resetToken,
    });
  }
  if (method === "POST" && pathname === `${API_PREFIX}/auth/password/reset`) {
    const input = parse(
      z.object({ token: z.string().min(20), password: z.string().min(8).max(128) }),
      await body(request),
    );
    consumeAccountToken(input.token, "PASSWORD_RESET", (userId) => {
      const user = findUserById(userId);
      if (!user) throw new ApiError(404, "Account not found.");
      updateUserPasswordByEmail(user.email, hashPassword(input.password));
    });
    return json({ reset: true });
  }

  if (method === "GET" && pathname === `${API_PREFIX}/profile`)
    return json(publicAccount(currentUser(request)));
  if (method === "PATCH" && pathname === `${API_PREFIX}/profile`) {
    const user = currentUser(request);
    const input = parse(profile, await body(request));
    const fields: Record<string, unknown> = { ...input };
    if (input.skills) {
      fields.professionalSkillsJson = JSON.stringify(input.skills);
      delete fields.skills;
    }
    const allowed = Object.entries(fields);
    if (allowed.length)
      db.prepare(
        `UPDATE "User" SET ${allowed.map(([key]) => `"${key}" = ?`).join(", ")}, "updatedAt" = ? WHERE id = ?`,
      ).run(...allowed.map(([, value]) => value), now(), user.id);
    return json(publicAccount(findUserById(user.id)!));
  }

  if (method === "GET" && pathname === `${API_PREFIX}/jobs`) {
    currentUser(request);
    return json(getOpenClientJobs());
  }
  if (method === "GET" && pathname === `${API_PREFIX}/categories`) {
    return json(db.prepare(`SELECT * FROM "ServiceCategory" ORDER BY sortOrder,id`).all());
  }
  if (method === "GET" && pathname === `${API_PREFIX}/services`) {
    return json(db.prepare(`SELECT * FROM "Service" WHERE isActive=1 ORDER BY id DESC`).all());
  }
  if (method === "GET" && pathname === `${API_PREFIX}/client/jobs`) {
    const user = currentUser(request, ["CLIENT"]);
    return json(getClientJobsByUserId(user.id));
  }
  if (method === "POST" && pathname === `${API_PREFIX}/client/jobs`) {
    const user = currentUser(request, ["CLIENT"]);
    return json(
      createClientJob(user.id, parse(clientJobSchema, await body(request)) as ClientJobInput),
      201,
    );
  }
  let routeMatch = match(pathname, new RegExp(`^${API_PREFIX}/client/jobs/(\\d+)$`));
  if (routeMatch && method === "GET") {
    const user = currentUser(request, ["CLIENT"]);
    const result = getClientJobById(user.id, Number(routeMatch[1]));
    if (!result) throw new ApiError(404, "Job not found.");
    return json(result);
  }
  if (routeMatch && method === "PATCH") {
    const user = currentUser(request, ["CLIENT"]);
    const result = updateClientJob(
      user.id,
      Number(routeMatch[1]),
      parse(clientJobSchema, await body(request)) as ClientJobInput,
    );
    if (!result) throw new ApiError(404, "Job not found.");
    return json(result);
  }
  if (routeMatch && method === "DELETE") {
    const user = currentUser(request, ["CLIENT"]);
    if (!deleteClientJob(user.id, Number(routeMatch[1]))) throw new ApiError(404, "Job not found.");
    return json({ cancelled: true });
  }
  if (method === "GET" && pathname === `${API_PREFIX}/client/applications`) {
    const user = currentUser(request, ["CLIENT"]);
    return json(getClientProjectRequests(user.id));
  }
  if (method === "POST" && pathname === `${API_PREFIX}/client/hire`) {
    const user = currentUser(request, ["CLIENT"]);
    return json(createHireContract(user.id, (await body(request)) as never), 201);
  }
  if (method === "POST" && pathname === `${API_PREFIX}/client/reviews`) {
    const user = currentUser(request, ["CLIENT"]);
    const input = parse(
      z.object({
        trackingId: z.number().int().positive(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().trim().max(2000).optional(),
      }),
      await body(request),
    );
    return json(rateCompletedProject(user.id, input), 201);
  }

  if (method === "POST" && pathname === `${API_PREFIX}/professional/applications`) {
    const user = currentUser(request, ["PROFESSIONAL"]);
    const input = parse(
      z.object({
        jobId: z.number().int().positive(),
        bidAmount: z.number().int().positive().nullable(),
        duration: z.string().trim().max(120),
        coverLetter: z.string().trim().min(20).max(4000),
        attachments: z
          .array(
            z.object({
              fileName: z.string(),
              fileType: z.string().optional(),
              fileSize: z.number().optional(),
              fileUrl: z.string().optional(),
            }),
          )
          .max(10)
          .optional(),
      }),
      await body(request),
    );
    return json(createProjectRequest({ ...input, professionalId: user.id }), 201);
  }
  if (method === "POST" && pathname === `${API_PREFIX}/professional/services`) {
    const user = currentUser(request, ["PROFESSIONAL"]);
    const input = parse(
      z.object({
        categoryId: z.number().int().positive(),
        name: z.string().trim().min(2).max(160),
        description: z.string().trim().min(20).max(4000),
        price: z.number().int().nonnegative().nullable().optional(),
        imageUrl: z.string().url().nullable().optional(),
      }),
      await body(request),
    );
    const stamp = now();
    const result = db
      .prepare(
        `INSERT INTO "Service" (categoryId,professionalId,name,description,price,imageUrl,isActive,createdAt,updatedAt) VALUES (?,?,?,?,?,?,1,?,?)`,
      )
      .run(
        input.categoryId,
        user.id,
        input.name,
        input.description,
        input.price ?? null,
        input.imageUrl ?? null,
        stamp,
        stamp,
      );
    return json(
      db.prepare(`SELECT * FROM "Service" WHERE id=?`).get(Number(result.lastInsertRowid)),
      201,
    );
  }
  if (method === "GET" && pathname === `${API_PREFIX}/professional/jobs/history`) {
    const user = currentUser(request, ["PROFESSIONAL"]);
    return json(getProfessionalProjectRequests(user.id));
  }
  if (method === "GET" && pathname === `${API_PREFIX}/professional/earnings`) {
    const user = currentUser(request, ["PROFESSIONAL"]);
    return json({
      transactions: getProfessionalTransactions(user.id),
      withdrawals: getProfessionalWithdrawals(user.id),
    });
  }
  if (method === "POST" && pathname === `${API_PREFIX}/professional/payouts`) {
    const user = currentUser(request, ["PROFESSIONAL"]);
    const input = parse(
      z.object({
        amount: z.number().int().positive(),
        destinationType: z.enum(["BANK", "UPI", "WALLET"]),
        destinationLabel: z.string().trim().min(2).max(200),
        note: z.string().trim().max(500).optional(),
      }),
      await body(request),
    );
    return json(createProfessionalWithdrawalRequest(user.id, input), 201);
  }

  if (method === "GET" && pathname === `${API_PREFIX}/notifications`) {
    const user = currentUser(request);
    return json(getUserNotifications(user.id, user.role));
  }
  if (method === "POST" && pathname === `${API_PREFIX}/notifications/read`) {
    const user = currentUser(request);
    return json(markUserNotificationsRead(user.id, user.role));
  }
  if (method === "POST" && pathname === `${API_PREFIX}/notifications/browser-subscriptions`) {
    const user = currentUser(request);
    const input = parse(
      z.object({ endpoint: z.string().url(), p256dh: z.string().min(1), auth: z.string().min(1) }),
      await body(request),
    );
    db.prepare(
      `INSERT INTO "BrowserSubscription" (userId, endpoint, p256dh, auth, createdAt) VALUES (?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET userId=excluded.userId,p256dh=excluded.p256dh,auth=excluded.auth`,
    ).run(user.id, input.endpoint, input.p256dh, input.auth, now());
    return json({ subscribed: true }, 201);
  }

  if (method === "GET" && pathname === `${API_PREFIX}/maps/address-search`) {
    currentUser(request);
    const query = z.string().trim().min(3).parse(url.searchParams.get("q"));
    const endpoint = process.env.GEOCODING_API_URL || "https://nominatim.openstreetmap.org/search";
    const response = await fetch(
      `${endpoint}?format=jsonv2&limit=8&q=${encodeURIComponent(query)}`,
      { headers: { "user-agent": process.env.GEOCODING_USER_AGENT || "Servio/1.0" } },
    );
    if (!response.ok) throw new ApiError(502, "Address provider is unavailable.");
    return json(await response.json());
  }
  if (method === "POST" && pathname === `${API_PREFIX}/maps/distance`) {
    currentUser(request);
    const input = parse(
      z.object({
        from: z.object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
        }),
        to: z.object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
        }),
      }),
      await body(request),
    );
    return json({
      kilometers: haversine(
        input.from.latitude,
        input.from.longitude,
        input.to.latitude,
        input.to.longitude,
      ),
    });
  }
  if (method === "GET" && pathname === `${API_PREFIX}/maps/nearby-services`) {
    currentUser(request);
    const latitude = Number(url.searchParams.get("latitude"));
    const longitude = Number(url.searchParams.get("longitude"));
    const radius = Math.min(Number(url.searchParams.get("radiusKm") || 25), 500);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
      throw new ApiError(422, "latitude and longitude are required.");
    const users = db
      .prepare(
        `SELECT id, firstName, lastName, professionalCategory, professionalCity, serviceArea, serviceRadiusKm, averageRating FROM "User" WHERE role='PROFESSIONAL' AND isActive=1 AND isVerified=1`,
      )
      .all();
    return json({ center: { latitude, longitude }, radiusKm: radius, professionals: users });
  }

  if (method === "POST" && pathname === `${API_PREFIX}/files`) return uploadFile(request);
  routeMatch = match(pathname, new RegExp(`^${API_PREFIX}/files/(\\d+)/access$`));
  if (routeMatch && method === "GET") {
    const user = currentUser(request);
    const file = db.prepare(`SELECT * FROM "StoredFile" WHERE id=?`).get(Number(routeMatch[1])) as
      | { id: number; ownerId: number; isPublic: number }
      | undefined;
    if (!file || (!file.isPublic && file.ownerId !== user.id && user.role !== "ADMIN"))
      throw new ApiError(404, "File not found.");
    const expires = Date.now() + 300000;
    return json({
      url: `${API_PREFIX}/files/${file.id}/content?expires=${expires}&signature=${fileSignature(file.id, expires)}`,
    });
  }
  // DELETE stored file (owner or admin only)
  routeMatch = match(pathname, new RegExp(`^${API_PREFIX}/files/(\\d+)$`));
  if (routeMatch && method === "DELETE") {
    const user = currentUser(request);
    const id = Number(routeMatch[1]);
    const row = db.prepare(`SELECT * FROM "StoredFile" WHERE id=?`).get(id) as
      | { id: number; ownerId: number; storageKey: string }
      | undefined;
    if (!row) throw new ApiError(404, "File not found.");
    if (row.ownerId !== user.id && user.role !== "ADMIN") throw new ApiError(403, "Not allowed.");
    const root = path.resolve(process.cwd(), process.env.FILE_STORAGE_PATH || "storage");
    const target = path.resolve(root, row.storageKey);
    if (!target.startsWith(root)) throw new ApiError(400, "Invalid storage path.");
    try {
      await unlink(target).catch(() => {});
    } catch {}
    db.prepare(`DELETE FROM "StoredFile" WHERE id=?`).run(id);
    return json({ ok: true });
  }
  routeMatch = match(pathname, new RegExp(`^${API_PREFIX}/files/(\\d+)/content$`));
  if (routeMatch && method === "GET") return downloadFile(Number(routeMatch[1]), url);

  if (method === "GET" && pathname === `${API_PREFIX}/wallet`) {
    const user = currentUser(request);
    ensureWallet(user.id);
    const wallet = db.prepare(`SELECT * FROM "Wallet" WHERE userId=?`).get(user.id);
    const transactions = db
      .prepare(
        `SELECT * FROM "WalletTransaction" WHERE walletId=(SELECT id FROM "Wallet" WHERE userId=?) ORDER BY id DESC`,
      )
      .all(user.id);
    return json({ wallet, transactions });
  }
  if (method === "POST" && pathname === `${API_PREFIX}/payments`) {
    const user = currentUser(request, ["CLIENT"]);
    const input = parse(
      z.object({
        professionalId: z.number().int().positive(),
        jobId: z.number().int().positive().optional(),
        amount: z.number().int().positive(),
        currency: z.string().length(3).optional(),
        idempotencyKey: z.string().min(8).max(100),
      }),
      await body(request),
    );
    return json(createPayment(user.id, { ...input, currency: input.currency || "USD" }), 201);
  }
  routeMatch = match(pathname, new RegExp(`^${API_PREFIX}/payments/(\\d+)/refund$`));
  if (routeMatch && method === "POST") {
    const user = currentUser(request, ["CLIENT", "ADMIN"]);
    return json(refundPayment(Number(routeMatch[1]), user));
  }

  if (method === "GET" && pathname === `${API_PREFIX}/faq`)
    return json(db.prepare(`SELECT * FROM "Faq" WHERE isPublished=1 ORDER BY sortOrder,id`).all());
  if (method === "POST" && pathname === `${API_PREFIX}/contact`) {
    const input = parse(
      z.object({
        name: z.string().trim().min(2).max(120),
        email,
        subject: z.string().trim().min(2).max(200),
        message: z.string().trim().min(10).max(5000),
      }),
      await body(request),
    );
    const stamp = now();
    const result = db
      .prepare(
        `INSERT INTO "ContactRequest" (name,email,subject,message,status,createdAt,updatedAt) VALUES (?,?,?,?, 'OPEN',?,?)`,
      )
      .run(input.name, input.email, input.subject, input.message, stamp, stamp);
    return json({ id: Number(result.lastInsertRowid), status: "OPEN" }, 201);
  }

  if (pathname.startsWith(`${API_PREFIX}/admin/`)) currentUser(request, ["ADMIN"]);
  if (method === "GET" && pathname === `${API_PREFIX}/admin/dashboard`)
    return json(getAdminDashboardSnapshot());
  if (method === "GET" && pathname === `${API_PREFIX}/admin/users`) return json(getAdminUsers());
  routeMatch = match(pathname, new RegExp(`^${API_PREFIX}/admin/users/(\\d+)/status$`));
  if (routeMatch && method === "PATCH") {
    const input = parse(z.object({ isActive: z.boolean() }), await body(request));
    return json(updateUserActiveStatusByAdmin(Number(routeMatch[1]), input.isActive));
  }
  routeMatch = match(
    pathname,
    new RegExp(`^${API_PREFIX}/admin/professionals/(\\d+)/verification$`),
  );
  if (routeMatch && method === "PATCH") {
    const input = parse(z.object({ isVerified: z.boolean() }), await body(request));
    return json(updateProfessionalVerifiedStatusByAdmin(Number(routeMatch[1]), input.isVerified));
  }
  if (method === "GET" && pathname === `${API_PREFIX}/admin/jobs`)
    return json(getAdminJobRecords());
  routeMatch = match(pathname, new RegExp(`^${API_PREFIX}/admin/jobs/(\\d+)/status$`));
  if (routeMatch && method === "PATCH") {
    const input = parse(
      z.object({ status: z.enum(["DRAFT", "OPEN", "CLOSED"]) }),
      await body(request),
    );
    const result = db
      .prepare(`UPDATE "ClientJob" SET status=?,updatedAt=? WHERE id=?`)
      .run(input.status, now(), Number(routeMatch[1]));
    if (!result.changes) throw new ApiError(404, "Job not found.");
    return json({ id: Number(routeMatch[1]), status: input.status });
  }
  if (method === "GET" && pathname === `${API_PREFIX}/admin/payments`)
    return json(getAdminPaymentTransactions());
  if (method === "GET" && pathname === `${API_PREFIX}/admin/reports`)
    return json({
      dashboard: getAdminDashboardSnapshot(),
      payments: getAdminPaymentTransactions(),
    });
  if (method === "GET" && pathname === `${API_PREFIX}/admin/cms`) return json(listWebsitePages());
  routeMatch = match(pathname, new RegExp(`^${API_PREFIX}/admin/cms/([a-z0-9-]+)$`));
  if (routeMatch && method === "PATCH") {
    const input = parse(
      z.object({ content: z.string().max(500000), status: z.enum(["DRAFT", "PUBLISHED"]) }),
      await body(request),
    );
    return json(saveWebsitePage(routeMatch[1], input));
  }
  if (method === "GET" && pathname === `${API_PREFIX}/admin/faq`)
    return json(db.prepare(`SELECT * FROM "Faq" ORDER BY sortOrder,id`).all());
  if (method === "POST" && pathname === `${API_PREFIX}/admin/faq`) {
    const input = parse(
      z.object({
        question: z.string().min(3),
        answer: z.string().min(3),
        sortOrder: z.number().int().default(0),
        isPublished: z.boolean().default(true),
      }),
      await body(request),
    );
    const stamp = now();
    const result = db
      .prepare(
        `INSERT INTO "Faq" (question,answer,sortOrder,isPublished,createdAt,updatedAt) VALUES (?,?,?,?,?,?)`,
      )
      .run(input.question, input.answer, input.sortOrder, Number(input.isPublished), stamp, stamp);
    return json({ id: Number(result.lastInsertRowid) }, 201);
  }
  if (method === "GET" && pathname === `${API_PREFIX}/admin/contact-requests`)
    return json(db.prepare(`SELECT * FROM "ContactRequest" ORDER BY id DESC`).all());

  // Reports API - Query Real Database Tables

  function buildDateFilterClause(from: string, to: string) {
    const clauses: string[] = [];
    const params: string[] = [];
    if (from) {
      clauses.push(`datetime("createdAt") >= datetime(?)`);
      params.push(from);
    }
    if (to) {
      clauses.push(`datetime("createdAt") <= datetime(?)`);
      params.push(to);
    }
    return { clauses, params };
  }

  function countRows(tableName: string, whereClause = "", params: unknown[] = []) {
    try {
      const result = db.prepare(`SELECT COUNT(*) as cnt FROM "${tableName}"${whereClause ? ` ${whereClause}` : ""}`).get(...params) as { cnt: number } | undefined;
      return Number(result?.cnt ?? 0);
    } catch {
      return 0;
    }
  }

  function sumRows(tableName: string, columnName: string, whereClause = "", params: unknown[] = []) {
    try {
      const result = db.prepare(`SELECT COALESCE(SUM("${columnName}"), 0) as total FROM "${tableName}"${whereClause ? ` ${whereClause}` : ""}`).get(...params) as { total: number } | undefined;
      return Number(result?.total ?? 0);
    } catch {
      return 0;
    }
  }

  function buildScopedWhere(tableName: string, whereClause = "", params: unknown[] = [], from = "", to = "") {
    const columns = getTableColumnNames(tableName);
    const clauses: string[] = [];
    const scopeParams = [...params];

    if (columns.includes("createdAt")) {
      if (from) {
        clauses.push(`"createdAt" >= ?`);
        scopeParams.push(from);
      }
      if (to) {
        clauses.push(`"createdAt" <= ?`);
        scopeParams.push(to);
      }
    }

    const baseClause = whereClause?.trim() ? whereClause.trim() : "";
    const normalizedClause = baseClause.startsWith("WHERE") ? baseClause : baseClause ? `WHERE ${baseClause}` : "";
    const combinedClause = clauses.length
      ? `${normalizedClause ? `${normalizedClause} AND ` : "WHERE "}${clauses.join(" AND ")}`
      : normalizedClause;

    return { whereClause: combinedClause, params: scopeParams };
  }

  function getTableColumnNames(tableName: string) {
    try {
      const cols = db.prepare(`PRAGMA table_info("${tableName}")`).all() as Array<{ name: string }>;
      return cols.map((c) => c.name);
    } catch {
      return [] as string[];
    }
  }

  // Helper: Get all real database tables from SQLite
  function getRealDatabaseTables() {
    try {
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%_new'
        ORDER BY name ASC
      `).all() as Array<{ name: string }>;
      return tables.map(t => t.name);
    } catch (err) {
      console.error("Failed to query database tables:", err);
      return [];
    }
  }

  // Helper: Get row count for a table
  function getTableRowCount(tableName: string): number {
    try {
      const result = db.prepare(`SELECT COUNT(*) as cnt FROM "${tableName}"`).get() as { cnt: number };
      return result?.cnt ?? 0;
    } catch {
      return 0;
    }
  }

  // Helper: Get primary key name for a table
  function getTablePrimaryKey(tableName: string): string {
    try {
      const cols = db.prepare(`PRAGMA table_info("${tableName}")`).all() as Array<{ name: string; pk: number }>;
      const pkCol = cols.find(c => c.pk === 1);
      return pkCol?.name ?? "id";
    } catch {
      return "id";
    }
  }

  // Report Definitions for joins and virtual tables
  const REPORT_CONFIG: Record<string, { from: string; select: string; columns: string[] }> = {
    "User": {
      from: `"User"`,
      select: `"id", "role", "firstName", "lastName", "email", "phone", "isActive", "isVerified", "createdAt"`,
      columns: ["id", "role", "firstName", "lastName", "email", "phone", "isActive", "isVerified", "createdAt"]
    },
    "ProfessionalVerification": {
      from: `"ProfessionalVerification" v LEFT JOIN "User" u ON v.userId = u.id`,
      select: `v.*, u.firstName as professionalFirstName, u.lastName as professionalLastName, u.email as professionalEmail`,
      columns: ["id", "userId", "status", "professionalFirstName", "professionalLastName", "professionalEmail", "updatedAt"]
    },
    "verifications": {
      from: `"verifications" v LEFT JOIN "User" u ON v.userId = u.id`,
      select: `v.*, u.firstName as professionalFirstName, u.lastName as professionalLastName, u.email as professionalEmail`,
      columns: ["id", "userId", "status", "professionalFirstName", "professionalLastName", "professionalEmail", "updatedAt"]
    },
    "ClientJob": {
      from: `"ClientJob" j LEFT JOIN "User" u ON j.userId = u.id`,
      select: `j.*, u.firstName as clientFirstName, u.lastName as clientLastName, u.email as clientEmail`,
      columns: ["id", "userId", "category", "title", "status", "clientFirstName", "clientLastName", "clientEmail", "createdAt"]
    },
    "ProjectDispute": {
      from: `"ProjectDispute" d LEFT JOIN "User" u ON d.clientId = u.id`,
      select: `d.*, u.firstName as clientFirstName, u.lastName as clientLastName`,
      columns: ["id", "trackingId", "clientId", "status", "priority", "issueType", "clientFirstName", "clientLastName", "createdAt"]
    },
    "ProjectTransaction": {
      from: `"ProjectTransaction" t LEFT JOIN "User" u ON t.professionalId = u.id`,
      select: `t.*, u.firstName as professionalFirstName, u.lastName as professionalLastName`,
      columns: ["id", "trackingId", "amount", "currency", "status", "type", "professionalFirstName", "professionalLastName", "createdAt"]
    },
    "ProjectWithdrawal": {
      from: `"ProjectWithdrawal" w LEFT JOIN "User" u ON w.professionalId = u.id`,
      select: `w.*, u.firstName as professionalFirstName, u.lastName as professionalLastName`,
      columns: ["id", "professionalId", "amount", "currency", "status", "destinationType", "professionalFirstName", "professionalLastName", "createdAt"]
    },
    "ServiceCategory": {
      from: `"ServiceCategory"`,
      select: `*`,
      columns: ["id", "name", "slug", "description", "sortOrder", "createdAt"]
    }
  };

  // List reportable tables with real data
  if (method === "GET" && pathname === `${API_PREFIX}/reports/tables`) {
    try {
      const user = currentUser(request, ["ADMIN", "PROFESSIONAL", "CLIENT"]);
      
      // Get all real database tables
      const allTables = getRealDatabaseTables();
      
      if (allTables.length === 0) {
        return json({ 
          tables: [], 
          status: "disconnected",
          error: "No database tables found. Database may not be initialized.",
          totalTables: 0,
          totalRecords: 0
        }, { status: 503 });
      }

      // Friendly mapping for table names
      const tableLabels: Record<string, string> = {
        "User": "users",
        "ProfessionalVerification": "verification",
        "verifications": "verification",
        "ClientJob": "job",
        "ProjectDispute": "dispute",
        "ProjectTransaction": "earnings",
        "ProjectWithdrawal": "payout",
        "ServiceCategory": "categories",
        "ProjectRequest": "Applications",
        "ProjectReview": "Reviews",
        "Service": "Services",
        "Wallet": "Wallet",
        "WalletTransaction": "Transactions",
        "Notification": "Notifications",
        "ContactRequest": "Support Requests",
        "BrowserSubscription": "Push Subscriptions"
      };

      // Filter by role
      let visibleTables = allTables;
      if (user.role !== "ADMIN") {
        // Professionals see their own core activity tables
        if (user.role === "PROFESSIONAL") {
          visibleTables = allTables.filter(t =>
            ["ProjectRequest", "ProjectTransaction", "ProjectReview", "ContactRequest", "Wallet", "WalletTransaction", "Service"].includes(t)
          );
        }
        // Clients see their own activity and platform data
        else if (user.role === "CLIENT") {
          visibleTables = allTables.filter(t =>
            ["ClientJob", "ProjectRequest", "ProjectTransaction", "ProjectReview", "ContactRequest", "ServiceCategory", "Service"].includes(t)
          );
        }
      } else {
        // Admin - only show requested tables as per user instruction
        const requestedTables = ["User", "ProfessionalVerification", "verifications", "ClientJob", "ProjectDispute", "ProjectTransaction", "ProjectWithdrawal", "ServiceCategory"];
        visibleTables = allTables.filter(t => requestedTables.includes(t));

        // Ensure we don't show both ProfessionalVerification and verifications if both exist
        if (visibleTables.includes("ProfessionalVerification") && visibleTables.includes("verifications")) {
           visibleTables = visibleTables.filter(t => t !== "verifications");
        }
      }

      // Build response with row counts and primary keys
      const tableData = visibleTables.map(t => ({
        name: t,
        label: tableLabels[t] || t,
        rows: getTableRowCount(t),
        primaryKey: getTablePrimaryKey(t)
      }));

      const totalRecords = tableData.reduce((sum, t) => sum + t.rows, 0);

      return json({ 
        tables: tableData,
        status: "connected",
        totalTables: tableData.length,
        totalRecords,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Reports/tables error:", msg);
      return json({ 
        tables: [],
        status: "error",
        error: msg,
        totalTables: 0,
        totalRecords: 0
      }, { status: 500 });
    }
  }

  if (method === "GET" && pathname === `${API_PREFIX}/reports/summary`) {
    try {
      const user = currentUser(request, ["ADMIN", "PROFESSIONAL", "CLIENT"]);
      const url = new URL(request.url);
      const from = url.searchParams.get("from") ?? "";
      const to = url.searchParams.get("to") ?? "";
      const scope = from || to ? { from, to } : null;

      if (user.role === "ADMIN") {
        const dashboard = getAdminDashboardSnapshot();
        const userScope = buildScopedWhere("User", "", [], from, to);
        const clientsScope = buildScopedWhere("User", `"role" = 'CLIENT'`, [], from, to);
        const professionalsScope = buildScopedWhere("User", `"role" = 'PROFESSIONAL'`, [], from, to);
        const jobsScope = buildScopedWhere("ClientJob", "", [], from, to);
        const applicationsScope = buildScopedWhere("ProjectRequest", "", [], from, to);
        const paymentsScope = buildScopedWhere("ProjectTransaction", "", [], from, to);
        const reviewsScope = buildScopedWhere("ProjectReview", "", [], from, to);
        const disputesScope = buildScopedWhere("ProjectDispute", "", [], from, to);
        const categoriesScope = buildScopedWhere("ServiceCategory", "", [], from, to);
        const cards = [
          { title: "Total Users", value: countRows("User", userScope.whereClause, userScope.params), subtitle: "All active and inactive accounts", icon: "Users" },
          { title: "Total Clients", value: countRows("User", clientsScope.whereClause, clientsScope.params), subtitle: "Users with client access", icon: "Building2" },
          { title: "Total Professionals", value: countRows("User", professionalsScope.whereClause, professionalsScope.params), subtitle: "Verified service providers", icon: "BriefcaseBusiness" },
          { title: "Total Jobs", value: countRows("ClientJob", jobsScope.whereClause, jobsScope.params), subtitle: "Current job pool", icon: "BriefcaseBusiness" },
          { title: "Total Applications", value: countRows("ProjectRequest", applicationsScope.whereClause, applicationsScope.params), subtitle: "Received proposals", icon: "FileText" },
          { title: "Total Payments", value: countRows("ProjectTransaction", paymentsScope.whereClause, paymentsScope.params), subtitle: "Recorded payments", icon: "ReceiptText" },
          { title: "Total Earnings", value: sumRows("ProjectTransaction", "amount", paymentsScope.whereClause, paymentsScope.params), subtitle: "Gross payment volume", icon: "DollarSign" },
          { title: "Total Disputes", value: countRows("ProjectDispute", disputesScope.whereClause, disputesScope.params), subtitle: "Open and resolved cases", icon: "AlertTriangle" },
          { title: "Total Reviews", value: countRows("ProjectReview", reviewsScope.whereClause, reviewsScope.params), subtitle: "Client and professional feedback", icon: "Star" },
          { title: "Total Categories", value: countRows("ServiceCategory", categoriesScope.whereClause, categoriesScope.params), subtitle: "Service categories", icon: "Tag" },
        ];
        const monthlyUsersSeries = db.prepare(`SELECT strftime('%Y-%m', datetime(createdAt)) as month, COUNT(*) as count FROM "User"${userScope.whereClause ? ` ${userScope.whereClause}` : ""} GROUP BY strftime('%Y-%m', datetime(createdAt)) ORDER BY month DESC LIMIT 6`).all(...userScope.params) as Array<{ month: string; count: number }>;
        const monthlyEarningsSeries = db.prepare(`SELECT strftime('%Y-%m', datetime(createdAt)) as month, COALESCE(SUM(amount),0) as total FROM "ProjectTransaction"${paymentsScope.whereClause ? ` ${paymentsScope.whereClause}` : ""} GROUP BY strftime('%Y-%m', datetime(createdAt)) ORDER BY month DESC LIMIT 6`).all(...paymentsScope.params) as Array<{ month: string; total: number }>;
        const jobsByStatusSeries = [
          { name: "Open", value: countRows("ClientJob", buildScopedWhere("ClientJob", `WHERE "status" = 'OPEN'`, [], from, to).whereClause, buildScopedWhere("ClientJob", `WHERE "status" = 'OPEN'`, [], from, to).params) },
          { name: "Draft", value: countRows("ClientJob", buildScopedWhere("ClientJob", `WHERE "status" = 'DRAFT'`, [], from, to).whereClause, buildScopedWhere("ClientJob", `WHERE "status" = 'DRAFT'`, [], from, to).params) },
          { name: "Closed", value: countRows("ClientJob", buildScopedWhere("ClientJob", `WHERE "status" = 'CLOSED'`, [], from, to).whereClause, buildScopedWhere("ClientJob", `WHERE "status" = 'CLOSED'`, [], from, to).params) },
        ];
        const paymentsByStatusSeries = [
          { name: "Completed", value: countRows("ProjectTransaction", buildScopedWhere("ProjectTransaction", `WHERE "status" = 'COMPLETED'`, [], from, to).whereClause, buildScopedWhere("ProjectTransaction", `WHERE "status" = 'COMPLETED'`, [], from, to).params) },
          { name: "Pending", value: countRows("ProjectTransaction", buildScopedWhere("ProjectTransaction", `WHERE "status" = 'PENDING'`, [], from, to).whereClause, buildScopedWhere("ProjectTransaction", `WHERE "status" = 'PENDING'`, [], from, to).params) },
          { name: "Refunded", value: countRows("ProjectTransaction", buildScopedWhere("ProjectTransaction", `WHERE "status" = 'REFUNDED'`, [], from, to).whereClause, buildScopedWhere("ProjectTransaction", `WHERE "status" = 'REFUNDED'`, [], from, to).params) },
        ];
        const categorySeries = db.prepare(`SELECT "name" as name, COUNT(*) as count FROM "ServiceCategory"${categoriesScope.whereClause ? ` ${categoriesScope.whereClause}` : ""} GROUP BY "name" ORDER BY count DESC LIMIT 6`).all(...categoriesScope.params) as Array<{ name: string; count: number }>;
        return json({
          role: user.role,
          cards,
          charts: {
            monthlyUsers: monthlyUsersSeries.reverse().map((entry) => ({ name: entry.month, value: entry.count })),
            monthlyEarnings: monthlyEarningsSeries.reverse().map((entry) => ({ name: entry.month, value: entry.total })),
            jobsByStatus: jobsByStatusSeries,
            paymentsByStatus: paymentsByStatusSeries,
            categoryDistribution: categorySeries.map((entry) => ({ name: entry.name, value: entry.count })),
          },
          scope,
          generatedAt: new Date().toISOString(),
        });
      }

      if (user.role === "PROFESSIONAL") {
        const professionalId = user.id;
        const applications = countRows("ProjectRequest", `WHERE "professionalId" = ?`, [professionalId]);
        const activeJobs = countRows("ProjectTracking", `WHERE "professionalId" = ? AND "status" = 'ACTIVE'`, [professionalId]);
        const completedJobs = countRows("ProjectTracking", `WHERE "professionalId" = ? AND "status" = 'COMPLETED'`, [professionalId]);
        const pendingApplications = countRows("ProjectRequest", `WHERE "professionalId" = ? AND "status" = 'PENDING'`, [professionalId]);
        const reviews = countRows("ProjectReview", `WHERE "professionalId" = ?`, [professionalId]);
        const withdrawals = countRows("ProjectWithdrawal", `WHERE "professionalId" = ?`, [professionalId]);
        const earnings = sumRows("ProjectTransaction", "amount", `WHERE "professionalId" = ? AND "status" = 'COMPLETED'`, [professionalId]);
        const monthlySeries = db.prepare(`SELECT strftime('%Y-%m', datetime(createdAt)) as month, COALESCE(SUM(amount), 0) as total FROM "ProjectTransaction" WHERE "professionalId" = ? AND "status" = 'COMPLETED' GROUP BY strftime('%Y-%m', datetime(createdAt)) ORDER BY month DESC LIMIT 6`).all(professionalId) as Array<{ month: string; total: number }>;
        const cards = [
          { title: "My Earnings", value: earnings, subtitle: "Completed payments", icon: "DollarSign" },
          { title: "Completed Jobs", value: completedJobs, subtitle: "Finished projects", icon: "CheckCircle2" },
          { title: "Active Jobs", value: activeJobs, subtitle: "In progress", icon: "BriefcaseBusiness" },
          { title: "Pending Jobs", value: pendingApplications, subtitle: "Open applications", icon: "Clock3" },
          { title: "Applications", value: applications, subtitle: "Sent proposals", icon: "FileText" },
          { title: "Reviews", value: reviews, subtitle: "Feedback received", icon: "Star" },
          { title: "Wallet History", value: withdrawals, subtitle: "Withdrawals recorded", icon: "Wallet" },
          { title: "Withdraw History", value: withdrawals, subtitle: "Past payout requests", icon: "Wallet" },
        ];
        return json({
          role: user.role,
          cards,
          charts: {
            monthlyEarnings: monthlySeries.reverse().map((entry) => ({ name: entry.month, value: entry.total })),
            applicationsByStatus: [
              { name: "Pending", value: pendingApplications },
              { name: "Accepted", value: countRows("ProjectRequest", `WHERE "professionalId" = ? AND "status" = 'ACCEPTED'`, [professionalId]) },
              { name: "Declined", value: countRows("ProjectRequest", `WHERE "professionalId" = ? AND "status" = 'DECLINED'`, [professionalId]) },
            ],
          },
          scope,
          generatedAt: new Date().toISOString(),
        });
      }

      const clientId = user.id;
      const jobsPosted = countRows("ClientJob", `WHERE "userId" = ?`, [clientId]);
      const activeJobs = countRows("ClientJob", `WHERE "userId" = ? AND "status" = 'OPEN'`, [clientId]);
      const completedJobs = countRows("ClientJob", `WHERE "userId" = ? AND "status" = 'CLOSED'`, [clientId]);
      const cancelledJobs = countRows("ClientJob", `WHERE "userId" = ? AND "status" = 'CANCELLED'`, [clientId]);
      const totalSpending = sumRows("ProjectTransaction", "amount", `WHERE "clientId" = ? AND "status" = 'COMPLETED'`, [clientId]);
      const payments = countRows("ProjectTransaction", `WHERE "clientId" = ?`, [clientId]);
      const hiredProfessionals = countRows("ProjectTracking", `WHERE "clientId" = ?`, [clientId]);
      const reviews = countRows("ProjectReview", `WHERE "clientId" = ?`, [clientId]);
      const monthlySeries = db.prepare(`SELECT strftime('%Y-%m', datetime(createdAt)) as month, COALESCE(SUM(amount), 0) as total FROM "ProjectTransaction" WHERE "clientId" = ? AND "status" = 'COMPLETED' GROUP BY strftime('%Y-%m', datetime(createdAt)) ORDER BY month DESC LIMIT 6`).all(clientId) as Array<{ month: string; total: number }>;
      const cards = [
        { title: "Jobs Posted", value: jobsPosted, subtitle: "Your posted work", icon: "BriefcaseBusiness" },
        { title: "Active Jobs", value: activeJobs, subtitle: "Currently open", icon: "Clock3" },
        { title: "Completed Jobs", value: completedJobs, subtitle: "Finished work", icon: "CheckCircle2" },
        { title: "Cancelled Jobs", value: cancelledJobs, subtitle: "Closed without completion", icon: "AlertTriangle" },
        { title: "Total Spending", value: totalSpending, subtitle: "Committed payment volume", icon: "DollarSign" },
        { title: "Payments", value: payments, subtitle: "Transactions recorded", icon: "ReceiptText" },
        { title: "Hired Professionals", value: hiredProfessionals, subtitle: "Engaged service providers", icon: "Users" },
        { title: "Reviews Given", value: reviews, subtitle: "Feedback posted", icon: "Star" },
      ];
      return json({
        role: user.role,
        cards,
        charts: {
          monthlySpending: monthlySeries.reverse().map((entry) => ({ name: entry.month, value: entry.total })),
          jobsByStatus: [
            { name: "Open", value: activeJobs },
            { name: "Closed", value: completedJobs },
            { name: "Cancelled", value: cancelledJobs },
          ],
        },
        scope,
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Reports/summary error:", msg);
      return json({ role: "ADMIN", cards: [], charts: { monthlyUsers: [], jobsByStatus: [] }, scope: null, generatedAt: new Date().toISOString(), error: msg }, { status: 500 });
    }
  }

  // Helper: Build standardized WHERE clause for reports
  function buildReportWhereClause(user: any, table: string, colNames: string[], filters: any) {
    const where: string[] = [];
    const params: any[] = [];

    // Role-based row filtering (Admins see everything)
    if (user.role === "PROFESSIONAL") {
      if (table === "User" || table === "users") {
        where.push(`"id" = ?`);
        params.push(user.id);
      } else if (colNames.includes("professionalId")) {
        where.push(`"professionalId" = ?`);
        params.push(user.id);
      } else if (colNames.includes("reviewedBy") && (table.toLowerCase().includes("review"))) {
        where.push(`("createdBy" = ? OR "reviewedBy" = ?)`);
        params.push(user.id, user.id);
      } else if (colNames.includes("userId")) {
        where.push(`"userId" = ?`);
        params.push(user.id);
      }
    } else if (user.role === "CLIENT") {
      if (table === "User" || table === "users") {
        where.push(`"id" = ?`);
        params.push(user.id);
      } else if (colNames.includes("clientId")) {
        where.push(`"clientId" = ?`);
        params.push(user.id);
      } else if (colNames.includes("userId")) {
        where.push(`"userId" = ?`);
        params.push(user.id);
      }
    }

    // Generic PO/Reference search
    if (filters.po) {
      const poCols = colNames.filter(c =>
        ["trackingId", "requestId", "orderId", "reference", "poNumber", "tracking_id"].includes(c)
      );
      if (poCols.length > 0) {
        const poClause = poCols.map(c => `"${c}" = ?`).join(" OR ");
        where.push(`(${poClause})`);
        for (let i = 0; i < poCols.length; i++) params.push(filters.po);
      }
    }

    // Date filtering - check common date columns
    const dateCol = colNames.includes("createdAt") ? "createdAt" : colNames.includes("updatedAt") ? "updatedAt" : null;
    if (dateCol) {
      if (filters.from && String(filters.from).trim()) {
        where.push(`datetime("${dateCol}") >= datetime(?)`);
        params.push(filters.from);
      }
      if (filters.to && String(filters.to).trim()) {
        where.push(`datetime("${dateCol}") <= datetime(?)`);
        params.push(filters.to);
      }
    }

    // Generic status filtering
    const statusVal = String(filters.status || filters.jobStatus || filters.paymentStatus || "").trim();
    if (statusVal) {
      const statusCol = colNames.includes("status") ? "status" : colNames.includes("jobStatus") ? "jobStatus" : colNames.includes("paymentStatus") ? "paymentStatus" : null;
      if (statusCol) {
        where.push(`"${statusCol}" = ?`);
        params.push(statusVal);
      }
    }

    // Categorical filters
    if (filters.category && String(filters.category).trim() && colNames.includes("category")) {
      where.push(`"category" = ?`);
      params.push(filters.category);
    }
    if (filters.userType && String(filters.userType).trim() && colNames.includes("role")) {
      where.push(`"role" = ?`);
      params.push(filters.userType);
    }

    // User ID filter
    if (filters.id && colNames.includes("id")) {
      where.push(`"id" = ?`);
      params.push(filters.id);
    }

    // Full text search
    if (filters.search && String(filters.search).trim()) {
      const searchCols = colNames.filter((c) =>
        !["id", "createdAt", "updatedAt", "passwordHash", "googleId", "password_hash"].includes(c)
      );
      if (searchCols.length > 0) {
        const likeClause = searchCols.map((c) => `"${c}" LIKE ?`).join(" OR ");
        where.push(`(${likeClause})`);
        const searchTerm = `%${String(filters.search).trim()}%`;
        for (let i = 0; i < searchCols.length; i++) params.push(searchTerm);
      }
    }

    return {
      whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
      params
    };
  }

  // Preview records with pagination and filters - from REAL database
  if (method === "POST" && pathname === `${API_PREFIX}/reports/preview`) {
    try {
      const user = currentUser(request, ["ADMIN", "PROFESSIONAL", "CLIENT"]);
      const payload = parse(
        z.object({ 
          table: z.string(), 
          page: z.number().int().min(1).default(1), 
          pageSize: z.number().int().min(1).max(1000).default(50), 
          filters: z.record(z.any()).optional() 
        }),
        await body(request),
      );

      const table = String(payload.table);
      const allTables = getRealDatabaseTables();

      let querySource = `"${table}"`;
      let selectClause = "*";
      let colNames: string[] = [];

      const config = user.role === "ADMIN" ? REPORT_CONFIG[table] : null;

      if (config && (allTables.includes(table) || (table === "ProfessionalVerification" && allTables.includes("verifications")) || (table === "verifications" && allTables.includes("ProfessionalVerification")))) {
        // Use joined/virtual config
        let actualTable = table;
        if (table === "ProfessionalVerification" && !allTables.includes(table) && allTables.includes("verifications")) {
           actualTable = "verifications";
        } else if (table === "verifications" && !allTables.includes(table) && allTables.includes("ProfessionalVerification")) {
           actualTable = "ProfessionalVerification";
        }

        const actualConfig = REPORT_CONFIG[actualTable] || config;
        querySource = actualConfig.from;
        selectClause = actualConfig.select;
        colNames = actualConfig.columns;
      } else {
        if (!allTables.includes(table)) {
          throw new ApiError(404, `Table "${table}" not found.`);
        }
        const cols = db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>;
        colNames = cols.map((c) => c.name);
        querySource = `"${table}"`;
      }

      const { whereSql, params } = buildReportWhereClause(user, table, colNames, payload.filters || {});

      // Get total count
      const totalRow = db.prepare(`SELECT COUNT(*) as cnt FROM ${querySource} ${whereSql}`).get(...params) as { cnt: number };
      const total = Number(totalRow?.cnt ?? 0);

      const page = Number(payload.page || 1);
      const pageSize = Number(payload.pageSize || 50);
      const offset = (page - 1) * pageSize;

      // Get paginated rows
      const orderByCol = colNames.includes('id') ? 'id' : colNames[0];
      const rows = db.prepare(`SELECT ${selectClause} FROM ${querySource} ${whereSql} ORDER BY "${orderByCol}" DESC LIMIT ? OFFSET ?`)
        .all(...params, pageSize, offset) as Array<Record<string, unknown>>;

      return json({ 
        columns: colNames, 
        rows, 
        total, 
        page, 
        pageSize,
        status: "success"
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Reports/preview error:", msg);
      if (err instanceof ApiError) throw err;
      throw new ApiError(500, msg);
    }
  }

  // Download report (CSV, JSON, PDF)
  if (method === "POST" && pathname === `${API_PREFIX}/reports/download`) {
    try {
      const user = currentUser(request, ["ADMIN", "PROFESSIONAL", "CLIENT"]);
      const payload = parse(
        z.object({ 
          table: z.string(), 
          format: z.enum(["CSV", "JSON", "PDF", "EXCEL"]).default("PDF"), 
          filters: z.record(z.any()).optional(), 
          reportName: z.string().optional() 
        }),
        await body(request),
      );

      const table = String(payload.table);
      const allTables = getRealDatabaseTables();

      let querySource = `"${table}"`;
      let selectClause = "*";
      let colNames: string[] = [];

      const config = user.role === "ADMIN" ? REPORT_CONFIG[table] : null;

      if (config && (allTables.includes(table) || (table === "ProfessionalVerification" && allTables.includes("verifications")) || (table === "verifications" && allTables.includes("ProfessionalVerification")))) {
        let actualTable = table;
        if (table === "ProfessionalVerification" && !allTables.includes(table) && allTables.includes("verifications")) {
           actualTable = "verifications";
        } else if (table === "verifications" && !allTables.includes(table) && allTables.includes("ProfessionalVerification")) {
           actualTable = "ProfessionalVerification";
        }

        const actualConfig = REPORT_CONFIG[actualTable] || config;
        querySource = actualConfig.from;
        selectClause = actualConfig.select;
        colNames = actualConfig.columns;
      } else {
        if (!allTables.includes(table)) {
          throw new ApiError(404, `Table "${table}" not found.`);
        }
        const cols = db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>;
        colNames = cols.map((c) => c.name);
        querySource = `"${table}"`;
      }

      const filters = payload.filters || {};
      const { whereSql, params } = buildReportWhereClause(user, table, colNames, filters);

      const orderByCol = colNames.includes('id') ? 'id' : colNames[0];

      // Fetch all matching records for download (no pagination, no limit as per requirements)
      const rows = db.prepare(`SELECT ${selectClause} FROM ${querySource} ${whereSql} ORDER BY "${orderByCol}" DESC`)
        .all(...params) as Array<Record<string, unknown>>;

      if (payload.format === "JSON") {
        const bodyOut = JSON.stringify({ columns: colNames, rows });
        return new Response(bodyOut, { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="${(payload.reportName || table).replace(/[^a-z0-9.-]/gi, "_")}.json"` } });
      }

      if (payload.format === "CSV" || payload.format === "EXCEL") {
        const escape = (v: unknown) => {
          const s = String(v ?? "");
          if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
          return s;
        };
        const header = colNames.join(",");
        const lines = [header];
        for (const r of rows) lines.push(colNames.map((c) => escape(r[c])).join(","));
        const csv = lines.join("\n");
        const contentType = payload.format === "EXCEL" ? "application/vnd.ms-excel" : "text/csv";
        const extension = payload.format === "EXCEL" ? "xls" : "csv";
        return new Response(csv, { headers: { "content-type": contentType, "content-disposition": `attachment; filename="${(payload.reportName || table).replace(/[^a-z0-9.-]/gi, "_")}.${extension}"` } });
      }

      // PDF generation
      try {
        const title = payload.reportName || table;
        const generationDate = new Date().toLocaleString();

        // Build filters summary
        const filtersUsed = Object.entries(filters)
          .filter(([_, v]) => v !== undefined && v !== "" && v !== null)
          .map(([k, v]) => `<li><strong>${k}:</strong> ${v}</li>`)
          .join("");

        // Limit PDF rows to avoid timeout if huge, but CSV/Excel/JSON remain unlimited
        const pdfRows = rows.slice(0, 5000);
        const isTruncated = rows.length > 5000;

        const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { margin: 2cm; @bottom-right { content: "Page " counter(page) " of " counter(pages); } }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #334155; line-height: 1.5; margin: 0; padding: 0; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
    .logo-container { display: flex; align-items: center; gap: 10px; }
    .logo-icon { width: 36px; height: 36px; background-color: #3b82f6; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; }
    .logo-text { font-size: 24px; font-weight: 700; color: #1e293b; }
    .report-info { text-align: right; }
    .report-info h1 { margin: 0; color: #1e293b; font-size: 20px; }
    .report-info p { margin: 5px 0 0; font-size: 12px; color: #64748b; }

    .summary-section { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 30px; }
    .summary-section h2 { margin-top: 0; font-size: 16px; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; }
    .filter-list { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; }
    .warning { color: #854d0e; background-color: #fefce8; border: 1px solid #fef08a; padding: 10px; border-radius: 6px; font-size: 12px; margin-bottom: 20px; }

    table { width: 100%; border-collapse: collapse; margin-top: 20px; table-layout: auto; }
    th { background-color: #3b82f6; color: white; text-align: left; padding: 12px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid #2563eb; }
    td { padding: 10px 8px; font-size: 11px; border: 1px solid #e2e8f0; word-break: break-word; }
    tr:nth-child(even) { background-color: #f1f5f9; }

    .footer { position: fixed; bottom: 0; width: 100%; text-align: center; font-size: 10px; color: #94a3b8; padding: 10px 0; border-top: 1px solid #e2e8f0; }
    .page-number:before { content: "Page " counter(page); }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-container">
      <div class="logo-icon">S</div>
      <div class="logo-text">Servio</div>
    </div>
    <div class="report-info">
      <h1>${escapeHtml(title)} Report</h1>
      <p>Generated on ${generationDate}</p>
      <p>Generated by: ${escapeHtml(String(user.firstName || user.email || 'Admin'))}</p>
    </div>
  </div>

  ${isTruncated ? '<div class="warning"><strong>Notice:</strong> This PDF contains the first 5,000 records. For the full dataset, please use CSV or Excel export.</div>' : ''}

  <div class="summary-section">
    <h2>Report Details</h2>
    <ul class="filter-list">
      <li><strong>Total Records:</strong> ${rows.length}</li>
      <li><strong>Status:</strong> All Data</li>
      ${filtersUsed || '<li><strong>Filters:</strong> None applied</li>'}
    </ul>
  </div>

  <table>
    <thead>
      <tr>
        ${colNames.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${pdfRows.map((r) => `
        <tr>
          ${colNames.map((c) => `<td>${escapeHtml(String(r[c] ?? '-'))}</td>`).join('')}
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    <p>&copy; ${new Date().getFullYear()} Servio Professional Gateway. All rights reserved. | Confidental Business Report</p>
  </div>
</body>
</html>`;

        const puppeteer = await import('puppeteer');
        const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
        const pageP = await browser.newPage();
        await pageP.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await pageP.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '20px', bottom: '60px', left: '20px', right: '20px' },
          displayHeaderFooter: true,
          headerTemplate: '<div></div>',
          footerTemplate: '<div style="font-size: 10px; width: 100%; text-align: center; color: #94a3b8;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>'
        });
        await browser.close();
        if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) throw new ApiError(500, 'PDF generation failed (empty)');
        return new Response(pdfBuffer, { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${(payload.reportName || table).replace(/[^a-z0-9.-]/gi, "_")}.pdf"` } });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new ApiError(500, `Failed to generate PDF. ${msg}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Reports/download error:", msg);
      if (err instanceof ApiError) throw err;
      throw new ApiError(500, msg);
    }
  }

  // Report history listing (stored files)
  if (method === "GET" && pathname === `${API_PREFIX}/reports/history`) {
    const user = currentUser(request, ["ADMIN"]);
    const rows = db.prepare(`SELECT id,fileName,mimeType,sizeBytes,createdAt,ownerId FROM "StoredFile" WHERE purpose='report' ORDER BY createdAt DESC LIMIT 200`).all();
    return json(rows.map((r: any) => ({ id: r.id, fileName: r.fileName, mimeType: r.mimeType, fileSize: r.sizeBytes, generatedAt: r.createdAt, ownerId: r.ownerId })));
  }

  // Delete stored report
  routeMatch = match(pathname, new RegExp(`^${API_PREFIX}/reports/history/(\\d+)$`));
  if (routeMatch && method === "DELETE") {
    const user = currentUser(request, ["ADMIN"]);
    const id = Number(routeMatch[1]);
    const row = db.prepare(`SELECT * FROM "StoredFile" WHERE id=? AND purpose='report'`).get(id) as { id: number; storageKey: string; ownerId: number } | undefined;
    if (!row) throw new ApiError(404, 'Report not found');
    if (row.ownerId !== user.id && user.role !== 'ADMIN') throw new ApiError(403, 'Not allowed');
    const root = path.resolve(process.cwd(), process.env.FILE_STORAGE_PATH || 'storage');
    const target = path.resolve(root, row.storageKey);
    try { await import('node:fs').then(m=>m.unlinkSync(target)); } catch {}
    db.prepare(`DELETE FROM "StoredFile" WHERE id=?`).run(id);
    return json({ ok: true });
  }

  throw new ApiError(404, "API route not found.");
}

function createAccountToken(userId: number, kind: string, minutes: number) {
  const db = getApiDatabase();
  const token = opaqueToken();
  db.prepare(`DELETE FROM "ApiToken" WHERE userId=? AND kind=?`).run(userId, kind);
  db.prepare(
    `INSERT INTO "ApiToken" (userId,tokenHash,kind,expiresAt,createdAt) VALUES (?,?,?,?,?)`,
  ).run(
    userId,
    tokenHash(token),
    kind,
    new Date(Date.now() + minutes * 60000).toISOString(),
    now(),
  );
  return token;
}
function consumeAccountToken(token: string, kind: string, action: (userId: number) => void) {
  const db = getApiDatabase();
  const row = db
    .prepare(
      `SELECT * FROM "ApiToken" WHERE tokenHash=? AND kind=? AND usedAt IS NULL AND expiresAt>?`,
    )
    .get(tokenHash(token), kind, now()) as { id: number; userId: number } | undefined;
  if (!row) throw new ApiError(400, "Token is invalid or expired.");
  db.transaction(() => {
    action(row.userId);
    db.prepare(`UPDATE "ApiToken" SET usedAt=? WHERE id=?`).run(now(), row.id);
  })();
}
function haversine(a: number, b: number, c: number, d: number) {
  const r = 6371,
    toRad = (v: number) => (v * Math.PI) / 180;
  const x = toRad(c - a),
    y = toRad(d - b);
  const q = Math.sin(x / 2) ** 2 + Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(y / 2) ** 2;
  return Math.round(r * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q)) * 100) / 100;
}

async function uploadFile(request: Request) {
  const user = currentUser(request);
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(422, "A file field is required.");
  const max = Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024);
  if (file.size > max) throw new ApiError(413, "File is too large.");
  const allowed = (
    process.env.ALLOWED_UPLOAD_TYPES || "image/jpeg,image/png,image/webp,application/pdf"
  ).split(",");
  if (!allowed.includes(file.type)) throw new ApiError(415, "File type is not allowed.");
  const key = `${user.id}/${randomUUID()}${path.extname(file.name).toLowerCase()}`;
  const root = path.resolve(process.cwd(), process.env.FILE_STORAGE_PATH || "storage");
  const target = path.resolve(root, key);
  if (!target.startsWith(root)) throw new ApiError(400, "Invalid storage path.");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await file.arrayBuffer()));
  const db = getApiDatabase(),
    stamp = now();
  const result = db
    .prepare(
      `INSERT INTO "StoredFile" (ownerId,purpose,fileName,mimeType,sizeBytes,storageKey,isPublic,createdAt) VALUES (?,?,?,?,?,?,?,?)`,
    )
    .run(
      user.id,
      String(form.get("purpose") || "document"),
      file.name,
      file.type,
      file.size,
      key,
      form.get("public") === "true" ? 1 : 0,
      stamp,
    );
  return json(
    {
      id: Number(result.lastInsertRowid),
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    },
    201,
  );
}
function fileSecret() {
  return process.env.FILE_SIGNING_SECRET || process.env.AUTH_SECRET || "dev-file-secret";
}
function fileSignature(id: number, expires: number) {
  return createHmac("sha256", fileSecret()).update(`${id}:${expires}`).digest("base64url");
}
async function downloadFile(id: number, url: URL) {
  const db = getApiDatabase();
  const file = db.prepare(`SELECT * FROM "StoredFile" WHERE id=?`).get(id) as
    | { isPublic: number; storageKey: string; mimeType: string; fileName: string }
    | undefined;
  if (!file) throw new ApiError(404, "File not found.");
  if (!file.isPublic) {
    const expires = Number(url.searchParams.get("expires")),
      provided = Buffer.from(url.searchParams.get("signature") || ""),
      expected = Buffer.from(fileSignature(id, expires));
    if (
      expires < Date.now() ||
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    )
      throw new ApiError(403, "File access link is invalid or expired.");
  }
  const root = path.resolve(process.cwd(), process.env.FILE_STORAGE_PATH || "storage");
  return new Response(await readFile(path.resolve(root, file.storageKey)), {
    headers: {
      "content-type": file.mimeType,
      // Force download so browsers don't try to render HTML inline
      "content-disposition": `attachment; filename="${file.fileName.replace(/[\r\n\"]/g, "")}"`,
    },
  });
}
function ensureWallet(userId: number) {
  getApiDatabase()
    .prepare(
      `INSERT OR IGNORE INTO "Wallet" (userId,currency,balance,pendingBalance,updatedAt) VALUES (?,'USD',0,0,?)`,
    )
    .run(userId, now());
}
function createPayment(
  clientId: number,
  input: {
    professionalId: number;
    jobId?: number;
    amount: number;
    currency: string;
    idempotencyKey: string;
  },
) {
  const db = getApiDatabase();
  const existing = db
    .prepare(`SELECT * FROM "Payment" WHERE idempotencyKey=?`)
    .get(input.idempotencyKey);
  if (existing) return existing;
  const commission = Math.round(input.amount * Number(process.env.PLATFORM_COMMISSION_RATE || 0.1)),
    stamp = now();
  return db.transaction(() => {
    ensureWallet(input.professionalId);
    const result = db
      .prepare(
        `INSERT INTO "Payment" (clientId,professionalId,jobId,amount,commissionAmount,currency,provider,status,idempotencyKey,createdAt,updatedAt) VALUES (?,?,?,?,?,?,'WALLET','COMPLETED',?,?,?)`,
      )
      .run(
        clientId,
        input.professionalId,
        input.jobId ?? null,
        input.amount,
        commission,
        input.currency,
        input.idempotencyKey,
        stamp,
        stamp,
      );
    const paymentId = Number(result.lastInsertRowid);
    const wallet = db
      .prepare(`SELECT id FROM "Wallet" WHERE userId=?`)
      .get(input.professionalId) as { id: number };
    const net = input.amount - commission;
    db.prepare(`UPDATE "Wallet" SET balance=balance+?,updatedAt=? WHERE id=?`).run(
      net,
      stamp,
      wallet.id,
    );
    db.prepare(
      `INSERT INTO "WalletTransaction" (walletId,paymentId,type,amount,status,description,createdAt) VALUES (?,?,'CREDIT',?,'COMPLETED','Service payment',?)`,
    ).run(wallet.id, paymentId, net, stamp);
    return db.prepare(`SELECT * FROM "Payment" WHERE id=?`).get(paymentId);
  })();
}
function refundPayment(id: number, user: PublicUser) {
  const db = getApiDatabase();
  const payment = db.prepare(`SELECT * FROM "Payment" WHERE id=?`).get(id) as
    | {
        id: number;
        clientId: number;
        professionalId: number;
        amount: number;
        commissionAmount: number;
        status: string;
      }
    | undefined;
  if (!payment || (user.role !== "ADMIN" && payment.clientId !== user.id))
    throw new ApiError(404, "Payment not found.");
  if (payment.status !== "COMPLETED")
    throw new ApiError(409, "Only completed payments can be refunded.");
  return db.transaction(() => {
    ensureWallet(payment.professionalId);
    const net = payment.amount - payment.commissionAmount;
    const wallet = db
      .prepare(`SELECT id,balance FROM "Wallet" WHERE userId=?`)
      .get(payment.professionalId) as { id: number; balance: number };
    if (wallet.balance < net)
      throw new ApiError(409, "Professional wallet has insufficient funds for this refund.");
    db.prepare(`UPDATE "Wallet" SET balance=balance-?,updatedAt=? WHERE id=?`).run(
      net,
      now(),
      wallet.id,
    );
    db.prepare(`UPDATE "Payment" SET status='REFUNDED',updatedAt=? WHERE id=?`).run(now(), id);
    db.prepare(
      `INSERT INTO "WalletTransaction" (walletId,paymentId,type,amount,status,description,createdAt) VALUES (?,?,'DEBIT',?,'COMPLETED','Payment refund',?)`,
    ).run(wallet.id, id, -net, now());
    return db.prepare(`SELECT * FROM "Payment" WHERE id=?`).get(id);
  })();
}
