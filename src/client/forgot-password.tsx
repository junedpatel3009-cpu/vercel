import { createServerFn } from "@tanstack/react-start";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { CheckCircle2, LoaderCircle, MailCheck, ShieldCheck, TriangleAlert } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { hashPassword, verifyPassword } from "@/lib/password.server";
import {
  forgotPasswordRequestSchema,
  resetPasswordSchema,
  type ForgotPasswordRequestInput,
  type ResetPasswordInput,
} from "@/lib/validation/forgot-password";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset password — Servio" }] }),
  component: Forgot,
});

const sendPasswordResetOtp = createServerFn({ method: "POST" })
  .inputValidator((data: ForgotPasswordRequestInput) => forgotPasswordRequestSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      const email = data.email.trim().toLowerCase();
      const { findUserByEmail } = await import("@/lib/user-db.server");
      const user = findUserByEmail(email);

      if (user) {
        const { sendPasswordResetOtpEmail } = await import("@/lib/otp.server");
        await sendPasswordResetOtpEmail(email);
      }

      return {
        ok: true as const,
      };
    } catch (error) {
      console.error("Send password reset OTP failed:", error);
      return {
        ok: false as const,
        formError: error instanceof Error ? error.message : "Failed to send reset code.",
      };
    }
  });

const resetPassword = createServerFn({ method: "POST" })
  .inputValidator((data: ResetPasswordInput) => resetPasswordSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      const email = data.email.trim().toLowerCase();
      const { findUserByEmail, updateUserPasswordByEmail } = await import("@/lib/user-db.server");
      const { verifyPasswordResetOtp } = await import("@/lib/otp.server");

      const fieldErrors: Partial<Record<keyof ResetPasswordInput, string>> = {};
      const user = findUserByEmail(email);

      if (!user) {
        fieldErrors.email = "No account found for that email.";
        return {
          ok: false as const,
          fieldErrors,
          formError: null,
        };
      }

      if (!verifyPasswordResetOtp(email, data.otp)) {
        fieldErrors.otp = "Invalid or expired OTP. Please resend and try again.";
        return {
          ok: false as const,
          fieldErrors,
          formError: null,
        };
      }

      if ((await verifyPassword(data.password, user.passwordHash)).valid) {
        fieldErrors.password =
          "This password is the same as your old password. Please write another password.";
        return {
          ok: false as const,
          fieldErrors,
          formError: null,
        };
      }

      const updated = updateUserPasswordByEmail(email, hashPassword(data.password));

      if (!updated) {
        return {
          ok: false as const,
          fieldErrors: {},
          formError: "Unable to update your password. Please try again.",
        };
      }

      return {
        ok: true as const,
      };
    } catch (error) {
      console.error("Reset password failed:", error);
      return {
        ok: false as const,
        fieldErrors: {},
        formError: error instanceof Error ? error.message : "Failed to reset password.",
      };
    }
  });

