"use client";

import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import type {
  DauWauMauDto,
  MoodTrendsDto,
  CardUsageDto,
  ChurnIndicatorsDto,
} from "@/lib/dto/admin-analytics";

type Props = {
  dauWauMau: DauWauMauDto;
  moodTrends: MoodTrendsDto;
  cardUsage: CardUsageDto;
  churnIndicators: ChurnIndicatorsDto;
};

const GRID_STROKE = "rgba(255,255,255,0.1)";
const AXIS_STYLE = { stroke: "#999" };
const TICK_STYLE = { fill: "#999", fontSize: 12 };
const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: "#1a1a1a", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8 },
  labelStyle: { color: "#999" },
  itemStyle: { color: "#fff" },
};

const MOOD_COLORS: Record<string, string> = {
  happy: "#22c55e",
  sad: "#3b82f6",
  anxious: "#ef4444",
  calm: "#8b5cf6",
  neutral: "#6b7280",
};

const STAT_ITEMS = [
  { label: "Cancellations", key: "cancellations" as const },
  { label: "Churn Count", key: "churnCount" as const },
  { label: "Paid Conversions", key: "paidConversions" as const },
  { label: "Revenue", key: "revenueCents" as const },
] as const;

export function AnalyticsView({ dauWauMau, moodTrends, cardUsage, churnIndicators }: Props) {
  const moodKeys = [...new Set(moodTrends.points.flatMap(p => Object.keys(p.distribution)))];
  const moodData = moodTrends.points.map(p => ({ date: p.date, ...p.distribution }));

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Platform metrics (last 30 days)" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* DAU / WAU / MAU */}
        <Card>
          <CardHeader>
            <CardTitle>Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dauWauMau.points}>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" />
                <XAxis dataKey="date" {...AXIS_STYLE} tick={TICK_STYLE} />
                <YAxis {...AXIS_STYLE} tick={TICK_STYLE} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend />
                <Line type="monotone" dataKey="dau" name="DAU" stroke="#E55805" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="wau" name="WAU" stroke="#c87a02" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="mau" name="MAU" stroke="#ffec00" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Cards */}
        <Card>
          <CardHeader>
            <CardTitle>Top Cards</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={cardUsage.rows} layout="vertical">
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" />
                <XAxis type="number" {...AXIS_STYLE} tick={TICK_STYLE} />
                <YAxis dataKey="cardName" type="category" width={100} {...AXIS_STYLE} tick={TICK_STYLE} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend />
                <Bar dataKey="draws" name="Draws" fill="#E55805" />
                <Bar dataKey="saves" name="Saves" fill="#22c55e" />
                <Bar dataKey="unlocks" name="Unlocks" fill="#ffec00" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Churn Indicators */}
        <Card>
          <CardHeader>
            <CardTitle>Churn Indicators</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {STAT_ITEMS.map(({ label, key }) => {
                const raw = churnIndicators[key];
                const value = key === "revenueCents"
                  ? `$${(raw / 100).toFixed(2)}`
                  : raw.toLocaleString();
                return (
                  <Card key={key}>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <p className="text-2xl font-bold">{value}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Mood Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Mood Trends</CardTitle>
          </CardHeader>
          <CardContent>
            {moodTrends.points.length === 0 ? (
              <p className="flex h-[300px] items-center justify-center text-muted-foreground">
                No mood data available
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={moodData}>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" />
                  <XAxis dataKey="date" {...AXIS_STYLE} tick={TICK_STYLE} />
                  <YAxis {...AXIS_STYLE} tick={TICK_STYLE} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend />
                  {moodKeys.map(mood => (
                    <Area
                      key={mood}
                      type="monotone"
                      dataKey={mood}
                      stackId="moods"
                      stroke={MOOD_COLORS[mood] ?? "#999"}
                      fill={MOOD_COLORS[mood] ?? "#999"}
                      fillOpacity={0.6}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
