import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Chrome, LoaderCircle, MailCheck, TriangleAlert } from "lucide-react";
import { Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSessionCookie } from "@/lib/auth-session.server";
import { hashPassword } from "@/lib/password.server";
import { normalizePhone, signupSchema, type SignupInput } from "@/lib/validation/signup";
import {
  clearSignupFeedback,
  setSignupOtpStatus,
  setSignupSendingOtp,
  setSignupShowPassword,
  setSignupSubmitError,
  setSignupSubmitting,
  setSignupSuccessMessage,
} from "@/store/authSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign up — Servio" },
      { name: "description", content: "Create your Servio account with full validation." },
    ],
  }),
  component: Signup,
});

const sendSignupOtp = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string }) =>
    z.object({ email: z.string().trim().email("Enter a valid email address.") }).parse(data),
  )
  .handler(async ({ data }) => {
    try {
      const { sendSignupOtpEmail } = await import("@/lib/otp.server");
      const email = data.email.trim().toLowerCase();
      await sendSignupOtpEmail(email);

      return {
        ok: true as const,
      };
    } catch (error) {
      console.error("Send OTP failed:", error);
      return {
        ok: false as const,
        formError: error instanceof Error ? error.message : "Failed to send OTP.",
      };
    }
  });

const submitSignup = createServerFn({ method: "POST" })
  .inputValidator((data: SignupInput) => signupSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      const { createUserRecord, findUserByEmailOrPhone } = await import("@/lib/user-db.server");
      const { verifySignupOtp } = await import("@/lib/otp.server");

      const email = data.email.trim().toLowerCase();
      const phone = normalizePhone(data.countryCode, data.phone);
      const existingUser = findUserByEmailOrPhone(email, phone);

      const fieldErrors: Partial<Record<keyof SignupInput, string>> = {};

      if (existingUser?.email === email) {
        fieldErrors.email = "This email address is already registered.";
      }

      if (existingUser?.phone === phone) {
        fieldErrors.phone = "This phone number is already registered.";
      }

      if (!verifySignupOtp(email, data.otp)) {
        fieldErrors.otp = "Invalid or expired OTP. Please resend and try again.";
      }

      if (Object.keys(fieldErrors).length > 0) {
        return {
          ok: false as const,
          fieldErrors,
          formError: null,
        };
      }

      const passwordHash = hashPassword(data.password);

      const createdUser = createUserRecord({
        role: data.accountType === "client" ? "CLIENT" : "PROFESSIONAL",
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email,
        phone,
        passwordHash,
      });

      setResponseHeader("Set-Cookie", createSessionCookie(createdUser));

      return {
        ok: true as const,
        user: createdUser,
      };
    } catch (error) {
      console.error("Signup server action failed:", error);
      return {
        ok: false as const,
        fieldErrors: {},
        formError: error instanceof Error ? error.message : "Unknown server error",
      };
    }
  });

const countryCodes = [
  { value: "+1", label: "United States (+1)" },
  { value: "+44", label: "United Kingdom (+44)" },
  { value: "+61", label: "Australia (+61)" },
  { value: "+91", label: "India (+91)" },
  { value: "+971", label: "UAE (+971)" },
] as const;

