import { z } from "zod";

const passwordValidation = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .regex(/[A-Z]/, "Password must include one uppercase letter.")
  .regex(/[a-z]/, "Password must include one lowercase letter.")
  .regex(/[0-9]/, "Password must include one number.")
  .regex(/[^A-Za-z0-9]/, "Password must include one special character.");

export const forgotPasswordRequestSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

export const resetPasswordSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email address."),
    otp: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Enter the 6-digit OTP sent to your email."),
    password: passwordValidation,
    confirmPassword: z.string().min(8, "Confirm your new password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export type ForgotPasswordRequestInput = z.infer<typeof forgotPasswordRequestSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
