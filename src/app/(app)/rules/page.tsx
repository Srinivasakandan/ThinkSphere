"use client";

import { useEffect, useState } from "react";
import { ScrollText, Search } from "lucide-react";
import { usePageHeader } from "@/components/layout/page-header-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { RuleTableSkeleton } from "@/components/common/skeletons";
import { EmptyState } from "@/components/common/empty-state";
import { formatDate } from "@/lib/format";
import { getRules } from "@/lib/api/rules";
import type { Rule } from "@/types";

export default function RulesPage() {
  usePageHeader("Rules", [{ label: "Dashboard", href: "/dashboard" }, { label: "Rules" }]);
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getRules().then(setRules);
  }, []);

  const filtered = rules?.filter((r) => {
    const q = search.toLowerCase();
    return (
      !q ||
      r.id.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.requirement.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Rules Repository</CardTitle>
          <CardDescription>
            Reference view of the Legal Metrology (Packaged Commodities) Rules, 2011 declarations
            applied by the rule engine. Rules are maintained centrally and cannot be edited here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search rules…"
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search rules"
            />
          </div>
        </CardContent>
      </Card>

      {rules === null ? (
        <RuleTableSkeleton />
      ) : filtered && filtered.length === 0 ? (
        <EmptyState icon={ScrollText} title="No rules match your search" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule ID</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Requirement</TableHead>
                <TableHead>Applicable Category</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered?.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium text-foreground">{rule.id}</TableCell>
                  <TableCell>{rule.category}</TableCell>
                  <TableCell className="max-w-sm text-muted-foreground">{rule.requirement}</TableCell>
                  <TableCell className="text-muted-foreground">{rule.applicableCategory}</TableCell>
                  <TableCell className="text-muted-foreground">{rule.source}</TableCell>
                  <TableCell className="text-muted-foreground">{rule.version}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(rule.effectiveDate)}</TableCell>
                  <TableCell>
                    <Badge variant={rule.status === "Active" ? "pass" : "secondary"}>{rule.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
