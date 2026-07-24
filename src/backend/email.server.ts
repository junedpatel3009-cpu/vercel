import nodemailer from "nodemailer";

function mailer() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

export async function sendAccountLink(email: string, kind: "verify" | "reset", token: string) {
  const transport = mailer();
  if (!transport) {
    if (process.env.NODE_ENV === "production") throw new Error("SMTP is not configured.");
    return false;
  }
  const appUrl = (process.env.APP_URL || "http://localhost:5173").replace(/\/$/, "");
  const target =
    kind === "verify"
      ? `${appUrl}/verify?token=${encodeURIComponent(token)}`
      : `${appUrl}/forgot-password?token=${encodeURIComponent(token)}`;
  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: kind === "verify" ? "Verify your Servio account" : "Reset your Servio password",
    text: `${kind === "verify" ? "Verify your email" : "Reset your password"}: ${target}\n\nThis link expires automatically.`,
    html: `<p>${kind === "verify" ? "Verify your email address" : "Reset your password"} by opening the secure link below.</p><p><a href="${target}">${target}</a></p><p>This link expires automatically.</p>`,
  });
  return true;
}
