type OtpPurpose = "SIGNUP" | "PASSWORD_RESET";
type OtpEntry = { code: string; expiresAt: number; purpose: OtpPurpose };
const otpStore = new Map<string, OtpEntry>();
const OTP_EXPIRATION_MINUTES = 10;
const OTP_EXPIRATION_MS = OTP_EXPIRATION_MINUTES * 60 * 1000;

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_EMAIL = process.env.SMTP_EMAIL || process.env.SMTP_USER;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_EMAIL;

async function createTransporter() {
  if (!SMTP_EMAIL || !SMTP_PASSWORD) {
    throw new Error(
      "SMTP credentials must be configured with SMTP_EMAIL/SMTP_PASSWORD or SMTP_USER/SMTP_PASS.",
    );
  }

  const nodemailer = (await import("nodemailer")).default;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_EMAIL,
      pass: SMTP_PASSWORD,
    },
  });
}

function otpKey(purpose: OtpPurpose, email: string) {
  return `${purpose}:${email.trim().toLowerCase()}`;
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOtpEmail(
  purpose: OtpPurpose,
  email: string,
  subject: string,
  buildText: (code: string) => string,
) {
  const code = generateOtp();
  const expiresAt = Date.now() + OTP_EXPIRATION_MS;
  const text = buildText(code);

  const transporter = await createTransporter();
  await transporter.sendMail({
    from: SMTP_FROM,
    to: email,
    subject,
    text,
    html: buildOtpEmailHtml({
      code,
      heading: purpose === "SIGNUP" ? "Verify your email" : "Reset your password",
      intro:
        purpose === "SIGNUP"
          ? "Use this one-time code to finish creating your Servio account."
          : "Use this one-time code to reset your Servio password.",
    }),
  });

  otpStore.set(otpKey(purpose, email), { code, expiresAt, purpose });
}

function buildOtpEmailHtml({
  code,
  heading,
  intro,
}: {
  code: string;
  heading: string;
  intro: string;
}) {
  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${heading}</title>
  </head>
  <body style="margin:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fb;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;box-shadow:0 14px 40px rgba(15,23,42,0.08);">
            <tr>
              <td style="padding:28px 30px 18px;border-bottom:1px solid #e2e8f0;">
                <div style="font-size:14px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#2563eb;">Servio</div>
                <h1 style="margin:12px 0 0;font-size:26px;line-height:1.25;color:#0f172a;">${heading}</h1>
                <p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#475569;">${intro}</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:30px;">
                <div style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">Your OTP code</div>
                <div style="margin:14px 0 16px;display:inline-block;border-radius:16px;background:#eff6ff;border:1px solid #bfdbfe;padding:16px 24px;font-size:34px;line-height:1;font-weight:800;letter-spacing:0.24em;color:#1d4ed8;">
                  ${code}
                </div>
                <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">This code expires in <strong style="color:#0f172a;">${OTP_EXPIRATION_MINUTES} minutes</strong>.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 30px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
                  If you did not request this code, you can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function verifyOtp(purpose: OtpPurpose, email: string, otp: string) {
  const key = otpKey(purpose, email);
  const record = otpStore.get(key);

  if (!record) return false;
  if (Date.now() > record.expiresAt) {
    otpStore.delete(key);
    return false;
  }

  if (record.code !== otp.trim()) return false;

  otpStore.delete(key);
  return true;
}

export async function sendSignupOtpEmail(email: string) {
  return sendOtpEmail(
    "SIGNUP",
    email,
    "Your signup OTP code",
    (code) =>
      `Your signup verification code is ${code}. It expires in ${OTP_EXPIRATION_MINUTES} minutes.`,
  );
}

export async function sendPasswordResetOtpEmail(email: string) {
  return sendOtpEmail(
    "PASSWORD_RESET",
    email,
    "Reset your Servio password",
    (code) =>
      `Your password reset code is ${code}. It expires in ${OTP_EXPIRATION_MINUTES} minutes.`,
  );
}

export function verifySignupOtp(email: string, otp: string) {
  return verifyOtp("SIGNUP", email, otp);
}

export function verifyPasswordResetOtp(email: string, otp: string) {
  return verifyOtp("PASSWORD_RESET", email, otp);
}
