"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { DistributionSlice } from "@/lib/mock/dashboard";

const STATUS_COLORS: Record<DistributionSlice["status"], string> = {
  PASS: "#15803d",
  POTENTIAL_NON_COMPLIANCE: "#b91c1c",
  NEEDS_REVIEW: "#b45309",
};

export function ComplianceDistribution({ data }: { data: DistributionSlice[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Compliance Distribution</CardTitle>
        <CardDescription>{total.toLocaleString("en-IN")} inspections evaluated</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.map((slice) => (
                  <Cell key={slice.status} fill={STATUS_COLORS[slice.status]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid #e2e5eb",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value, name) => [`${Number(value).toLocaleString("en-IN")}`, name]}
              />
              <Legend
                verticalAlign="bottom"
                height={48}
                iconType="circle"
                iconSize={8}
                formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
