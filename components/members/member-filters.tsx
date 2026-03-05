"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Option = {
  id: string;
  name: string;
};

type MemberFiltersProps = {
  homecells: Option[];
  departments: Option[];
};

export function MemberFilters({ homecells, departments }: MemberFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (search) params.set("q", search);
      else params.delete("q");
      params.set("page", "1");
      router.replace(`${pathname}?${params.toString()}`);
    }, 350);

    return () => clearTimeout(timer);
  }, [search, pathname, router, searchParams]);

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="grid gap-3 md:grid-cols-4">
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search name, phone, email..."
      />
      <Select
        defaultValue={searchParams.get("homecellId") ?? ""}
        onChange={(event) => updateFilter("homecellId", event.target.value)}
      >
        <option value="">All homecells</option>
        {homecells.map((homecell) => (
          <option key={homecell.id} value={homecell.id}>
            {homecell.name}
          </option>
        ))}
      </Select>
      <Select
        defaultValue={searchParams.get("departmentId") ?? ""}
        onChange={(event) => updateFilter("departmentId", event.target.value)}
      >
        <option value="">All departments</option>
        {departments.map((department) => (
          <option key={department.id} value={department.id}>
            {department.name}
          </option>
        ))}
      </Select>
      <Select
        defaultValue={searchParams.get("status") ?? ""}
        onChange={(event) => updateFilter("status", event.target.value)}
      >
        <option value="">All statuses</option>
        <option value="ACTIVE">Active</option>
        <option value="INACTIVE">Inactive</option>
        <option value="VISITOR">Visitor</option>
      </Select>
    </div>
  );
}

