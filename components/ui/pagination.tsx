import Link from "next/link";

import { Button } from "@/components/ui/button";

type PaginationProps = {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
};

export function Pagination({ page, totalPages, buildHref }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-end gap-2">
      <Link href={buildHref(Math.max(page - 1, 1))}>
        <Button variant="outline" disabled={page <= 1}>
          Previous
        </Button>
      </Link>
      <span className="text-sm text-slate-500">
        Page {page} of {totalPages}
      </span>
      <Link href={buildHref(Math.min(page + 1, totalPages))}>
        <Button variant="outline" disabled={page >= totalPages}>
          Next
        </Button>
      </Link>
    </div>
  );
}

