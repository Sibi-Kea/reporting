"use client";

import { useSyncExternalStore } from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardTitle } from "@/components/ui/card";

type ServiceAttendancePoint = {
  service: string;
  total: number;
  present: number;
};

type WeeklyMinistryPoint = {
  label: string;
  membersPresent: number;
  visitors: number;
  firstTimeVisitors: number;
  salvations: number;
};

type AttendanceMixPoint = {
  name: string;
  value: number;
};

type MinistryFlowPoint = {
  stage: string;
  total: number;
};

type ReportsChartsProps = {
  serviceAttendance: ServiceAttendancePoint[];
  weeklyMinistry: WeeklyMinistryPoint[];
  attendanceMix: AttendanceMixPoint[];
  ministryFlow: MinistryFlowPoint[];
};

const pieColors = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

export function ReportsCharts({
  serviceAttendance,
  weeklyMinistry,
  attendanceMix,
  ministryFlow,
}: ReportsChartsProps) {
  const isReady = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!isReady) {
    return (
      <div className="grid gap-5 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <div className="h-72 animate-pulse rounded-lg bg-slate-100" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <CardTitle>Church Attendance By Service</CardTitle>
        {serviceAttendance.length > 0 ? (
          <div className="mt-3 h-72">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={serviceAttendance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="service" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" name="Total" fill="#cbd5e1" radius={[6, 6, 0, 0]} />
                <Bar dataKey="present" name="Present + Online" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="mt-3">
            <EmptyChartState message="No church attendance data yet for this period." />
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>Weekly Flow (Members To Salvations)</CardTitle>
        {weeklyMinistry.length > 0 ? (
          <div className="mt-3 h-72">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={weeklyMinistry}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="membersPresent" name="Members Present" stroke="#0ea5e9" strokeWidth={2.5} />
                <Line type="monotone" dataKey="visitors" name="Visitors" stroke="#16a34a" strokeWidth={2.5} />
                <Line type="monotone" dataKey="firstTimeVisitors" name="FTV" stroke="#f59e0b" strokeWidth={2.5} />
                <Line type="monotone" dataKey="salvations" name="Salvations" stroke="#ef4444" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="mt-3">
            <EmptyChartState message="No homecell reporting flow yet for this period." />
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>Attendance Volume Mix</CardTitle>
        {attendanceMix.some((item) => item.value > 0) ? (
          <div className="mt-3 h-72">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart>
                <Pie data={attendanceMix} dataKey="value" nameKey="name" outerRadius={100}>
                  {attendanceMix.map((entry, index) => (
                    <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="mt-3">
            <EmptyChartState message="No attendance mix data available yet." />
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>CRC Members To Salvations Funnel</CardTitle>
        {ministryFlow.length > 0 ? (
          <div className="mt-3 h-72">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={ministryFlow}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" name="Total" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="mt-3">
            <EmptyChartState message="No ministry funnel data available yet." />
          </div>
        )}
      </Card>
    </div>
  );
}

