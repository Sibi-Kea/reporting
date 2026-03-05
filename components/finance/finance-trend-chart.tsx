"use client";

import { useSyncExternalStore } from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Line,
  LineChart,
} from "recharts";

import { Card, CardTitle } from "@/components/ui/card";

type TrendPoint = {
  month: string;
  total: number;
  tithe: number;
};

type FinanceTrendChartProps = {
  data: TrendPoint[];
};

export function FinanceTrendChart({ data }: FinanceTrendChartProps) {
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
        <CardTitle>Monthly Giving Trend</CardTitle>
        <div className="mt-3 h-72">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <CardTitle>Tithe Trend</CardTitle>
        <div className="mt-3 h-72">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="tithe" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
