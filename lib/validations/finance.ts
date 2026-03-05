import { z } from "zod";

export const financeSchema = z.object({
  memberId: z.string().cuid().optional().or(z.literal("")),
  serviceId: z.string().cuid().optional().or(z.literal("")),
  financeType: z.enum(["TITHE", "OFFERING", "DONATION", "SPECIAL_SEED"]),
  amount: z.coerce.number().positive(),
  paymentMethod: z.enum(["CASH", "TRANSFER", "CARD", "ONLINE"]),
  transactionDate: z.string(),
  note: z.string().trim().max(240).optional().or(z.literal("")),
});

