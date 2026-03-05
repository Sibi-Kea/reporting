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
  LineChart,
  Line,
} from "recharts";

import { Card, CardTitle } from "@/components/ui/card";

type ChartsProps = {
  attendanceTrend: Array<{ date: string; attendanceRate: number }>;
  growthTrend: Array<{ month: string; joined: number }>;
  genderDistribution: Array<{ name: string; value: number }>;
};

const COLORS = ["#0284c7", "#0ea5e9", "#14b8a6", "#22c55e"];

export function OverviewCharts({
  attendanceTrend,
  growthTrend,
  genderDistribution,
}: ChartsProps) {
  const isReady = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!isReady) {
    return (
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="h-72 animate-pulse rounded-lg bg-slate-100" />
        </Card>
        <Card>
          <div className="h-72 animate-pulse rounded-lg bg-slate-100" />
        </Card>
        <Card className="xl:col-span-3">
          <div className="h-72 animate-pulse rounded-lg bg-slate-100" />
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardTitle>Attendance Trend</CardTitle>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={attendanceTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="attendanceRate"
                stroke="#0284c7"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <CardTitle>Gender Distribution</CardTitle>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart>
              <Pie
                data={genderDistribution}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={90}
              >
                {genderDistribution.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card className="xl:col-span-3">
        <CardTitle>Monthly Growth</CardTitle>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={growthTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="joined" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
