import { z } from "zod";

export const jobUrgencySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export const jobWorkModeSchema = z.enum(["ON_SITE", "REMOTE", "BOTH"]);
export const jobTimingTypeSchema = z.enum(["FIXED", "HOURLY", "WEEKLY"]);
export const jobStatusSchema = z.enum(["DRAFT", "OPEN", "CLOSED"]);

export const clientJobAttachmentSchema = z.object({
  fileName: z.string().trim().min(1, "File name is required."),
  fileType: z.string().trim().optional().or(z.literal("")),
  fileSize: z.number().int().nonnegative().optional(),
  previewUrl: z.string().trim().optional().or(z.literal("")),
});

export const clientJobSchema = z
  .object({
    category: z.string().trim().min(2, "Select a category."),
    title: z.string().trim().min(1, "Add a job title."),
    description: z
      .string()
      .trim()
      .min(40, "Description must be at least 40 characters.")
      .max(4000, "Description is too long."),
    attachments: z.array(clientJobAttachmentSchema).max(10, "Upload up to 10 files.").default([]),
    budgetMin: z.coerce.number().int().nonnegative().optional().nullable(),
    budgetMax: z.coerce.number().int().positive().optional().nullable(),
    urgency: jobUrgencySchema,
    timingType: jobTimingTypeSchema.default("FIXED"),
    hourlyRate: z.coerce.number().int().positive().optional().nullable(),
    jobDate: z.string().trim().optional().or(z.literal("")),
    deadline: z.string().trim().optional().or(z.literal("")).default(""),
    workMode: jobWorkModeSchema,
    locationLabel: z.string().trim().optional().or(z.literal("")),
    locationAddress: z.string().trim().optional().or(z.literal("")),
    locationLat: z.number().optional().nullable(),
    locationLng: z.number().optional().nullable(),
    status: jobStatusSchema.default("OPEN"),
  })
  .superRefine((data, ctx) => {
    if (data.budgetMin != null && data.budgetMax != null && data.budgetMin > data.budgetMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["budgetMax"],
        message: "Maximum budget must be greater than minimum budget.",
      });
    }

    if (data.timingType === "FIXED" && !data.deadline.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deadline"],
        message: "Add a deadline.",
      });
    }

    if (
      data.workMode !== "REMOTE" &&
      (!data.locationAddress?.trim() || data.locationLat == null || data.locationLng == null)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["locationAddress"],
        message: "Select a job location by choosing a suggestion or dropping the map pin.",
      });
    }
  });

export const draftClientJobSchema = z
  .object({
    category: z.string().trim().max(120).default(""),
    title: z.string().trim().default(""),
    description: z.string().trim().max(4000, "Description is too long.").default(""),
    attachments: z.array(clientJobAttachmentSchema).max(10, "Upload up to 10 files.").default([]),
    budgetMin: z.coerce.number().int().nonnegative().optional().nullable(),
    budgetMax: z.coerce.number().int().positive().optional().nullable(),
    urgency: jobUrgencySchema,
    timingType: jobTimingTypeSchema.default("FIXED"),
    hourlyRate: z.coerce.number().int().positive().optional().nullable(),
    jobDate: z.string().trim().optional().or(z.literal("")),
    deadline: z.string().trim().optional().or(z.literal("")).default(""),
    workMode: jobWorkModeSchema,
    locationLabel: z.string().trim().optional().or(z.literal("")),
    locationAddress: z.string().trim().optional().or(z.literal("")),
    locationLat: z.number().optional().nullable(),
    locationLng: z.number().optional().nullable(),
    status: z.literal("DRAFT"),
  })
  .superRefine((data, ctx) => {
    if (data.budgetMin != null && data.budgetMax != null && data.budgetMin > data.budgetMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["budgetMax"],
        message: "Maximum budget must be greater than minimum budget.",
      });
    }
  });

export const saveClientJobSchema = z.union([draftClientJobSchema, clientJobSchema]);

export type ClientJobInput = z.infer<typeof clientJobSchema>;
export type ClientJobAttachmentInput = z.infer<typeof clientJobAttachmentSchema>;
