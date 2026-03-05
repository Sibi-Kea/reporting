"use client";

import { useMemo, useState, useTransition } from "react";
import { Eye, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  addHierarchyNodeAction,
  deleteHierarchyNodeAction,
  reparentHierarchyNodeAction,
  replaceHierarchyLeaderAction,
} from "@/app/dashboard/hierarchy/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { cn, formatPercent, getInitials, toStartCase } from "@/lib/utils";

type StructureRole = "OVERSEER" | "SUPERVISOR" | "COORDINATOR" | "HOMECELL_LEADER";
type SourceType = "USER" | "MEMBER";
type PanelMode = "none" | "add" | "edit";

type StructureNode = {
  id: string;
  name: string;
  role: StructureRole;
  parentLeaderId: string | null;
  regionId: string | null;
  zoneId: string | null;
  homecellId: string | null;
};

type HomecellSummary = {
  id: string;
  name: string;
  leaderNames: string[];
  membersCount: number;
  attendanceRate: number;
  growth: number;
};

type ZoneTree = {
  id: string;
  name: string;
  regionId: string;
  regionName: string;
  nodes: StructureNode[];
  homecells: HomecellSummary[];
};

type ZoneBranch = {
  overseer: StructureNode | null;
  supervisor: StructureNode | null;
  coordinator: StructureNode | null;
  homecellLeader: StructureNode | null;
};

type AddDraft = {
  zoneId: string;
  regionId: string;
  targetRole: StructureRole;
  parentLeaderId: string;
  homecellId: string;
  contextLabel: string;
};

type HierarchyVisualProps = {
  churchName: string;
  pastorName: string;
  summary: {
    pastors: string[];
    overseers: string[];
    supervisors: string[];
    coordinators: string[];
    homecellLeaders: string[];
  };
  zones: ZoneTree[];
  canManage: boolean;
  leaderCandidates: Array<{ id: string; name: string; role: string }>;
  memberCandidates: Array<{ id: string; name: string; email: string | null }>;
};

const ROLE_ORDER: StructureRole[] = ["OVERSEER", "SUPERVISOR", "COORDINATOR", "HOMECELL_LEADER"];

function namesOrFallback(names: string[]) {
  return names.length ? names.join(", ") : "Unassigned";
}

function roleWeight(role: StructureRole) {
  if (role === "OVERSEER") return 1;
  if (role === "SUPERVISOR") return 2;
  if (role === "COORDINATOR") return 3;
  return 4;
}

function expectedParentRole(role: StructureRole): StructureRole | null {
  if (role === "SUPERVISOR") return "OVERSEER";
  if (role === "COORDINATOR") return "SUPERVISOR";
  if (role === "HOMECELL_LEADER") return "COORDINATOR";
  return null;
}

function nextRole(role: StructureRole): StructureRole | null {
  if (role === "OVERSEER") return "SUPERVISOR";
  if (role === "SUPERVISOR") return "COORDINATOR";
  if (role === "COORDINATOR") return "HOMECELL_LEADER";
  return null;
}

function buildChildrenMap(nodes: StructureNode[]) {
  const ids = new Set(nodes.map((node) => node.id));
  const map = new Map<string, StructureNode[]>();
  for (const node of nodes) {
    if (!node.parentLeaderId || !ids.has(node.parentLeaderId)) continue;
    const current = map.get(node.parentLeaderId) ?? [];
    current.push(node);
    map.set(node.parentLeaderId, current);
  }
  for (const [parentId, children] of map.entries()) {
    map.set(
      parentId,
      [...children].sort(
        (a, b) => roleWeight(a.role) - roleWeight(b.role) || a.name.localeCompare(b.name),
      ),
    );
  }
  return map;
}

function getRoots(nodes: StructureNode[]) {
  const ids = new Set(nodes.map((node) => node.id));
  return [...nodes]
    .filter((node) => !node.parentLeaderId || !ids.has(node.parentLeaderId))
    .sort((a, b) => roleWeight(a.role) - roleWeight(b.role) || a.name.localeCompare(b.name));
}