function Signup() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { successMessage, submitError, showPassword, otpStatus, isSendingOtp, isSubmitting } =
    useAppSelector((state) => state.auth.signup);

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      accountType: "client",
      firstName: "",
      lastName: "",
      email: "",
      otp: "",
      countryCode: "+1",
      phone: "",
      password: "",
    },
  });

  const accountType = form.watch("accountType");

  function parseCountryCodeFromPhone(rawPhone: string) {
    const sanitized = rawPhone.replace(/\s+/g, "");
    if (!sanitized.startsWith("+")) return undefined;

    return countryCodes
      .slice()
      .sort((a, b) => b.value.length - a.value.length)
      .find((country) => sanitized.startsWith(country.value))?.value;
  }

  function handlePhoneInputChange(value: string, onChange: (value: string) => void) {
    const sanitized = value.replace(/[^\d+]/g, "");
    const matchedCode = parseCountryCodeFromPhone(sanitized);

    if (matchedCode) {
      const rest = sanitized.slice(matchedCode.length).replace(/\D/g, "");
      form.setValue("countryCode", matchedCode, { shouldValidate: true });
      onChange(rest);
      return;
    }

    onChange(sanitized.replace(/^\+/, ""));
  }

  const onSubmit = async (values: SignupInput) => {
    dispatch(clearSignupFeedback());
    dispatch(setSignupSubmitting(true));
    form.clearErrors();

    try {
      const result = await submitSignup({ data: values });

      if (!result.ok) {
        Object.entries(result.fieldErrors).forEach(([field, message]) => {
          if (message) {
            form.setError(field as keyof SignupInput, { type: "server", message });
          }
        });
        if (result.formError) {
          dispatch(setSignupSubmitError(result.formError));
        }
        return;
      }

      form.reset({
        accountType: values.accountType,
        firstName: "",
        lastName: "",
        email: "",
        otp: "",
        countryCode: values.countryCode,
        phone: "",
        password: "",
      });

      dispatch(
        setSignupSuccessMessage(
          `Account created for ${result.user.firstName} ${result.user.lastName}. Redirecting to profile setup...`,
        ),
      );
      await navigate({
        to: result.user.role === "CLIENT" ? "/profile-setup" : "/professional-profile",
      });
    } catch (error) {
      console.error("Signup failed:", error);
      dispatch(
        setSignupSubmitError(
          error instanceof Error
            ? error.message
            : "Signup failed. Please check your details and try again.",
        ),
      );
    } finally {
      dispatch(setSignupSubmitting(false));
    }
  };

  return (
    <AuthLayout
      title={`Create your ${accountType} account`}
      subtitle="Complete every field below. Email, phone, and password are all required."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <div className="mb-5">
        <p className="mb-3 text-sm font-medium text-foreground">I’m signing up as</p>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
          {(
            [
              { value: "client", label: "I'm a client" },
              { value: "professional", label: "I'm a professional" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => form.setValue("accountType", option.value, { shouldValidate: true })}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                accountType === option.value
                  ? "bg-card text-foreground shadow-soft"
                  : "text-muted-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-3">
            <Button asChild type="button" variant="outline" className="w-full">
              <a href="/api/auth/google?returnTo=/profile-setup">
                <Chrome />
                Register with Google
              </a>
            </Button>
          </div>

          <div className="relative py-2 text-center text-xs text-muted-foreground">
            <span className="relative z-10 bg-background px-3">or</span>
            <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First name</FormLabel>
                  <FormControl>
                    <Input placeholder="FIRST" autoComplete="given-name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last name</FormLabel>
                  <FormControl>
                    <Input placeholder="LAST" autoComplete="family-name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between gap-3">
                  <FormLabel>Email address</FormLabel>
                  <Button
                    type="button"
                    className="h-9 whitespace-nowrap text-sm"
                    onClick={async () => {
                      const email = field.value.trim();
                      const emailValidation = z.string().trim().email().safeParse(email);

                      if (!emailValidation.success) {
                        form.setError("email", {
                          type: "manual",
                          message: "Enter a valid email address before sending OTP.",
                        });
                        dispatch(setSignupOtpStatus(null));
                        return;
                      }

                      form.clearErrors("email");
                      dispatch(setSignupOtpStatus("Sending OTP from Servio..."));
                      dispatch(setSignupSendingOtp(true));

                      try {
                        const result = await sendSignupOtp({ data: { email } });
                        if (!result.ok) {
                          if (result.formError) {
                            dispatch(setSignupOtpStatus(result.formError));
                          }
                          return;
                        }
                        dispatch(setSignupOtpStatus("OTP sent to your email. Check your inbox."));
                      } catch (error) {
                        console.error("Send OTP error:", error);
                        dispatch(
                          setSignupOtpStatus(
                            "Could not send OTP. Please check the email and try again.",
                          ),
                        );
                      } finally {
                        dispatch(setSignupSendingOtp(false));
                      }
                    }}
                    disabled={isSendingOtp}
                  >
                    {isSendingOtp ? "Sending..." : "Send OTP"}
                  </Button>
                </div>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Required. This must be a valid and unique email address.
                </FormDescription>
                <FormMessage />
                {otpStatus ? <OtpStatusCard message={otpStatus} isSending={isSendingOtp} /> : null}
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="otp"
            render={({ field }) => (
              <FormItem>
                <FormLabel>OTP code</FormLabel>
                <FormControl>
                  <Input placeholder="Enter OTP" autoComplete="one-time-code" {...field} />
                </FormControl>
                <FormDescription>Enter the 4-6 digit code sent to your email.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-[180px_1fr] gap-3">
            <FormField
              control={form.control}
              name="countryCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country code</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Code" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {countryCodes.map((country) => (
                        <SelectItem key={country.value} value={country.value}>
                          {country.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone number</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="555 123 4567"
                      autoComplete="tel"
                      value={field.value}
                      onChange={(event) =>
                        handlePhoneInputChange(event.target.value, field.onChange)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a password"
                    autoComplete="new-password"
                    {...field}
                  />
                </FormControl>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>Minimum 8 characters.</span>
                  <button
                    type="button"
                    className="text-primary hover:text-primary/80"
                    onClick={() => dispatch(setSignupShowPassword(!showPassword))}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {submitError ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {submitError}
            </div>
          ) : null}
          {successMessage ? (
            <div className="rounded-xl border border-success/20 bg-success/5 px-4 py-3 text-sm text-success">
              {successMessage}
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            Create account
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
}

function OtpStatusCard({ message, isSending }: { message: string; isSending: boolean }) {
  const isError = /failed|error|invalid|could not/i.test(message);
  const Icon = isSending ? LoaderCircle : isError ? TriangleAlert : MailCheck;

  return (
    <div
      className={`mt-3 rounded-xl border px-4 py-3 shadow-soft ${
        isSending
          ? "border-primary/20 bg-primary/5 text-primary"
          : isError
            ? "border-destructive/20 bg-destructive/5 text-destructive"
            : "border-success/20 bg-success/5 text-success"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
            isSending ? "bg-primary/10" : isError ? "bg-destructive/10" : "bg-success/10"
          }`}
        >
          <Icon className={`h-4 w-4 ${isSending ? "animate-spin" : ""}`} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {isSending ? "Sending OTP" : isError ? "OTP could not be sent" : "OTP sent"}
          </p>
          <p className="mt-0.5 text-sm opacity-85">{message}</p>
        </div>
        {!isSending && !isError ? <CheckCircle2 className="ml-auto h-4 w-4 shrink-0" /> : null}
      </div>
    </div>
  );
}
