import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Chrome } from "lucide-react";
import { useForm } from "react-hook-form";
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
import { createSessionCookie } from "@/lib/auth-session.server";
import { hashPassword, verifyPassword } from "@/lib/password.server";
import { loginSchema, type LoginInput } from "@/lib/validation/login";
import {
  clearLoginFeedback,
  setLoginSubmitError,
  setLoginSubmitting,
  setLoginSuccessMessage,
} from "@/store/authSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — Servio" },
      { name: "description", content: "Log in to your Servio account." },
    ],
  }),
  component: Login,
});

const submitLogin = createServerFn({ method: "POST" })
  .inputValidator((data: LoginInput) => loginSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      const { findUserByEmail, recordUserLogin, getProfessionalProfileByUserId } =
        await import("@/lib/user-db.server");

      const email = data.email.trim().toLowerCase();
      const user = findUserByEmail(email);

      if (!user) {
        return {
          ok: false as const,
          fieldErrors: {
            email: "No account found for that email.",
          },
          formError: null,
        };
      }

      if (!user.isActive) {
        return {
          ok: false as const,
          fieldErrors: {
            email: "This account is disabled. Contact an administrator.",
          },
          formError: null,
        };
      }

      if (!user.passwordHash) {
        return {
          ok: false as const,
          fieldErrors: {
            email: user.googleId
              ? "This account uses Google sign-in. Continue with Google instead."
              : "This account does not have a password yet.",
          },
          formError: null,
        };
      }

      const passwordCheck = await verifyPassword(data.password, user.passwordHash);
      if (!passwordCheck.valid) {
        return {
          ok: false as const,
          fieldErrors: {
            password: "Incorrect password.",
          },
          formError: null,
        };
      }

      if (passwordCheck.needsUpgrade) {
        const { updateUserPasswordByEmail } = await import("@/lib/user-db.server");
        updateUserPasswordByEmail(email, hashPassword(data.password));
      }

      recordUserLogin(user.id);

      let isProfileComplete = false;
      if (user.role === "PROFESSIONAL") {
        const proProfile = getProfessionalProfileByUserId(user.id);
        isProfileComplete = !!(
          proProfile?.professionalCategory &&
          proProfile?.professionalCity &&
          proProfile?.professionalSkillsJson &&
          proProfile?.companyDescription &&
          proProfile?.address
        );
      }

      setResponseHeader(
        "Set-Cookie",
        createSessionCookie({
          id: user.id,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          avatarUrl: user.avatarUrl,
          authProvider: user.authProvider,
        }),
      );

      return {
        ok: true as const,
        isProfileComplete,
        user: {
          id: user.id,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          avatarUrl: user.avatarUrl,
          authProvider: user.authProvider,
        },
      };
    } catch (error) {
      console.error("Login server action failed:", error);
      return {
        ok: false as const,
        fieldErrors: {},
        formError: error instanceof Error ? error.message : "Unknown server error",
      };
    }
  });

function Login() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { submitError, successMessage, isSubmitting } = useAppSelector((state) => state.auth.login);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginInput) => {
    dispatch(clearLoginFeedback());
    dispatch(setLoginSubmitting(true));
    form.clearErrors();

    try {
      const result = await submitLogin({ data: values });

      if (!result.ok) {
        Object.entries(result.fieldErrors).forEach(([field, message]) => {
          if (message) {
            form.setError(field as keyof LoginInput, { type: "server", message });
          }
        });

        if (result.formError) {
          dispatch(setLoginSubmitError(result.formError));
        }
        return;
      }

      const nextRoute =
        result.user.role === "ADMIN"
          ? "/"
          : result.user.role === "CLIENT"
            ? "/"
            : result.isProfileComplete
              ? "/"
              : "/professional-profile";
      dispatch(setLoginSuccessMessage(`Welcome back ${result.user.firstName}. Redirecting...`));
      await navigate({ to: nextRoute });
    } catch (error) {
      console.error("Login failed:", error);
      dispatch(
        setLoginSubmitError(
          error instanceof Error ? error.message : "Login failed. Please try again.",
        ),
      );
    } finally {
      dispatch(setLoginSubmitting(false));
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to continue to your dashboard."
      footer={
        <>
          Don't have an account?{" "}
          <Link to="/signup" className="text-primary hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <Button asChild type="button" variant="outline">
              <a href="/api/auth/google?returnTo=/">
                <Chrome />
                Continue with Google
              </a>
            </Button>
            <Button type="button" variant="outline">
              Continue with Apple
            </Button>
          </div>

          <div className="relative py-2 text-center text-xs text-muted-foreground">
            <span className="relative z-10 bg-background px-3">or</span>
            <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
          </div>

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Password</FormLabel>
                  <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                    Forgot?
                  </Link>
                </div>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
          {successMessage ? <p className="text-sm text-success">{successMessage}</p> : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            Log in
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
}
