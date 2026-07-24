import { z } from "zod";

export const savedLocationSchema = z.object({
  label: z.string().trim().min(2, "Location name must be at least 2 characters."),
  address: z.string().trim().min(5, "Saved location address must be at least 5 characters."),
});

export const hiringNeedSchema = z
  .string()
  .trim()
  .min(2, "Skill or hiring need must be at least 2 characters.");

export const clientProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Name must be at least 2 characters."),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z.string().trim().min(6, "Phone number must be at least 6 digits."),
  companyName: z
    .string()
    .trim()
    .min(2, "Company name must be at least 2 characters.")
    .max(120, "Company name is too long."),
  companyWebsite: z.string().trim().url("Enter a valid website URL.").optional().or(z.literal("")),
  industry: z.string().trim().min(2, "Choose or enter an industry."),
  teamSize: z.string().trim().min(1, "Select a team size."),
  companyDescription: z
    .string()
    .trim()
    .min(20, "Company description must be at least 20 characters.")
    .max(600, "Company description is too long."),
  address: z.string().trim().min(5, "Address must be at least 5 characters."),
  profilePhotoUrl: z.string().trim().optional().or(z.literal("")),
  savedLocations: z.array(savedLocationSchema).min(1, "Add at least one saved location."),
  hiringNeeds: z.array(hiringNeedSchema).min(1, "Add at least one hiring need or skill."),
});

export type ClientProfileInput = z.infer<typeof clientProfileSchema>;