function findFirstDescendantByRole(
  rootId: string,
  role: StructureRole,
  childrenByParent: Map<string, StructureNode[]>,
) {
  const queue = [...(childrenByParent.get(rootId) ?? [])];
  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) continue;
    if (node.role === role) return node;
    queue.push(...(childrenByParent.get(node.id) ?? []));
  }
  return null;
}

function collectDescendants(id: string, childrenByParent: Map<string, StructureNode[]>) {
  const out: StructureNode[] = [];
  const stack = [id];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    const children = childrenByParent.get(current) ?? [];
    for (const child of children) {
      out.push(child);
      stack.push(child.id);
    }
  }
  return out;
}

function isScopeCompatible(child: StructureNode, parent: StructureNode) {
  if (child.homecellId) {
    if (parent.homecellId === child.homecellId) return true;
    if (child.zoneId && parent.zoneId === child.zoneId && !parent.homecellId) return true;
    if (child.regionId && parent.regionId === child.regionId && !parent.zoneId && !parent.homecellId) return true;
    return false;
  }
  if (child.zoneId) {
    if (parent.zoneId === child.zoneId && !parent.homecellId) return true;
    if (child.regionId && parent.regionId === child.regionId && !parent.zoneId && !parent.homecellId) return true;
    return false;
  }
  return Boolean(child.regionId && parent.regionId === child.regionId && !parent.zoneId && !parent.homecellId);
}

function buildBranches(nodes: StructureNode[]) {
  const childrenByParent = buildChildrenMap(nodes);
  const roots = getRoots(nodes);
  const overseerRoots = roots.filter((node) => node.role === "OVERSEER");
  const seeds = overseerRoots.length > 0 ? overseerRoots : roots;

  return seeds.map((seed) => {
    const overseer =
      (seed.role === "OVERSEER" ? seed : null) ??
      findFirstDescendantByRole(seed.id, "OVERSEER", childrenByParent);
    const supervisor =
      (seed.role === "SUPERVISOR" ? seed : null) ??
      findFirstDescendantByRole(overseer?.id ?? seed.id, "SUPERVISOR", childrenByParent) ??
      findFirstDescendantByRole(seed.id, "SUPERVISOR", childrenByParent);
    const coordinator =
      (seed.role === "COORDINATOR" ? seed : null) ??
      findFirstDescendantByRole(supervisor?.id ?? overseer?.id ?? seed.id, "COORDINATOR", childrenByParent) ??
      findFirstDescendantByRole(seed.id, "COORDINATOR", childrenByParent);
    const homecellLeader =
      (seed.role === "HOMECELL_LEADER" ? seed : null) ??
      findFirstDescendantByRole(
        coordinator?.id ?? supervisor?.id ?? overseer?.id ?? seed.id,
        "HOMECELL_LEADER",
        childrenByParent,
      ) ??
      findFirstDescendantByRole(seed.id, "HOMECELL_LEADER", childrenByParent);

    return {
      overseer,
      supervisor,
      coordinator,
      homecellLeader,
    };
  });
}

function getBranchNode(branch: ZoneBranch, role: StructureRole) {
  if (role === "OVERSEER") return branch.overseer;
  if (role === "SUPERVISOR") return branch.supervisor;
  if (role === "COORDINATOR") return branch.coordinator;
  return branch.homecellLeader;
}

function deriveZoneAttendance(zone: ZoneTree) {
  const weightedMembers = zone.homecells.reduce((total, homecell) => total + Math.max(homecell.membersCount, 1), 0);
  const attendanceWeight = zone.homecells.reduce(
    (total, homecell) => total + homecell.attendanceRate * Math.max(homecell.membersCount, 1),
    0,
  );
  return weightedMembers ? attendanceWeight / weightedMembers : 0;
}

async function runAction(
  action: () => Promise<{ success: boolean; message: string }>,
  onSuccess: () => void,
) {
  const result = await action();
  if (!result.success) {
    toast.error(result.message);
    return;
  }
  toast.success(result.message);
  onSuccess();
}

