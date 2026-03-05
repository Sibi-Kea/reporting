import { MembershipStatus } from "@prisma/client";
import { z } from "zod";

export const memberSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  dateOfBirth: z.string().optional(),
  phone: z.string().trim().max(25).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  address: z.string().trim().max(240).optional().or(z.literal("")),
  maritalStatus: z
    .enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"])
    .optional()
    .or(z.literal("")),
  occupation: z.string().trim().max(120).optional().or(z.literal("")),
  dateJoined: z.string(),
  salvationStatus: z.coerce.boolean().default(false),
  baptismStatus: z.coerce.boolean().default(false),
  holySpiritBaptismStatus: z.coerce.boolean().default(false),
  jimJohn316Status: z.coerce.boolean().default(false),
  jimSgtStatus: z.coerce.boolean().default(false),
  jimDiscStatus: z.coerce.boolean().default(false),
  jimNltStatus: z.coerce.boolean().default(false),
  involvementNotes: z.string().trim().max(1000).optional().or(z.literal("")),
  membershipStatus: z.nativeEnum(MembershipStatus).default(MembershipStatus.ACTIVE),
  departmentId: z.string().optional().or(z.literal("")),
  homecellId: z.string().optional().or(z.literal("")),
  emergencyContactName: z.string().trim().max(120).optional().or(z.literal("")),
  emergencyContactPhone: z.string().trim().max(25).optional().or(z.literal("")),
  profilePhotoUrl: z.string().url().optional().or(z.literal("")),
});

export type MemberInput = z.infer<typeof memberSchema>;
export type MemberFormInput = z.input<typeof memberSchema>;

export const memberNoteSchema = z.object({
  memberId: z.string().cuid(),
  content: z.string().trim().min(2).max(2000),
});
