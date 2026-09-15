"use client";

import { useEffect, useState } from "react";
import { FileDown, FileText, Loader2, CheckCircle2, XCircle, AlertTriangle, ClipboardList } from "lucide-react";
import { usePageHeader } from "@/components/layout/page-header-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { MOCK_INSPECTORS } from "@/lib/mock/inspectors";
import { getReportSummary, generatePdfReport, exportInspectionData } from "@/lib/api/reports";
import type { ProductCategory, ReportFilters, ReportSummary, InspectionStatus } from "@/types";

const CATEGORIES: ProductCategory[] = [
  "Food",
  "Beverage",
  "Cosmetics",
  "Household Goods",
  "Personal Care",
  "Electrical",
  "Other",
];

export default function ReportsPage() {
  usePageHeader("Reports", [{ label: "Dashboard", href: "/dashboard" }, { label: "Reports" }]);

  const [filters, setFilters] = useState<ReportFilters>({});
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  useEffect(() => {
    getReportSummary(filters).then(setSummary);
  }, [filters]);

  function updateFilter<K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
  }

  async function handleGeneratePdf() {
    setIsGenerating(true);
    setLastAction(null);
    try {
      const res = await generatePdfReport(filters);
      setLastAction(`PDF report "${res.fileName}" generated (demo mode — no file is downloaded).`);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleExport() {
    setIsExporting(true);
    setLastAction(null);
    try {
      const res = await exportInspectionData(filters);
      setLastAction(`Exported ${res.rowCount} inspection${res.rowCount === 1 ? "" : "s"} to "${res.fileName}" (demo mode — no file is downloaded).`);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
          <CardDescription>Narrow the dataset before generating or exporting a report.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="dateFrom">From</Label>
            <Input id="dateFrom" type="date" onChange={(e) => updateFilter("dateFrom", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dateTo">To</Label>
            <Input id="dateTo" type="date" onChange={(e) => updateFilter("dateTo", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select onValueChange={(v) => updateFilter("category", v === "ALL" ? undefined : v)}>
              <SelectTrigger>
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
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select onValueChange={(v) => updateFilter("status", v === "ALL" ? undefined : (v as InspectionStatus))}>
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="PASS">Pass</SelectItem>
                <SelectItem value="POTENTIAL_NON_COMPLIANCE">Potential Non-Compliance</SelectItem>
                <SelectItem value="NEEDS_REVIEW">Needs Review</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
            <Label>Inspector</Label>
            <Select onValueChange={(v) => updateFilter("inspectorId", v === "ALL" ? undefined : v)}>
              <SelectTrigger className="sm:max-w-xs">
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
          </div>
        </CardContent>
      </Card>

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Total Inspections" value={summary.total} icon={ClipboardList} tone="neutral" />
          <SummaryCard label="Pass" value={summary.passed} icon={CheckCircle2} tone="pass" />
          <SummaryCard label="Potential Non-Compliance" value={summary.potentialNonCompliance} icon={XCircle} tone="fail" />
          <SummaryCard label="Needs Review" value={summary.needsReview} icon={AlertTriangle} tone="warn" />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Generate Report</CardTitle>
          <CardDescription>
            Produces a report based on the filters above. In demo mode this simulates the FastAPI
            report generation service and does not download a real file.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={handleGeneratePdf} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Generate PDF Report
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Export Data
          </Button>
        </CardContent>
        {lastAction && (
          <CardContent className="pt-0">
            <p className="rounded-md border border-status-neutral-border bg-status-neutral-bg px-3 py-2 text-sm text-status-neutral">
              {lastAction}
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
