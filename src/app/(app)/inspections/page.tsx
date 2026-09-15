"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search, FilePlus2, ChevronLeft, ChevronRight } from "lucide-react";
import { usePageHeader } from "@/components/layout/page-header-context";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InspectionTable } from "@/components/inspection/inspection-table";
import { InspectionTableSkeleton } from "@/components/common/skeletons";
import { getInspections } from "@/lib/api/inspections";
import { MOCK_INSPECTORS } from "@/lib/mock/inspectors";
import type { Inspection, InspectionStatus, ProductCategory } from "@/types";

const CATEGORIES: ProductCategory[] = [
  "Food",
  "Beverage",
  "Cosmetics",
  "Household Goods",
  "Personal Care",
  "Electrical",
  "Other",
];

const STATUSES: { value: InspectionStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All statuses" },
  { value: "PASS", label: "Pass" },
  { value: "POTENTIAL_NON_COMPLIANCE", label: "Potential Non-Compliance" },
  { value: "NEEDS_REVIEW", label: "Needs Review" },
];

const PAGE_SIZE = 8;

export default function InspectionHistoryPage() {
  usePageHeader("Inspections", [{ label: "Dashboard", href: "/dashboard" }, { label: "Inspections" }]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InspectionStatus | "ALL">("ALL");
  const [category, setCategory] = useState<string>("ALL");
  const [inspectorId, setInspectorId] = useState<string>("ALL");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<Inspection[] | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag before async fetch below
    setItems(null);
    getInspections({ search, status, category, inspectorId, page, pageSize: PAGE_SIZE }).then((res) => {
      if (!active) return;
      setItems(res.items);
      setTotal(res.total);
    });
    return () => {
      active = false;
    };
  }, [search, status, category, inspectorId, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Browse, search and filter past inspections. Select any row to view its full record.
        </p>
        <Button asChild>
          <Link href="/inspections/new">
            <FilePlus2 className="h-4 w-4" /> New Inspection
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search product name or inspection ID…"
              className="pl-8"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              aria-label="Search inspections"
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as InspectionStatus | "ALL");
              setPage(1);
            }}
          >
            <SelectTrigger aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={category}
            onValueChange={(v) => {
              setCategory(v);
              setPage(1);
            }}
          >
            <SelectTrigger aria-label="Filter by category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={inspectorId}
            onValueChange={(v) => {
              setInspectorId(v);
              setPage(1);
            }}
          >
            <SelectTrigger aria-label="Filter by inspector">
              <SelectValue placeholder="All inspectors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All inspectors</SelectItem>
              {MOCK_INSPECTORS.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {items === null ? (
        <InspectionTableSkeleton rows={PAGE_SIZE} />
      ) : (
        <div className="space-y-3">
          <InspectionTable inspections={items} />
          {total > 0 && (
            <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
              <p>
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </Button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
