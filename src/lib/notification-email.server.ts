import path from "node:path";
import Database from "better-sqlite3";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_EMAIL = process.env.SMTP_EMAIL || process.env.SMTP_USER;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_EMAIL;
const APP_ORIGIN =
  process.env.APP_ORIGIN ||
  process.env.PUBLIC_APP_ORIGIN ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

type EmailNotificationInput = {
  subject: string;
  title: string;
  body: string;
  actionLabel?: string;
  actionPath?: string;
};

type EmailRecipient = {
  email: string;
  firstName: string;
  lastName: string;
  emailNotificationsEnabled: number;
};

const globalForNotificationEmail = globalThis as typeof globalThis & {
  notificationEmailDb?: Database.Database;
};

function getDatabase() {
  if (!globalForNotificationEmail.notificationEmailDb) {
    const databasePath = path.resolve(process.cwd(), "prisma", "app.db");
    globalForNotificationEmail.notificationEmailDb = new Database(databasePath);
  }

  return globalForNotificationEmail.notificationEmailDb;
}

async function sendEmail(to: string, subject: string, text: string, html: string) {
  if (!SMTP_EMAIL || !SMTP_PASSWORD || !SMTP_FROM) {
    return;
  }

  const nodemailer = (await import("nodemailer")).default;
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_EMAIL,
      pass: SMTP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject,
    text,
    html,
  });
}

function getActionUrl(pathValue?: string) {
  if (!pathValue) {
    return null;
  }

  if (/^https?:\/\//i.test(pathValue)) {
    return pathValue;
  }

  return APP_ORIGIN
    ? `${APP_ORIGIN}${pathValue.startsWith("/") ? pathValue : `/${pathValue}`}`
    : pathValue;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function sendAccountEmailNotification(userId: number, input: EmailNotificationInput) {
  const db = getDatabase();
  const recipient = db
    .prepare(
      `
        SELECT email, firstName, lastName, emailNotificationsEnabled
        FROM "User"
        WHERE id = ?
        LIMIT 1
      `,
    )
    .get(userId) as EmailRecipient | undefined;

  if (!recipient?.email || recipient.emailNotificationsEnabled === 0) {
    return;
  }

  const displayName = `${recipient.firstName} ${recipient.lastName}`.trim() || "there";
  const actionUrl = getActionUrl(input.actionPath);
  const text = [
    `Hi ${displayName},`,
    "",
    input.title,
    input.body,
    actionUrl && input.actionLabel ? `${input.actionLabel}: ${actionUrl}` : null,
    "",
    "You can change email notifications from your Servio profile settings.",
  ]
    .filter(Boolean)
    .join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <p>Hi ${escapeHtml(displayName)},</p>
      <h2 style="margin:0 0 12px">${escapeHtml(input.title)}</h2>
      <p>${escapeHtml(input.body)}</p>
      ${
        actionUrl && input.actionLabel
          ? `<p><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#111827;color:#ffffff;padding:10px 14px;border-radius:8px;text-decoration:none">${escapeHtml(input.actionLabel)}</a></p>`
          : ""
      }
      <p style="font-size:12px;color:#6b7280">You can change email notifications from your Servio profile settings.</p>
    </div>
  `;

  await sendEmail(recipient.email, input.subject, text, html);
}

export function queueAccountEmailNotification(userId: number, input: EmailNotificationInput) {
  void sendAccountEmailNotification(userId, input).catch((error) => {
    console.warn("Could not send account email notification", error);
  });
}
