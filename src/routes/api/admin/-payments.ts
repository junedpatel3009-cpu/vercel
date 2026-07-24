import Database from "better-sqlite3";
import path from "node:path";
import { createAPIFileRoute } from "@tanstack/react-start/api";

import { requireCurrentUserRole } from "@/lib/current-user.server";

export const APIRoute = createAPIFileRoute("/api/admin/payments")({
  GET: async () => {
    requireCurrentUserRole("ADMIN");

    const db = new Database(path.resolve(process.cwd(), "prisma", "app.db"));

    const payments = db
      .prepare(
        `
          SELECT
            ProjectTransaction.id AS paymentId,
            COALESCE(ClientJob.title, ProjectTransaction.description, 'Project payment') AS jobTitle,
            TRIM(ClientUser.firstName || ' ' || ClientUser.lastName) AS clientName,
            ClientUser.email AS clientEmail,
            TRIM(ProUser.firstName || ' ' || ProUser.lastName) AS professionalName,
            ProUser.email AS professionalEmail,
            ProjectTransaction.amount,
            ProjectTransaction.currency,
            ProjectTransaction.type AS paymentType,
            ProjectTransaction.status,
            ProjectTransaction.createdAt
          FROM "ProjectTransaction"
          LEFT JOIN "ProjectTracking" ON ProjectTracking.id = ProjectTransaction.trackingId
          LEFT JOIN "ClientJob" ON ClientJob.id = ProjectTracking.jobId
          LEFT JOIN "User" AS ClientUser ON ClientUser.id = ProjectTransaction.clientId
          LEFT JOIN "User" AS ProUser ON ProUser.id = ProjectTransaction.professionalId
          ORDER BY datetime(ProjectTransaction.createdAt) DESC, ProjectTransaction.id DESC
        `,
      )
      .all() as Array<{
      paymentId: number;
      jobTitle: string | null;
      clientName: string | null;
      clientEmail: string | null;
      professionalName: string | null;
      professionalEmail: string | null;
      amount: number;
      currency: string;
      paymentType: string;
      status: string;
      createdAt: string;
    }>;

    return new Response(
      JSON.stringify({
        payments: payments.map((payment) => ({
          id: payment.paymentId,
          jobTitle: payment.jobTitle || "Project payment",
          clientName: payment.clientName || "Unknown client",
          clientEmail: payment.clientEmail || "Unknown email",
          professionalName: payment.professionalName || "Unknown professional",
          professionalEmail: payment.professionalEmail || "Unknown email",
          amount: payment.amount,
          currency: payment.currency,
          paymentType: payment.paymentType,
          status: payment.status,
          dateTime: payment.createdAt,
        })),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  },
});
