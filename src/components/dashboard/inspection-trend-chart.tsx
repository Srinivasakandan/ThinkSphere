"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { TrendPoint } from "@/lib/mock/dashboard";

export function InspectionTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Inspection Trend</CardTitle>
        <CardDescription>Inspections completed per week</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1d4ed8" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e5eb" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: "#64748b" }}
                axisLine={{ stroke: "#e2e5eb" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <Tooltip
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid #e2e5eb",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#171a1f", fontWeight: 600 }}
              />
              <Area
                type="monotone"
                dataKey="inspections"
                stroke="#1d4ed8"
                strokeWidth={2}
                fill="url(#trendFill)"
                name="Inspections"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
