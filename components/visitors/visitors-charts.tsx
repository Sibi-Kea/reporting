"use client";

import { useSyncExternalStore } from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardTitle } from "@/components/ui/card";

type VisitorsChartsProps = {
  followUpData: Array<{ status: string; count: number }>;
  visitorTypeData: Array<{ label: string; value: number }>;
};

const colors = ["#0284c7", "#14b8a6", "#f59e0b", "#ef4444"];

export function VisitorsCharts({ followUpData, visitorTypeData }: VisitorsChartsProps) {
  const isReady = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!isReady) {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="h-72 animate-pulse rounded-lg bg-slate-100" />
        </Card>
        <Card>
          <div className="h-72 animate-pulse rounded-lg bg-slate-100" />
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardTitle>Follow-up Pipeline</CardTitle>
        <div className="mt-3 h-72">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={followUpData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="status" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <CardTitle>Visitor Type Mix</CardTitle>
        <div className="mt-3 h-72">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart>
              <Pie data={visitorTypeData} dataKey="value" nameKey="label" outerRadius={100}>
                {visitorTypeData.map((entry, index) => (
                  <Cell key={entry.label} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
