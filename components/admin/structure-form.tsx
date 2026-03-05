"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  assignStructureLeaderAction,
  assignMemberStructureAction,
  createHomecellAction,
  createRegionAction,
  createZoneAction,
} from "@/app/dashboard/admin/churches/actions";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Option = {
  id: string;
  name: string;
};

type LeaderOption = Option & {
  role: string;
};

type StructureFormProps = {
  leaders: LeaderOption[];
  regions: Option[];
  zones: Option[];
  homecells: Option[];
  members: Option[];
  structureAssignments: Array<{
    id: string;
    label: string;
    role: string;
    regionId: string | null;
    zoneId: string | null;
    homecellId: string | null;
  }>;
};

const STRUCTURE_ROLE_ORDER = {
  OVERSEER: 1,
  SUPERVISOR: 2,
  COORDINATOR: 3,
  HOMECELL_LEADER: 4,
} as const;

async function runAction<T extends { success: boolean; message: string }>(
  fn: () => Promise<T>,
  onSuccess: () => void,
) {
  const result = await fn();
  if (!result.success) {
    toast.error(result.message);
    return;
  }
  toast.success(result.message);
  onSuccess();
}

export function StructureForm({
  leaders,
  regions,
  zones,
  homecells,
  members,
  structureAssignments,
}: StructureFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [leaderScope, setLeaderScope] = useState<"REGION" | "ZONE" | "HOMECELL">("ZONE");
  const [leaderRole, setLeaderRole] = useState("OVERSEER");
  const [leaderRegionId, setLeaderRegionId] = useState("");
  const [leaderZoneId, setLeaderZoneId] = useState("");
  const [leaderHomecellId, setLeaderHomecellId] = useState("");

  const validStructureLeaders = useMemo(
    () =>
      leaders.filter((leader) =>
        STRUCTURE_ROLE_ORDER[leader.role as keyof typeof STRUCTURE_ROLE_ORDER]),
    [leaders],
  );

  const leadersForRole = useMemo(
    () => validStructureLeaders.filter((leader) => leader.role === leaderRole),
    [leaderRole, validStructureLeaders],
  );

  const parentCandidates = useMemo(() => {
    const selectedRank = STRUCTURE_ROLE_ORDER[leaderRole as keyof typeof STRUCTURE_ROLE_ORDER];
    if (!selectedRank || selectedRank === 1) {
      return [];
    }

    const scopeRegionId =
      leaderScope === "REGION"
        ? leaderRegionId || null
        : leaderScope === "ZONE"
          ? leaderRegionId || null
          : leaderRegionId || null;
    const scopeZoneId =
      leaderScope === "ZONE" ? leaderZoneId || null : leaderScope === "HOMECELL" ? leaderZoneId || null : null;
    const scopeHomecellId = leaderScope === "HOMECELL" ? leaderHomecellId || null : null;

    return structureAssignments.filter((assignment) => {
      const assignmentRank =
        STRUCTURE_ROLE_ORDER[assignment.role as keyof typeof STRUCTURE_ROLE_ORDER];
      if (!assignmentRank || assignmentRank >= selectedRank) {
        return false;
      }

      if (scopeHomecellId) {
        if (assignment.homecellId === scopeHomecellId) return true;
        if (scopeZoneId && assignment.zoneId === scopeZoneId && !assignment.homecellId) return true;
        if (scopeRegionId && assignment.regionId === scopeRegionId && !assignment.zoneId && !assignment.homecellId) return true;
        return false;
      }

      if (scopeZoneId) {
        if (assignment.zoneId === scopeZoneId && !assignment.homecellId) return true;
        if (scopeRegionId && assignment.regionId === scopeRegionId && !assignment.zoneId && !assignment.homecellId) return true;
        return false;
      }

      if (scopeRegionId) {
        return assignment.regionId === scopeRegionId && !assignment.zoneId && !assignment.homecellId;
      }

      return false;
    });
  }, [
    leaderRole,
    leaderScope,
    leaderRegionId,
    leaderZoneId,
    leaderHomecellId,
    structureAssignments,
  ]);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardTitle>Add Region</CardTitle>
        <CardDescription className="mt-1">Create a region and assign a leader.</CardDescription>
        <form
          className="mt-4 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(async () => {
              await runAction(() => createRegionAction(formData), () => {
                event.currentTarget.reset();
                router.refresh();
              });
            });
          }}
        >
          <Input name="name" placeholder="Region name" />
          <Select name="leaderId" defaultValue="">
            <option value="">No leader yet</option>
            {leaders.map((leader) => (
              <option key={leader.id} value={leader.id}>
                {leader.name} ({leader.role})
              </option>
            ))}
          </Select>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Create Region"}
          </Button>
        </form>
      </Card>

      <Card>
        <CardTitle>Add Zone</CardTitle>
        <CardDescription className="mt-1">Map zone under region and assign pastor/leader.</CardDescription>
        <form
          className="mt-4 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(async () => {
              await runAction(() => createZoneAction(formData), () => {
                event.currentTarget.reset();
                router.refresh();
              });
            });
          }}
        >
          <Input name="name" placeholder="Zone name" />
          <Select name="regionId" defaultValue="">
            <option value="">No region</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </Select>
          <Select name="leaderId" defaultValue="">
            <option value="">No leader yet</option>
            {leaders.map((leader) => (
              <option key={leader.id} value={leader.id}>
                {leader.name} ({leader.role})
              </option>
            ))}
          </Select>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Create Zone"}
          </Button>
        </form>
      </Card>

      <Card>
        <CardTitle>Add Homecell</CardTitle>
        <CardDescription className="mt-1">Create homecell under selected zone/region.</CardDescription>
        <form
          className="mt-4 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(async () => {
              await runAction(() => createHomecellAction(formData), () => {
                event.currentTarget.reset();
                router.refresh();
              });
            });
          }}
        >
          <Input name="name" placeholder="Homecell name" />
          <Select name="regionId" defaultValue="">
            <option value="">Auto from zone / none</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </Select>
          <Select name="zoneId" defaultValue="">
            <option value="">No zone</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </Select>
          <Select name="leaderId" defaultValue="">
            <option value="">No leader yet</option>
            {leaders.map((leader) => (
              <option key={leader.id} value={leader.id}>
                {leader.name} ({leader.role})
              </option>
            ))}
          </Select>
          <div className="grid gap-3 md:grid-cols-2">
            <Input name="meetingDay" placeholder="Meeting day" />
            <Input name="meetingTime" placeholder="Meeting time (e.g. 18:30)" />
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Create Homecell"}
          </Button>
        </form>
      </Card>

      <Card>
        <CardTitle>Assign Structure Leader</CardTitle>
        <CardDescription className="mt-1">
          Add multiple overseers per structure and connect their own leader branches.
        </CardDescription>
        <form
          className="mt-4 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(async () => {
              await runAction(() => assignStructureLeaderAction(formData), () => {
                event.currentTarget.reset();
                setLeaderScope("ZONE");
                setLeaderRole("OVERSEER");
                setLeaderRegionId("");
                setLeaderZoneId("");
                setLeaderHomecellId("");
                router.refresh();
              });
            });
          }}
        >
          <Select
            name="role"
            value={leaderRole}
            onChange={(event) => {
              setLeaderRole(event.target.value);
            }}
          >
            <option value="OVERSEER">Overseer</option>
            <option value="SUPERVISOR">Supervisor</option>
            <option value="COORDINATOR">Coordinator</option>
            <option value="HOMECELL_LEADER">Homecell Leader</option>
          </Select>
          <Select
            name="userId"
            defaultValue=""
          >
            <option value="">Select leader</option>
            {leadersForRole.map((leader) => (
              <option key={leader.id} value={leader.id}>
                {leader.name} ({leader.role})
              </option>
            ))}
          </Select>
          <Select
            value={leaderScope}
            onChange={(event) => {
              const value = event.target.value as "REGION" | "ZONE" | "HOMECELL";
              setLeaderScope(value);
              if (value === "REGION") {
                setLeaderZoneId("");
                setLeaderHomecellId("");
              }
              if (value === "ZONE") {
                setLeaderHomecellId("");
              }
            }}
          >
            <option value="REGION">Region Scope</option>
            <option value="ZONE">Zone Scope</option>
            <option value="HOMECELL">Homecell Scope</option>
          </Select>
          <Select
            name={leaderScope === "REGION" ? "regionId" : undefined}
            value={leaderRegionId}
            onChange={(event) => setLeaderRegionId(event.target.value)}
          >
            <option value="">Select region</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </Select>
          <Select
            name={leaderScope === "ZONE" ? "zoneId" : undefined}
            value={leaderZoneId}
            disabled={leaderScope === "REGION"}
            onChange={(event) => setLeaderZoneId(event.target.value)}
          >
            <option value="">Select zone</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </Select>
          <Select
            name={leaderScope === "HOMECELL" ? "homecellId" : undefined}
            value={leaderHomecellId}
            disabled={leaderScope !== "HOMECELL"}
            onChange={(event) => setLeaderHomecellId(event.target.value)}
          >
            <option value="">Select homecell</option>
            {homecells.map((homecell) => (
              <option key={homecell.id} value={homecell.id}>
                {homecell.name}
              </option>
            ))}
          </Select>
          <Select name="parentLeaderId" defaultValue="" disabled={leaderRole === "OVERSEER"}>
            <option value="">{leaderRole === "OVERSEER" ? "Root branch (no parent)" : "Select parent leader"}</option>
            {parentCandidates.map((assignment) => (
              <option key={assignment.id} value={assignment.id}>
                {assignment.label}
              </option>
            ))}
          </Select>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Assign Leader"}
          </Button>
        </form>
      </Card>

      <Card>
        <CardTitle>Assign Member To Structure</CardTitle>
        <CardDescription className="mt-1">
          Assign region, zone, and homecell from one action.
        </CardDescription>
        <form
          className="mt-4 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(async () => {
              await runAction(() => assignMemberStructureAction(formData), () => {
                router.refresh();
              });
            });
          }}
        >
          <Select name="memberId" defaultValue="">
            <option value="">Select member</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </Select>
          <Select name="regionId" defaultValue="">
            <option value="">No region</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </Select>
          <Select name="zoneId" defaultValue="">
            <option value="">No zone</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </Select>
          <Select name="homecellId" defaultValue="">
            <option value="">No homecell</option>
            {homecells.map((homecell) => (
              <option key={homecell.id} value={homecell.id}>
                {homecell.name}
              </option>
            ))}
          </Select>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Assign Structure"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
