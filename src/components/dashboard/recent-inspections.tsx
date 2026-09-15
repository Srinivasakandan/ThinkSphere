import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InspectionTable } from "@/components/inspection/inspection-table";
import type { Inspection } from "@/types";

export function RecentInspections({ inspections }: { inspections: Inspection[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Recent Inspections</CardTitle>
        <Button asChild variant="ghost" size="sm">
          <Link href="/inspections">View all</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <InspectionTable inspections={inspections.slice(0, 6)} />
      </CardContent>
    </Card>
  );
}
