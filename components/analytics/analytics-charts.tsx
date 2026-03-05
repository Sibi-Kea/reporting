"use client";

import { useSyncExternalStore } from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardTitle } from "@/components/ui/card";

type ChartsProps = {
  genderDistribution: Array<{ name: string; value: number }>;
  ageGroups: Array<{ name: string; value: number }>;
  maritalStatus: Array<{ name: string; value: number }>;
  ltvDistribution: Array<{ name: string; value: number }>;
  attendanceHomecells: Array<{ name: string; attendanceRate: number }>;
};

const colors = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];

export function AnalyticsCharts({
  genderDistribution,
  ageGroups,
  maritalStatus,
  ltvDistribution,
  attendanceHomecells,
}: ChartsProps) {
  const isReady = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!isReady) {
    return (
      <div className="grid gap-5 xl:grid-cols-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index} className={index === 4 ? "xl:col-span-2" : undefined}>
            <div className="h-72 animate-pulse rounded-lg bg-slate-100" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <CardTitle>Gender Distribution</CardTitle>
        <div className="mt-3 h-72">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart>
              <Pie data={genderDistribution} dataKey="value" nameKey="name" outerRadius={90}>
                {genderDistribution.map((entry, index) => (
                  <Cell key={entry.name} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <CardTitle>Age Groups</CardTitle>
        <div className="mt-3 h-72">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={ageGroups}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <CardTitle>Marital Status</CardTitle>
        <div className="mt-3 h-72">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={maritalStatus}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#22c55e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <CardTitle>LTV Distribution</CardTitle>
        <div className="mt-3 h-72">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={ltvDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card className="xl:col-span-2">
        <CardTitle>Homecell Attendance Performance</CardTitle>
        <div className="mt-3 h-72">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={attendanceHomecells}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="attendanceRate" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
