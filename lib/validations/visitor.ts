import { z } from "zod";

export const visitorSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().max(80).optional().or(z.literal("")),
  phone: z.string().trim().min(6).max(25),
  invitedBy: z.string().trim().max(120).optional().or(z.literal("")),
  firstTime: z.coerce.boolean().default(true),
  firstVisitDate: z.string(),
  followUpStatus: z.enum(["PENDING", "CONTACTED", "SCHEDULED", "COMPLETED"]),
  convertedToMember: z.coerce.boolean().default(false),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

