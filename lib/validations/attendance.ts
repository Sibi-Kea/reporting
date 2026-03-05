import { z } from "zod";

export const serviceSchema = z.object({
  title: z.string().trim().min(2).max(120),
  serviceType: z.enum(["SUNDAY", "MIDWEEK", "SPECIAL", "CUSTOM"]),
  eventDate: z.string(),
});

export const attendanceEntrySchema = z.object({
  memberId: z.string().cuid(),
  status: z.enum(["PRESENT", "ABSENT", "ONLINE"]),
  absentReason: z.string().trim().max(120).optional().or(z.literal("")),
  absentNote: z.string().trim().max(240).optional().or(z.literal("")),
});

export const attendanceSubmissionSchema = z.object({
  serviceId: z.string().cuid(),
  entries: z.array(attendanceEntrySchema).min(1),
});

export const selfAttendanceReportSchema = z.object({
  serviceId: z.string().cuid(),
  status: z.enum(["PRESENT", "ABSENT", "ONLINE"]),
  note: z.string().trim().max(240).optional().or(z.literal("")),
});

export const churchAttendanceMatrixSchema = z.object({
  serviceIds: z.array(z.string().cuid()).min(1),
  entries: z
    .array(
      z.object({
        memberId: z.string().cuid(),
        attendedServiceIds: z.array(z.string().cuid()),
        onlineServiceIds: z.array(z.string().cuid()).optional(),
      }),
    )
    .min(1),
});
