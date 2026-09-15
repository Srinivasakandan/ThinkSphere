import { ImageIcon } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { formatViewType } from "@/lib/format";
import type { ProductImage, RuleResult } from "@/types";

const ACTION_LABEL: Record<RuleResult["status"], string> = {
  PASS: "View",
  POTENTIAL_NON_COMPLIANCE: "Review",
  NEEDS_REVIEW: "Verify",
};

interface RuleTableProps {
  rules: RuleResult[];
  images: ProductImage[];
  onSelect: (rule: RuleResult) => void;
}

export function RuleTable({ rules, images, onSelect }: RuleTableProps) {
  const imageById = Object.fromEntries(images.map((img) => [img.id, img]));

  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rule</TableHead>
              <TableHead>Requirement</TableHead>
              <TableHead>Detected Value</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Evidence</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => {
              const evidence = rule.evidenceImageId ? imageById[rule.evidenceImageId] : undefined;
              return (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium text-foreground">{rule.ruleId}</TableCell>
                  <TableCell className="max-w-xs text-muted-foreground">{rule.requirement}</TableCell>
                  <TableCell>{rule.detectedValue || <span className="italic text-muted-foreground">Not detected</span>}</TableCell>
                  <TableCell>
                    <StatusBadge status={rule.status} size="sm" showExplanation />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {evidence ? (
                      <span className="inline-flex items-center gap-1 text-xs">
                        <ImageIcon className="h-3 w-3" /> {formatViewType(evidence.viewType)} Image
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => onSelect(rule)}>
                      {ACTION_LABEL[rule.status]}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {rules.map((rule) => {
          const evidence = rule.evidenceImageId ? imageById[rule.evidenceImageId] : undefined;
          return (
            <button
              key={rule.id}
              type="button"
              onClick={() => onSelect(rule)}
              className="focus-ring block w-full rounded-lg border border-border bg-card p-4 text-left"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{rule.ruleId}</p>
                  <p className="text-xs text-muted-foreground">{rule.requirement}</p>
                </div>
                <StatusBadge status={rule.status} size="sm" />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Detected: {rule.detectedValue || "Not detected"}</span>
                {evidence && (
                  <span className="inline-flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" /> {formatViewType(evidence.viewType)}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
