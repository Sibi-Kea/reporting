"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { createMemberAction, updateMemberAction } from "@/app/dashboard/members/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { memberSchema, type MemberFormInput } from "@/lib/validations/member";

const draftKey = "chms-member-draft-v1";

type Option = {
  id: string;
  name: string;
};

type MemberFormProps = {
  mode: "create" | "edit";
  memberId?: string;
  initialValues?: Partial<MemberFormInput>;
  departments: Option[];
  homecells: Option[];
};

const defaultValues: MemberFormInput = {
  firstName: "",
  lastName: "",
  gender: "MALE",
  dateOfBirth: "",
  phone: "",
  email: "",
  address: "",
  maritalStatus: "",
  occupation: "",
  dateJoined: new Date().toISOString().slice(0, 10),
  salvationStatus: false,
  baptismStatus: false,
  holySpiritBaptismStatus: false,
  jimJohn316Status: false,
  jimSgtStatus: false,
  jimDiscStatus: false,
  jimNltStatus: false,
  involvementNotes: "",
  membershipStatus: "ACTIVE",
  departmentId: "",
  homecellId: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  profilePhotoUrl: "",
};

export function MemberForm({
  mode,
  memberId,
  initialValues,
  departments,
  homecells,
}: MemberFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const mergedDefaults = useMemo(
    () => ({
      ...defaultValues,
      ...initialValues,
    }),
    [initialValues],
  );

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<MemberFormInput>({
    resolver: zodResolver(memberSchema),
    defaultValues: mergedDefaults,
  });

  const watchedValues = useWatch({ control });

  useEffect(() => {
    if (mode !== "create") return;
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<MemberFormInput>;
      (Object.keys(parsed) as Array<keyof MemberFormInput>).forEach((key) => {
        if (parsed[key] !== undefined) {
          setValue(key, parsed[key] as never);
        }
      });
    } catch {
      localStorage.removeItem(draftKey);
    }
  }, [mode, setValue]);

  useEffect(() => {
    if (mode !== "create") return;
    localStorage.setItem(draftKey, JSON.stringify(watchedValues));
  }, [mode, watchedValues]);

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const formData = new FormData();
      Object.entries(values).forEach(([key, value]) => {
        formData.append(key, String(value ?? ""));
      });

      const result =
        mode === "create"
          ? await createMemberAction(formData)
          : await updateMemberAction(memberId ?? "", formData);

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      if (mode === "create") {
        localStorage.removeItem(draftKey);
        if (result.memberId) {
          router.push(`/dashboard/members/${result.memberId}`);
        } else {
          router.refresh();
        }
      } else {
        router.refresh();
      }
    });
  });

  async function uploadPhoto(file: File) {
    setUploading(true);
    const uploadFormData = new FormData();
    uploadFormData.append("file", file);
    const response = await fetch("/api/upload/profile-photo", {
      method: "POST",
      body: uploadFormData,
    });
    setUploading(false);
    if (!response.ok) {
      toast.error("Photo upload failed");
      return;
    }
    const payload = (await response.json()) as { url: string };
    setValue("profilePhotoUrl", payload.url, { shouldDirty: true });
    toast.success("Profile photo uploaded");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Personal Details</h3>
          <p className="text-sm text-slate-500">Core profile details and membership status.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">First name</label>
            <Input {...register("firstName")} />
            {errors.firstName ? <p className="text-xs text-red-600">{errors.firstName.message}</p> : null}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Last name</label>
            <Input {...register("lastName")} />
            {errors.lastName ? <p className="text-xs text-red-600">{errors.lastName.message}</p> : null}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Gender</label>
            <Select {...register("gender")}>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Date of birth</label>
            <Input type="date" {...register("dateOfBirth")} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Date joined</label>
            <Input type="date" {...register("dateJoined")} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Membership status</label>
            <Select {...register("membershipStatus")}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="VISITOR">Visitor</option>
            </Select>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Contact Details</h3>
          <p className="text-sm text-slate-500">Primary and emergency contact information.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Phone</label>
            <Input {...register("phone")} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Email</label>
            <Input type="email" {...register("email")} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Emergency contact name</label>
            <Input {...register("emergencyContactName")} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Emergency contact phone</label>
            <Input {...register("emergencyContactPhone")} />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Residence Details</h3>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Residential address</label>
          <Input {...register("address")} />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Demographic Details</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Marital status</label>
            <Select {...register("maritalStatus")}>
              <option value="">Select</option>
              <option value="SINGLE">Single</option>
              <option value="MARRIED">Married</option>
              <option value="DIVORCED">Divorced</option>
              <option value="WIDOWED">Widowed</option>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Occupation</label>
            <Input {...register("occupation")} />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">JIM TRACK</h3>
          <p className="text-sm text-slate-500">Track discipleship journey milestones.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" {...register("jimJohn316Status")} />
            John 3:16
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" {...register("jimSgtStatus")} />
            SGT
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" {...register("jimDiscStatus")} />
            DISC
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" {...register("jimNltStatus")} />
            NLT
          </label>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Baptism</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" {...register("baptismStatus")} />
            Water baptism
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" {...register("holySpiritBaptismStatus")} />
            Holy Spirit baptism
          </label>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Involvement</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Department</label>
            <Select {...register("departmentId")}>
              <option value="">Unassigned</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Homecell</label>
            <Select {...register("homecellId")}>
              <option value="">Unassigned</option>
              {homecells.map((homecell) => (
                <option key={homecell.id} value={homecell.id}>
                  {homecell.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium text-slate-700">Involvement notes</label>
            <Textarea {...register("involvementNotes")} placeholder="Service teams, leadership track, and participation notes." />
            {errors.involvementNotes ? (
              <p className="text-xs text-red-600">{errors.involvementNotes.message}</p>
            ) : null}
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
            <input type="checkbox" {...register("salvationStatus")} />
            Salvation confirmed
          </label>
        </div>
      </section>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="mb-2 text-sm font-medium text-slate-700">Profile photo upload</p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            <UploadCloud className="h-4 w-4" />
            {uploading ? "Uploading..." : "Upload file"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void uploadPhoto(file);
                }
              }}
            />
          </label>
          <Input
            className="max-w-lg"
            placeholder="or paste image URL"
            {...register("profilePhotoUrl")}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : mode === "create" ? "Create Member" : "Update Member"}
        </Button>
      </div>
    </form>
  );
}
