import Link from "next/link";
import { Eye } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { formatDate } from "@/lib/format";
import type { Inspection } from "@/types";
import { ClipboardList } from "lucide-react";

export function InspectionTable({ inspections }: { inspections: Inspection[] }) {
  if (inspections.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No inspections yet"
        description="Start your first inspection by uploading product images."
        action={
          <Button asChild size="sm">
            <Link href="/inspections/new">+ New Inspection</Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      {/* Desktop / tablet table */}
      <div className="hidden overflow-hidden rounded-lg border border-border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Inspection ID</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Inspector</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inspections.map((inspection) => (
              <TableRow key={inspection.id}>
                <TableCell className="font-medium text-foreground">{inspection.id}</TableCell>
                <TableCell>{inspection.productName ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{inspection.category ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(inspection.createdAt)}</TableCell>
                <TableCell className="text-muted-foreground">{inspection.inspectorName}</TableCell>
                <TableCell>
                  <StatusBadge status={inspection.overallStatus} size="sm" showExplanation />
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/inspections/${inspection.id}`}>
                      <Eye className="h-3.5 w-3.5" /> View
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 sm:hidden">
        {inspections.map((inspection) => (
          <Link
            key={inspection.id}
            href={`/inspections/${inspection.id}`}
            className="focus-ring block rounded-lg border border-border bg-card p-4"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">{inspection.id}</p>
                <p className="text-sm text-muted-foreground">{inspection.productName ?? "—"}</p>
              </div>
              <StatusBadge status={inspection.overallStatus} size="sm" />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{inspection.category ?? "—"}</span>
              <span>{formatDate(inspection.createdAt)}</span>
              <span>{inspection.inspectorName}</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
