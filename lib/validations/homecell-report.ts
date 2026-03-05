import { z } from "zod";

export const homecellReportMemberSchema = z.object({
  memberId: z.string().cuid().optional(),
  memberName: z.string().trim().min(2).max(120),
  present: z.coerce.boolean().optional(),
  homecellPresent: z.coerce.boolean().optional(),
  churchPresent: z.coerce.boolean().optional(),
  churchAttendedLabels: z.array(z.string().trim().min(2).max(120)).max(20).optional(),
  churchMorningPresent: z.coerce.boolean().optional(),
  churchMorningAttendedLabel: z.string().trim().max(120).optional().or(z.literal("")),
  churchMorningAbsenceReason: z.string().trim().max(120).optional().or(z.literal("")),
  churchMorningAbsenceNote: z.string().trim().max(240).optional().or(z.literal("")),
  churchEveningPresent: z.coerce.boolean().optional(),
  churchEveningAttendedLabel: z.string().trim().max(120).optional().or(z.literal("")),
  churchEveningAbsenceReason: z.string().trim().max(120).optional().or(z.literal("")),
  churchEveningAbsenceNote: z.string().trim().max(240).optional().or(z.literal("")),
  absenceReason: z.string().trim().max(120).optional().or(z.literal("")),
  absenceNote: z.string().trim().max(240).optional().or(z.literal("")),
  homecellAbsenceReason: z.string().trim().max(120).optional().or(z.literal("")),
  homecellAbsenceNote: z.string().trim().max(240).optional().or(z.literal("")),
  churchAbsenceReason: z.string().trim().max(120).optional().or(z.literal("")),
  churchAbsenceNote: z.string().trim().max(240).optional().or(z.literal("")),
});

export const homecellReportSchema = z.object({
  homecellId: z.string().cuid(),
  weekStartDate: z.string(),
  weekEndDate: z.string(),
  visitors: z.coerce.number().int().min(0).default(0),
  firstTimeVisitors: z.coerce.number().int().min(0).default(0),
  prayerRequests: z.string().trim().max(2000).optional().or(z.literal("")),
  offeringCollected: z.string().optional().or(z.literal("")),
  members: z.array(homecellReportMemberSchema).min(1),
});

export const unlockReportSchema = z.object({
  reportId: z.string().cuid(),
});