function NodeCard({
  node,
  active,
  onClick,
}: {
  node: StructureNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "mx-auto flex h-[124px] w-[172px] flex-col items-center justify-center rounded-xl border px-3 py-2 text-center",
        active ? "border-sky-500 bg-sky-50" : "border-slate-200 bg-white hover:bg-slate-50",
      )}
    >
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-xs font-semibold text-slate-700">
        {getInitials(node.name)}
      </div>
      <p className="text-sm leading-tight font-medium text-slate-900">{node.name}</p>
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{toStartCase(node.role)}</p>
    </button>
  );
}

function EmptyNodeCard({ role }: { role: StructureRole }) {
  return (
    <div className="mx-auto flex h-[124px] w-[172px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-3 text-center text-xs text-slate-400">
      No {toStartCase(role)}
    </div>
  );
}

export function HierarchyVisual({
  churchName,
  pastorName,
  summary,
  zones,
  canManage,
  leaderCandidates,
  memberCandidates,
}: HierarchyVisualProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedZoneId, setSelectedZoneId] = useState(zones[0]?.id ?? "");
  const [showSelectedOnly, setShowSelectedOnly] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(zones[0]?.nodes[0]?.id ?? null);
  const [panelMode, setPanelMode] = useState<PanelMode>("none");

  const [addDraft, setAddDraft] = useState<AddDraft | null>(null);
  const [addParentId, setAddParentId] = useState("");
  const [addHomecellId, setAddHomecellId] = useState("");
  const [addSourceType, setAddSourceType] = useState<SourceType>("USER");
  const [addUserId, setAddUserId] = useState("");
  const [addMemberId, setAddMemberId] = useState("");

  const [replaceSourceType, setReplaceSourceType] = useState<SourceType>("USER");
  const [replaceUserId, setReplaceUserId] = useState("");
  const [replaceMemberId, setReplaceMemberId] = useState("");
  const [reparentId, setReparentId] = useState("");

  const activeZone = zones.find((zone) => zone.id === selectedZoneId) ?? zones[0] ?? null;
  const activeNodes = activeZone?.nodes ?? [];
  const activeNodeMap = new Map(activeNodes.map((node) => [node.id, node]));
  const activeChildrenByParent = buildChildrenMap(activeNodes);

  const resolvedSelectedNodeId =
    selectedNodeId && activeNodeMap.has(selectedNodeId) ? selectedNodeId : activeNodes[0]?.id ?? null;
  const selectedNode = resolvedSelectedNodeId ? activeNodeMap.get(resolvedSelectedNodeId) ?? null : null;

  const selectedDescendants = selectedNode
    ? collectDescendants(selectedNode.id, activeChildrenByParent)
    : [];
  const selectedDescendantIds = new Set(selectedDescendants.map((node) => node.id));

  const subtreeCounts = (selectedNode ? [selectedNode, ...selectedDescendants] : []).reduce(
    (count, node) => {
      if (node.role === "OVERSEER") count.overseers += 1;
      if (node.role === "SUPERVISOR") count.supervisors += 1;
      if (node.role === "COORDINATOR") count.coordinators += 1;
      if (node.role === "HOMECELL_LEADER") count.homecellLeaders += 1;
      return count;
    },
    { overseers: 0, supervisors: 0, coordinators: 0, homecellLeaders: 0 },
  );

  const parentOptions = selectedNode
    ? activeNodes
        .filter((node) => node.id !== selectedNode.id)
        .filter((node) => !selectedDescendantIds.has(node.id))
        .filter((node) => roleWeight(node.role) < roleWeight(selectedNode.role))
        .filter((node) => isScopeCompatible(selectedNode, node))
        .sort((a, b) => roleWeight(a.role) - roleWeight(b.role) || a.name.localeCompare(b.name))
    : [];

  const replaceUserOptions = selectedNode
    ? leaderCandidates.filter((user) => user.role === selectedNode.role)
    : [];
  const addUserOptions = addDraft
    ? leaderCandidates.filter((user) => user.role === addDraft.targetRole)
    : [];
  const scopedReplaceUsers = replaceUserOptions.length > 0 ? replaceUserOptions : leaderCandidates;
  const scopedAddUsers = addUserOptions.length > 0 ? addUserOptions : leaderCandidates;

  const addZone = addDraft ? zones.find((zone) => zone.id === addDraft.zoneId) ?? null : null;
  const addParentRole = addDraft ? expectedParentRole(addDraft.targetRole) : null;

  const addParentOptions = useMemo(() => {
    if (!addDraft || !addZone || !addParentRole) return [];
    const childScope: StructureNode = {
      id: "__draft__",
      name: "__draft__",
      role: addDraft.targetRole,
      parentLeaderId: null,
      regionId: addDraft.regionId,
      zoneId: addDraft.zoneId,
      homecellId: addDraft.targetRole === "HOMECELL_LEADER" ? addHomecellId || null : null,
    };

    return addZone.nodes
      .filter((node) => node.role === addParentRole)
      .filter((node) => isScopeCompatible(childScope, node))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [addDraft, addHomecellId, addParentRole, addZone]);

  const visibleZones = showSelectedOnly && activeZone ? [activeZone] : zones;

  function selectZone(zoneId: string) {
    setSelectedZoneId(zoneId);
    const zone = zones.find((entry) => entry.id === zoneId);
    const firstNode = zone?.nodes[0] ?? null;
    setSelectedNodeId(firstNode?.id ?? null);
    setReparentId(firstNode?.parentLeaderId ?? "");
    setPanelMode("none");
  }

  function handleNodeClick(zoneId: string, nodeId: string) {
    setSelectedZoneId(zoneId);
    setSelectedNodeId(nodeId);
    const zone = zones.find((entry) => entry.id === zoneId);
    const node = zone?.nodes.find((entry) => entry.id === nodeId) ?? null;
    setReparentId(node?.parentLeaderId ?? "");
    setPanelMode("edit");
  }

  function openAddPanel(params: {
    zone: ZoneTree;
    role: StructureRole;
    parent: StructureNode | null;
    homecellId: string;
    contextLabel: string;
  }) {
    setAddDraft({
      zoneId: params.zone.id,
      regionId: params.zone.regionId,
      targetRole: params.role,
      parentLeaderId: params.parent?.id ?? "",
      homecellId: params.homecellId,
      contextLabel: params.contextLabel,
    });
    setAddParentId(params.parent?.id ?? "");
    setAddHomecellId(params.homecellId);
    setAddSourceType("USER");
    setAddUserId("");
    setAddMemberId("");
    setPanelMode("add");
  }

  function openRowAdd(zone: ZoneTree, role: StructureRole, branches: ZoneBranch[]) {
    const parentRole = expectedParentRole(role);
    const localSelectedNode =
      selectedNode && selectedNode.zoneId === zone.id ? selectedNode : null;

    const selectedParent =
      parentRole && localSelectedNode?.role === parentRole ? localSelectedNode : null;
    const fallbackParent = parentRole
      ? branches
          .map((branch) => getBranchNode(branch, parentRole))
          .find((node): node is StructureNode => Boolean(node)) ?? null
      : null;
    const defaultParent = selectedParent ?? fallbackParent;

    if (parentRole && !defaultParent) {
      toast.error(`No ${toStartCase(parentRole)} available yet in ${zone.name}.`);
    }

    const defaultHomecell =
      role === "HOMECELL_LEADER"
        ? localSelectedNode?.homecellId ?? zone.homecells[0]?.id ?? ""
        : "";

    openAddPanel({
      zone,
      role,
      parent: defaultParent,
      homecellId: defaultHomecell,
      contextLabel: `Add ${toStartCase(role)} in ${zone.name}`,
    });
  }

  function openChildAdd(zone: ZoneTree, node: StructureNode) {
    const role = nextRole(node.role);
    if (!role) return;
    const defaultHomecell = role === "HOMECELL_LEADER" ? node.homecellId ?? zone.homecells[0]?.id ?? "" : "";
    openAddPanel({
      zone,
      role,
      parent: node,
      homecellId: defaultHomecell,
      contextLabel: `Add ${toStartCase(role)} under ${node.name}`,
    });
  }

  function submitAdd() {
    if (!addDraft) return;
    if (addDraft.targetRole !== "OVERSEER" && !addParentId) {
      toast.error("Please select a parent leader.");
      return;
    }
    if (addDraft.targetRole === "HOMECELL_LEADER" && !addHomecellId) {
      toast.error("Please select a homecell.");
      return;
    }
    if (addSourceType === "USER" && !addUserId) {
      toast.error("Please select a user.");
      return;
    }
    if (addSourceType === "MEMBER" && !addMemberId) {
      toast.error("Please select a member.");
      return;
    }

    const formData = new FormData();
    formData.set("role", addDraft.targetRole);
    formData.set("regionId", addDraft.regionId);
    formData.set("zoneId", addDraft.zoneId);
    formData.set("homecellId", addDraft.targetRole === "HOMECELL_LEADER" ? addHomecellId : "");
    formData.set("parentLeaderId", addDraft.targetRole === "OVERSEER" ? "" : addParentId);
    formData.set("userId", addSourceType === "USER" ? addUserId : "");
    formData.set("memberId", addSourceType === "MEMBER" ? addMemberId : "");

    startTransition(async () => {
      await runAction(() => addHierarchyNodeAction(formData), () => {
        setAddUserId("");
        setAddMemberId("");
        setPanelMode("none");
        setAddDraft(null);
        router.refresh();
      });
    });
  }

  function submitReplace() {
    if (!selectedNode) return;
    if (replaceSourceType === "USER" && !replaceUserId) {
      toast.error("Please select a user.");
      return;
    }
    if (replaceSourceType === "MEMBER" && !replaceMemberId) {
      toast.error("Please select a member.");
      return;
    }

    const formData = new FormData();
    formData.set("structureLeaderId", selectedNode.id);
    formData.set("userId", replaceSourceType === "USER" ? replaceUserId : "");
    formData.set("memberId", replaceSourceType === "MEMBER" ? replaceMemberId : "");

    startTransition(async () => {
      await runAction(() => replaceHierarchyLeaderAction(formData), () => {
        setReplaceUserId("");
        setReplaceMemberId("");
        router.refresh();
      });
    });
  }

  function submitReparent() {
    if (!selectedNode) return;
    if (selectedNode.role !== "OVERSEER" && !reparentId) {
      toast.error("Please select a parent.");
      return;
    }
    const formData = new FormData();
    formData.set("structureLeaderId", selectedNode.id);
    formData.set("parentLeaderId", reparentId);
    startTransition(async () => {
      await runAction(() => reparentHierarchyNodeAction(formData), () => router.refresh());
    });
  }

  function submitDelete() {
    if (!selectedNode) return;
    if (!window.confirm(`Delete ${selectedNode.name}? Child nodes will be re-parented automatically.`)) return;

    const formData = new FormData();
    formData.set("structureLeaderId", selectedNode.id);
    startTransition(async () => {
      await runAction(() => deleteHierarchyNodeAction(formData), () => {
        setSelectedNodeId(null);
        setPanelMode("none");
        router.refresh();
      });
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>{churchName} Hierarchy Map</CardTitle>
        <CardDescription className="mt-1">
          Visual branch view by role level with in-board add and edit controls.
        </CardDescription>
      </Card>

      <Card className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <Select value={selectedZoneId} onChange={(event) => selectZone(event.target.value)}>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name} ({zone.regionName})
              </option>
            ))}
          </Select>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowSelectedOnly((value) => !value)}
          >
            <Eye className="mr-2 h-4 w-4" />
            {showSelectedOnly ? "Show All Zones" : "Show Selected Zone Only"}
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <Badge>Pastor</Badge>
            <p className="mt-2 text-sm text-slate-700">{namesOrFallback(summary.pastors)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <Badge>Overseer</Badge>
            <p className="mt-2 text-sm text-slate-700">{namesOrFallback(summary.overseers)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <Badge>Supervisor</Badge>
            <p className="mt-2 text-sm text-slate-700">{namesOrFallback(summary.supervisors)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <Badge>Coordinator</Badge>
            <p className="mt-2 text-sm text-slate-700">{namesOrFallback(summary.coordinators)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <Badge>Homecell Leader</Badge>
            <p className="mt-2 text-sm text-slate-700">{namesOrFallback(summary.homecellLeaders)}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {visibleZones.map((zone) => {
            const branches = buildBranches(zone.nodes);
            const columns = Math.max(branches.length, 1);
            const zoneAttendance = deriveZoneAttendance(zone);
            const gridStyle = { gridTemplateColumns: `repeat(${columns}, minmax(170px, 1fr))` };

            return (
              <Card key={zone.id} className="space-y-3 border-l-4 border-l-sky-300">
                <div>
                  <h3 className="text-2xl font-semibold text-slate-900">{zone.name}</h3>
                  <p className="text-sm text-slate-500">
                    {zone.regionName} | {zone.homecells.length} homecells | {formatPercent(zoneAttendance)} attendance
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedZoneId(zone.id);
                        setPanelMode("none");
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-center"
                    >
                      <p className="text-sm font-medium text-slate-900">{pastorName}</p>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Pastor</p>
                    </button>
                  </div>
                  <div className="flex justify-center">
                    <span className="h-4 w-px bg-slate-300" />
                  </div>

                  {ROLE_ORDER.map((role, roleIndex) => {
                    const showRowLine = roleIndex > 0 || columns > 1;
                    const slots = branches.length > 0 ? branches : [null];

                    return (
                      <div key={`${zone.id}-${role}`} className="relative pb-2">
                        {showRowLine ? (
                          <div className="pointer-events-none absolute top-0 right-4 left-4 border-t border-slate-300" />
                        ) : null}
                        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                          <div className="pt-3">
                            <div className="grid gap-4" style={gridStyle}>
                              {slots.map((branch, index) => {
                                const node = branch ? getBranchNode(branch, role) : null;
                                return (
                                  <div
                                    key={`${zone.id}-${role}-${index}`}
                                    className="relative flex min-h-[142px] items-center justify-center pt-2"
                                  >
                                    <span className="absolute top-0 h-3 w-px bg-slate-300" />
                                    {node ? (
                                      <NodeCard
                                        node={node}
                                        active={zone.id === activeZone?.id && node.id === selectedNode?.id}
                                        onClick={() => handleNodeClick(zone.id, node.id)}
                                      />
                                    ) : (
                                      <EmptyNodeCard role={role} />
                                    )}
                                    {role !== "HOMECELL_LEADER" && node ? (
                                      <span className="absolute bottom-0 h-3 w-px bg-slate-300" />
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {canManage ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => openRowAdd(zone, role, branches)}
                              className="h-11 w-11 border-sky-200 bg-sky-50 p-0 text-sky-600 hover:bg-sky-100"
                              title={`Add ${toStartCase(role)}`}
                            >
                              <Plus className="h-6 w-6" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}

          {canManage ? (
            <Card className="space-y-4">
              {panelMode === "add" && addDraft ? (
                <div className="space-y-3">
                  <div>
                    <CardTitle>Add {toStartCase(addDraft.targetRole)}</CardTitle>
                    <CardDescription className="mt-1">{addDraft.contextLabel}</CardDescription>
                  </div>

                  {addParentRole ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Parent</p>
                      <Select value={addParentId} onChange={(event) => setAddParentId(event.target.value)}>
                        <option value="">Select {toStartCase(addParentRole)}</option>
                        {addParentOptions.map((node) => (
                          <option key={node.id} value={node.id}>
                            {node.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ) : null}

                  {addDraft.targetRole === "HOMECELL_LEADER" ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Homecell</p>
                      <Select value={addHomecellId} onChange={(event) => setAddHomecellId(event.target.value)}>
                        <option value="">Select homecell</option>
                        {(addZone?.homecells ?? []).map((homecell) => (
                          <option key={homecell.id} value={homecell.id}>
                            {homecell.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assign From</p>
                    <Select value={addSourceType} onChange={(event) => setAddSourceType(event.target.value as SourceType)}>
                      <option value="USER">Existing User</option>
                      <option value="MEMBER">Member (promote)</option>
                    </Select>

                    {addSourceType === "USER" ? (
                      <Select value={addUserId} onChange={(event) => setAddUserId(event.target.value)}>
                        <option value="">Select user</option>
                        {scopedAddUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name} ({toStartCase(user.role)})
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Select value={addMemberId} onChange={(event) => setAddMemberId(event.target.value)}>
                        <option value="">Select member</option>
                        {memberCandidates.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name} {member.email ? `(${member.email})` : ""}
                          </option>
                        ))}
                      </Select>
                    )}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button type="button" variant="outline" onClick={() => setPanelMode("none")} disabled={isPending}>
                      Cancel
                    </Button>
                    <Button type="button" onClick={submitAdd} disabled={isPending}>
                      {isPending ? "Saving..." : "Add Node"}
                    </Button>
                  </div>
                </div>
              ) : panelMode === "edit" && selectedNode ? (
                <div className="space-y-4">
                  <div>
                    <CardTitle>Manage {selectedNode.name}</CardTitle>
                    <CardDescription className="mt-1">
                      Update, move, replace, or delete the selected node.
                    </CardDescription>
                  </div>

                  {activeZone && nextRole(selectedNode.role) ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openChildAdd(activeZone, selectedNode)}
                      disabled={isPending}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add {toStartCase(nextRole(selectedNode.role) ?? "HOMECELL_LEADER")} under selected
                    </Button>
                  ) : null}

                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-800">Replace Leader</p>
                    <div className="mt-2 grid gap-2">
                      <Select
                        value={replaceSourceType}
                        onChange={(event) => setReplaceSourceType(event.target.value as SourceType)}
                      >
                        <option value="USER">With User</option>
                        <option value="MEMBER">With Member</option>
                      </Select>
                      {replaceSourceType === "USER" ? (
                        <Select value={replaceUserId} onChange={(event) => setReplaceUserId(event.target.value)}>
                          <option value="">Select user</option>
                          {scopedReplaceUsers.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name} ({toStartCase(user.role)})
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Select value={replaceMemberId} onChange={(event) => setReplaceMemberId(event.target.value)}>
                          <option value="">Select member</option>
                          {memberCandidates.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.name}
                            </option>
                          ))}
                        </Select>
                      )}
                      <Button type="button" variant="outline" disabled={isPending} onClick={submitReplace}>
                        {isPending ? "Saving..." : "Replace"}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-800">Re-parent</p>
                    <div className="mt-2 grid gap-2">
                      <Select value={reparentId} onChange={(event) => setReparentId(event.target.value)}>
                        <option value="">
                          {selectedNode.role === "OVERSEER" ? "No parent (root)" : "Select parent"}
                        </option>
                        {parentOptions.map((node) => (
                          <option key={node.id} value={node.id}>
                            {node.name} ({toStartCase(node.role)})
                          </option>
                        ))}
                      </Select>
                      <Button type="button" variant="outline" disabled={isPending} onClick={submitReparent}>
                        {isPending ? "Saving..." : "Update Parent"}
                      </Button>
                    </div>
                  </div>

                  <Button type="button" variant="danger" disabled={isPending} onClick={submitDelete}>
                    {isPending ? "Saving..." : "Delete Node"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>
                    Click a node to edit it, or click a row plus button to add a new node.
                  </CardDescription>
                </div>
              )}
            </Card>
          ) : null}
        </div>

        <Card className="h-fit xl:sticky xl:top-6">
          <CardTitle>Node Details</CardTitle>
          {selectedNode ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
                <p className="font-semibold text-slate-900">{selectedNode.name}</p>
                <p className="text-slate-600">{toStartCase(selectedNode.role)}</p>
                <p className="mt-1 text-slate-500">
                  Zone: {activeZone?.name ?? "N/A"} | Region: {activeZone?.regionName ?? "N/A"}
                </p>
                <p className="mt-1 text-slate-500">
                  Direct reports: {activeChildrenByParent.get(selectedNode.id)?.length ?? 0}
                </p>
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600">
                <p>Overseers: {subtreeCounts.overseers}</p>
                <p>Supervisors: {subtreeCounts.supervisors}</p>
                <p>Coordinators: {subtreeCounts.coordinators}</p>
                <p>Homecell Leaders: {subtreeCounts.homecellLeaders}</p>
              </div>
            </div>
          ) : (
            <CardDescription className="mt-4">Select a node from the hierarchy board.</CardDescription>
          )}
        </Card>
      </div>
    </div>
  );
}
