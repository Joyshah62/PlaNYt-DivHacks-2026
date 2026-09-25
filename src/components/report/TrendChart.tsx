"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendPoint } from "@/lib/nyc/types";

/**
 * Single series, so no legend - the section heading names it. Colours are the
 * validated blue steps: #256abf on the light surface, #3987e5 on the dark one
 * (a dark mode is chosen, never an automatic flip of the light one).
 */
export function TrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) return null;
  const peak = data.reduce((a, b) => (b.count > a.count ? b : a), data[0]);

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 28, right: 8, bottom: 4, left: 0 }}
          barCategoryGap="28%"
        >
          <CartesianGrid
            vertical={false}
            stroke="currentColor"
            className="text-border"
            strokeDasharray="0"
          />
          <XAxis
            dataKey="year"
            tickLine={false}
            axisLine={false}
            tickMargin={12}
            tick={{ fontSize: 13 }}
            stroke="currentColor"
            className="text-muted-foreground"
            tickFormatter={(year: number) =>
              data.find((p) => p.year === year)?.partial ? `${year}*` : String(year)
            }
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            tick={{ fontSize: 13 }}
            stroke="currentColor"
            className="text-muted-foreground"
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "currentColor", className: "text-accent" }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const count = payload[0].value as number;
              const partial = data.find((p) => p.year === label)?.partial;
              return (
                <div className="rounded-xl border border-border bg-popover px-3.5 py-2.5 shadow-lg">
                  <p className="text-xs text-muted-foreground">
                    {label}
                    {partial ? " (year in progress)" : ""}
                  </p>
                  <p className="text-sm font-medium">
                    {count.toLocaleString()}{" "}
                    {count === 1 ? "reported problem" : "reported problems"}
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((point) => (
              <Cell
                key={point.year}
                className="fill-[#256abf] dark:fill-[#3987e5]"
                // The year in progress is drawn lighter so it is never read as a
                // completed year alongside the others.
                fillOpacity={point.partial ? 0.5 : 1}
              />
            ))}
            {/* Label the peak only - a number on every bar is noise. */}
            <LabelList
              dataKey="count"
              position="top"
              offset={10}
              className="fill-foreground"
              fontSize={13}
              fontWeight={500}
              formatter={(value) =>
                Number(value) === peak.count && peak.count > 0
                  ? Number(value).toLocaleString()
                  : ""
              }
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
