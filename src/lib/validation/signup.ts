import { z } from "zod";

export const signupSchema = z.object({
  accountType: z.enum(["client", "professional"]),
  firstName: z
    .string()
    .trim()
    .min(2, "First name must be at least 2 characters.")
    .max(40, "First name is too long."),
  lastName: z
    .string()
    .trim()
    .min(2, "Last name must be at least 2 characters.")
    .max(40, "Last name is too long."),
  email: z.string().trim().email("Enter a valid email address."),
  otp: z
    .string()
    .trim()
    .regex(/^\d{4,6}$/, "Enter the 4-6 digit OTP sent to your email."),
  countryCode: z
    .string()
    .trim()
    .regex(/^\+\d{1,4}$/, "Select a valid country code."),
  phone: z
    .string()
    .trim()
    .regex(/^\d{6,14}$/, "Enter a valid phone number."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Z]/, "Password must include one uppercase letter.")
    .regex(/[a-z]/, "Password must include one lowercase letter.")
    .regex(/[0-9]/, "Password must include one number.")
    .regex(/[^A-Za-z0-9]/, "Password must include one special character."),
});

export type SignupInput = z.infer<typeof signupSchema>;

export function normalizePhone(countryCode: string, phone: string) {
  return `${countryCode}${phone.replace(/\s+/g, "")}`;
}
