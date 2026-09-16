"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClipboardList, CheckCircle2, XCircle, AlertTriangle, FilePlus2, History, FileBarChart } from "lucide-react";
import { usePageHeader } from "@/components/layout/page-header-context";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { InspectionTrendChart } from "@/components/dashboard/inspection-trend-chart";
import { ComplianceDistribution } from "@/components/dashboard/compliance-distribution";
import { RecentInspections } from "@/components/dashboard/recent-inspections";
import { DashboardSkeleton } from "@/components/common/skeletons";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getInspections } from "@/lib/api/inspections";
import { getDashboardSummary, getDashboardTrends } from "@/lib/api/dashboard";
import type { DistributionSlice, TrendPoint } from "@/lib/mock/dashboard";
import type { Inspection } from "@/types";

interface DashboardData {
  totals: { total: number; passed: number; potentialNonCompliance: number; needsReview: number };
  trend: TrendPoint[];
  distribution: DistributionSlice[];
  inspections: Inspection[];
}

export default function DashboardPage() {
  usePageHeader("Dashboard");
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getDashboardSummary(), getDashboardTrends(), getInspections({ pageSize: 6 })]).then(
      ([summary, trends, recent]) => {
        if (!active) return;
        setData({
          totals: {
            total: summary.total,
            passed: summary.passed,
            potentialNonCompliance: summary.potential_non_compliance,
            needsReview: summary.needs_review,
          },
          trend: trends.points.map((p) => ({ date: p.date, inspections: p.inspections })),
          distribution: [
            { name: "Pass", value: summary.passed, status: "PASS" },
            {
              name: "Potential Non-Compliance",
              value: summary.potential_non_compliance,
              status: "POTENTIAL_NON_COMPLIANCE",
            },
            { name: "Needs Review", value: summary.needs_review, status: "NEEDS_REVIEW" },
          ],
          inspections: recent.items,
        });
      }
    );
    return () => {
      active = false;
    };
  }, []);

  if (!data) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total Inspections" value={data.totals.total} icon={ClipboardList} tone="neutral" />
        <SummaryCard label="Pass" value={data.totals.passed} icon={CheckCircle2} tone="pass" />
        <SummaryCard
          label="Potential Non-Compliance"
          value={data.totals.potentialNonCompliance}
          icon={XCircle}
          tone="fail"
        />
        <SummaryCard label="Needs Review" value={data.totals.needsReview} icon={AlertTriangle} tone="warn" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <InspectionTrendChart data={data.trend} />
        </div>
        <ComplianceDistribution data={data.distribution} />
      </div>

      <RecentInspections inspections={data.inspections} />

      <Card>
        <CardContent className="pt-5">
          <p className="mb-3 text-sm font-semibold text-foreground">Quick Actions</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Button asChild size="lg" className="justify-start">
              <Link href="/inspections/new">
                <FilePlus2 className="h-4 w-4" /> New Inspection
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="justify-start">
              <Link href="/inspections">
                <History className="h-4 w-4" /> View Inspection History
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="justify-start">
              <Link href="/reports">
                <FileBarChart className="h-4 w-4" /> Generate Report
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
