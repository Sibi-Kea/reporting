"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createChurchAction,
  updateChurchServiceLabelsAction,
} from "@/app/dashboard/admin/churches/actions";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ChurchOption = {
  id: string;
  name: string;
  slug: string;
  attendanceServiceLabels: string[];
  attendanceMorningServiceLabels: string[];
  attendanceEveningServiceLabels: string[];
  attendanceOnlineServiceLabels: string[];
};

type ChurchSettingsFormProps = {
  churches: ChurchOption[];
  currentChurchId: string | null;
};

export function ChurchSettingsForm({ churches, currentChurchId }: ChurchSettingsFormProps) {
  const router = useRouter();
  const [isCreating, startCreateTransition] = useTransition();
  const [isSavingLabels, startLabelsTransition] = useTransition();

  const initialChurchId = currentChurchId ?? churches[0]?.id ?? "";
  const [selectedChurchId, setSelectedChurchId] = useState(initialChurchId);

  const churchById = useMemo(() => new Map(churches.map((church) => [church.id, church])), [churches]);
  const [morningLabelsText, setMorningLabelsText] = useState(
    (churchById.get(initialChurchId)?.attendanceMorningServiceLabels ?? []).join("\n"),
  );
  const [eveningLabelsText, setEveningLabelsText] = useState(
    (churchById.get(initialChurchId)?.attendanceEveningServiceLabels ?? []).join("\n"),
  );
  const [onlineLabelsText, setOnlineLabelsText] = useState(
    (churchById.get(initialChurchId)?.attendanceOnlineServiceLabels ?? []).join("\n"),
  );

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardTitle>Add Church</CardTitle>
        <CardDescription className="mt-1">Create a new church profile for your structure network.</CardDescription>
        <form
          className="mt-4 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startCreateTransition(async () => {
              const result = await createChurchAction(formData);
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
          <Input name="name" placeholder="Church name (e.g. Bloem)" />
          <Input name="slug" placeholder="church-slug (e.g. bloem)" />
          <Input name="email" placeholder="church@email.com (optional)" />
          <Input name="phone" placeholder="Phone (optional)" />
          <Input name="address" placeholder="Address (optional)" />
          <Button type="submit" disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Church"}
          </Button>
        </form>
      </Card>

      <Card>
        <CardTitle>Church Service Settings</CardTitle>
        <CardDescription className="mt-1">
          Configure attendance service groups by morning, evening, and online (one per line).
        </CardDescription>
        <form
          className="mt-4 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            startLabelsTransition(async () => {
              const formData = new FormData();
              formData.set("churchId", selectedChurchId);
              formData.set("morningLabelsText", morningLabelsText);
              formData.set("eveningLabelsText", eveningLabelsText);
              formData.set("onlineLabelsText", onlineLabelsText);
              const result = await updateChurchServiceLabelsAction(formData);
              if (!result.success) {
                toast.error(result.message);
                return;
              }
              toast.success(result.message);
              router.refresh();
            });
          }}
        >
          <Select
            value={selectedChurchId}
            onChange={(event) => {
              const churchId = event.target.value;
              setSelectedChurchId(churchId);
              const church = churchById.get(churchId);
              setMorningLabelsText((church?.attendanceMorningServiceLabels ?? []).join("\n"));
              setEveningLabelsText((church?.attendanceEveningServiceLabels ?? []).join("\n"));
              setOnlineLabelsText((church?.attendanceOnlineServiceLabels ?? []).join("\n"));
            }}
          >
            {churches.map((church) => (
              <option key={church.id} value={church.id}>
                {church.name} ({church.slug})
              </option>
            ))}
          </Select>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Morning</p>
              <Textarea
                value={morningLabelsText}
                onChange={(event) => setMorningLabelsText(event.target.value)}
                rows={8}
                placeholder={"North AM1\nSouth AM\nSouth AM2"}
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Evening</p>
              <Textarea
                value={eveningLabelsText}
                onChange={(event) => setEveningLabelsText(event.target.value)}
                rows={8}
                placeholder={"South PM"}
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Online</p>
              <Textarea
                value={onlineLabelsText}
                onChange={(event) => setOnlineLabelsText(event.target.value)}
                rows={8}
                placeholder={"Online AM1\nOnline PM"}
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Tip: one label per line. Commas are also accepted.
          </p>
          <Button type="submit" disabled={isSavingLabels || !selectedChurchId}>
            {isSavingLabels ? "Saving..." : "Save Service Groups"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