function Forgot() {
  const navigate = useNavigate();
  const [otpSent, setOtpSent] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const requestForm = useForm<ForgotPasswordRequestInput>({
    resolver: zodResolver(forgotPasswordRequestSchema),
    defaultValues: { email: "" },
  });

  const resetForm = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: "",
      otp: "",
      password: "",
      confirmPassword: "",
    },
  });

  const handleSendOtp = async (values: ForgotPasswordRequestInput) => {
    setIsSendingOtp(true);
    setStatusMessage(null);
    setSubmitError(null);

    try {
      const result = await sendPasswordResetOtp({ data: values });

      if (!result.ok) {
        if (result.formError) {
          setSubmitError(result.formError);
        }
        return;
      }

      const email = values.email.trim().toLowerCase();
      setOtpSent(true);
      setStatusMessage("If an account exists for this email, a reset code has been sent.");
      resetForm.reset({ email, otp: "", password: "", confirmPassword: "" });
      requestForm.reset({ email });
    } catch (error) {
      console.error("Send OTP failed:", error);
      setSubmitError(error instanceof Error ? error.message : "Could not send reset code.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleResetPassword = async (values: ResetPasswordInput) => {
    setIsResetting(true);
    setSubmitError(null);
    setStatusMessage(null);

    try {
      const result = await resetPassword({ data: values });

      if (!result.ok) {
        if (result.formError) {
          setSubmitError(result.formError);
        }
        if (result.fieldErrors) {
          Object.entries(result.fieldErrors).forEach(([field, message]) => {
            if (message) {
              resetForm.setError(field as keyof ResetPasswordInput, { type: "server", message });
            }
          });
        }
        return;
      }

      setStatusMessage("Your password has been reset successfully. Redirecting to login...");
      window.setTimeout(() => navigate({ to: "/login" }), 1200);
    } catch (error) {
      console.error("Reset password failed:", error);
      setSubmitError(error instanceof Error ? error.message : "Password reset failed.");
    } finally {
      setIsResetting(false);
    }
  };

  const handleResendOtp = async () => {
    const email = requestForm.getValues("email").trim();

    if (!email) {
      requestForm.setError("email", {
        type: "manual",
        message: "Enter your email to resend the code.",
      });
      return;
    }

    setIsSendingOtp(true);
    setSubmitError(null);
    setStatusMessage(null);

    try {
      const result = await sendPasswordResetOtp({ data: { email } });

      if (!result.ok) {
        if (result.formError) {
          setSubmitError(result.formError);
        }
        return;
      }

      setStatusMessage("A new code has been sent if this email is registered.");
      resetForm.setValue("email", email);
    } catch (error) {
      console.error("Resend OTP failed:", error);
      setSubmitError(error instanceof Error ? error.message : "Could not resend reset code.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle={
        otpSent
          ? "Enter the code from your email and choose a new password."
          : "Enter your email and we’ll send a reset code."
      }
      footer={
        <>
          Remembered it?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Back to log in
          </Link>
        </>
      }
    >
      {otpSent ? (
        <Form {...resetForm}>
          <form
            onSubmit={resetForm.handleSubmit(handleResetPassword)}
            className="space-y-4"
            noValidate
          >
            <div className="rounded-xl border border-success/20 bg-success/5 px-4 py-4 text-success shadow-soft">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-success/10">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Reset code sent</p>
                  <p className="mt-0.5 text-sm opacity-85">
                    Check your email and enter the code below. It expires in a few minutes.
                  </p>
                </div>
                <CheckCircle2 className="ml-auto h-4 w-4 shrink-0" />
              </div>
            </div>

            <FormField
              control={resetForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      disabled
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={resetForm.control}
              name="otp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reset code</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="123456" autoComplete="one-time-code" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={resetForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={resetForm.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm password</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder="Confirm password"
                      autoComplete="new-password"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {submitError ? <OtpNotice message={submitError} tone="error" /> : null}
            {statusMessage ? <OtpNotice message={statusMessage} tone="success" /> : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                disabled={isSendingOtp}
                onClick={handleResendOtp}
              >
                {isSendingOtp ? "Resending code..." : "Resend code"}
              </Button>
              <Button type="submit" className="w-full sm:w-auto" disabled={isResetting}>
                {isResetting ? "Resetting..." : "Reset password"}
              </Button>
            </div>
          </form>
        </Form>
      ) : (
        <Form {...requestForm}>
          <form onSubmit={requestForm.handleSubmit(handleSendOtp)} className="space-y-4" noValidate>
            <FormField
              control={requestForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {submitError ? <OtpNotice message={submitError} tone="error" /> : null}
            {statusMessage ? (
              <OtpNotice message={statusMessage} tone={isSendingOtp ? "sending" : "success"} />
            ) : null}

            <Button type="submit" className="w-full" disabled={isSendingOtp}>
              {isSendingOtp ? "Sending code..." : "Send reset code"}
            </Button>
          </form>
        </Form>
      )}
    </AuthLayout>
  );
}

function OtpNotice({ message, tone }: { message: string; tone: "sending" | "success" | "error" }) {
  const Icon = tone === "sending" ? LoaderCircle : tone === "error" ? TriangleAlert : MailCheck;

  return (
    <div
      className={`rounded-xl border px-4 py-3 shadow-soft ${
        tone === "sending"
          ? "border-primary/20 bg-primary/5 text-primary"
          : tone === "error"
            ? "border-destructive/20 bg-destructive/5 text-destructive"
            : "border-success/20 bg-success/5 text-success"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
            tone === "sending"
              ? "bg-primary/10"
              : tone === "error"
                ? "bg-destructive/10"
                : "bg-success/10"
          }`}
        >
          <Icon className={`h-4 w-4 ${tone === "sending" ? "animate-spin" : ""}`} />
        </div>
        <p className="min-w-0 text-sm font-medium">{message}</p>
      </div>
    </div>
  );
}
