import { z } from "zod";

export const churchSchema = z.object({
  name: z.string().trim().min(3).max(120),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().max(25).optional().or(z.literal("")),
  address: z.string().trim().max(240).optional().or(z.literal("")),
  pastorUserId: z.string().cuid().optional().or(z.literal("")),
});

export const churchServiceLabelsSchema = z.object({
  churchId: z.string().cuid(),
  labels: z.array(z.string().trim().min(2).max(120)).min(1).max(20),
});

export const churchServiceGroupsSchema = z
  .object({
    churchId: z.string().cuid(),
    morningLabels: z.array(z.string().trim().min(2).max(120)).max(20),
    eveningLabels: z.array(z.string().trim().min(2).max(120)).max(20),
    onlineLabels: z.array(z.string().trim().min(2).max(120)).max(20),
  })
  .refine(
    (value) => value.morningLabels.length + value.eveningLabels.length + value.onlineLabels.length > 0,
    { message: "At least one service label is required." },
  );
