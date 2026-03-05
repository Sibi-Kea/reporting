"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { createFinanceTransactionAction } from "@/app/dashboard/finance/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Option = {
  id: string;
  name: string;
};

type FinanceFormProps = {
  members: Option[];
  services: Option[];
};

export function FinanceForm({ members, services }: FinanceFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-3 md:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await createFinanceTransactionAction(formData);
          if (!result.success) {
            toast.error(result.message);
            return;
          }
          toast.success(result.message);
          event.currentTarget.reset();
          router.refresh();
        });
      }}
    >
      <Select name="financeType" defaultValue="TITHE">
        <option value="TITHE">Tithe</option>
        <option value="OFFERING">Offering</option>
        <option value="DONATION">Donation</option>
        <option value="SPECIAL_SEED">Special seed</option>
      </Select>
      <Input name="amount" type="number" min={0.01} step="0.01" placeholder="Amount" />
      <Input name="transactionDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
      <Select name="paymentMethod" defaultValue="CASH">
        <option value="CASH">Cash</option>
        <option value="TRANSFER">Transfer</option>
        <option value="CARD">Card</option>
        <option value="ONLINE">Online</option>
      </Select>
      <Select name="memberId">
        <option value="">Anonymous / non-member</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </Select>
      <Select name="serviceId">
        <option value="">No service linked</option>
        {services.map((service) => (
          <option key={service.id} value={service.id}>
            {service.name}
          </option>
        ))}
      </Select>
      <Input className="md:col-span-2" name="note" placeholder="Optional note" />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Record"}
      </Button>
    </form>
  );
}

