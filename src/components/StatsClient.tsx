"use client"

import { useState } from "react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from "recharts"

const TEAL = "#0d9488"
const COLORS = ["#0d9488", "#0891b2", "#7c3aed", "#db2777", "#d97706", "#65a30d", "#dc2626"]

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workouts: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  volumeStats: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  personalRecords: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  oneRepMaxes: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  muscleGroups: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  weeklyVolume: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  totals: any
}

export default function StatsClient({
  workouts,
  personalRecords,
  oneRepMaxes,
  muscleGroups,
  weeklyVolume,
  totals,
}: Props) {
  const [activeTab, setActiveTab] = useState<"overview" | "records" | "muscles">("overview")

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "records", label: "PRs" },
    { id: "muscles", label: "Muscles" },
  ] as const

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const weeklyChartData = weeklyVolume.map((w: any) => ({
    week: new Date(w.week).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    volume: Math.round(Number(w.volume)),
    workouts: Number(w.workout_count),
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const muscleChartData = muscleGroups.map((m: any) => ({
    name: m.muscle_group,
    value: Number(m.total_sets),
  }))

  return (
    <div className="space-y-4">

      {/* All time totals */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
          <p className="text-neutral-400 text-xs mb-1">Total Workouts</p>
          <p className="text-3xl font-bold text-teal-400">{totals?.total_workouts ?? 0}</p>
        </div>
        <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
          <p className="text-neutral-400 text-xs mb-1">Total Volume</p>
          <p className="text-2xl font-bold text-teal-400">
            {Number(totals?.total_volume ?? 0).toLocaleString()}
            <span className="text-base text-neutral-400"> kg</span>
          </p>
        </div>
        <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
          <p className="text-neutral-400 text-xs mb-1">Total Sets</p>
          <p className="text-3xl font-bold text-white">{totals?.total_sets ?? 0}</p>
        </div>
        <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
          <p className="text-neutral-400 text-xs mb-1">Time Trained</p>
          <p className="text-3xl font-bold text-white">
            {Math.round(Number(totals?.total_minutes ?? 0) / 60)}
            <span className="text-base text-neutral-400"> hrs</span>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-neutral-900 rounded-xl border border-neutral-800 p-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-teal-600 text-white"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-4">

          <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 overflow-hidden">
            <p className="text-sm font-medium mb-3">Weekly Volume (last 12 weeks)</p>
            {weeklyChartData.length === 0 ? (
              <p className="text-neutral-500 text-sm text-center py-8">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={weeklyChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="week" tick={{ fontSize: 9, fill: "#737373" }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: "#737373" }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#171717", border: "1px solid #262626", borderRadius: 8 }}
                    labelStyle={{ color: "#a3a3a3" }}
                    itemStyle={{ color: "#fff" }}
                  />
                  <Bar dataKey="volume" fill={TEAL} radius={[4, 4, 0, 0]} name="Volume (kg)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 overflow-hidden">
            <p className="text-sm font-medium mb-3">Workouts per Week</p>
            {weeklyChartData.length === 0 ? (
              <p className="text-neutral-500 text-sm text-center py-8">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={weeklyChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="week" tick={{ fontSize: 9, fill: "#737373" }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: "#737373" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#171717", border: "1px solid #262626", borderRadius: 8 }}
                    labelStyle={{ color: "#a3a3a3" }}
                    itemStyle={{ color: "#fff" }}
                  />
                  <Line dataKey="workouts" stroke={TEAL} strokeWidth={2} dot={{ fill: TEAL }} name="Workouts" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
            <p className="text-sm font-medium mb-3">Recent Workouts</p>
            {workouts.length === 0 ? (
              <p className="text-neutral-500 text-sm">No workouts yet</p>
            ) : (
              <div className="space-y-0">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {workouts.slice(0, 5).map((w: any) => (
                  <div key={w.id} className="flex items-center justify-between py-2.5 border-t border-neutral-800 first:border-0">
                    <div>
                      <p className="text-sm font-medium">{w.name}</p>
                      <p className="text-xs text-neutral-500">
                        {new Date(w.performed_at).toLocaleDateString("en-US", {
                          weekday: "short", month: "short", day: "numeric"
                        })}
                      </p>
                    </div>
                    {w.duration_minutes && (
                      <p className="text-xs text-neutral-400">{w.duration_minutes} min</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Personal Records Tab */}
      {activeTab === "records" && (
        <div className="space-y-3">

          <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
            <p className="text-sm font-medium mb-1">Estimated 1 Rep Max</p>
            <p className="text-xs text-neutral-500 mb-3">Epley formula</p>
            {oneRepMaxes.length === 0 ? (
              <p className="text-neutral-500 text-sm">No data yet — log sets with weight and reps</p>
            ) : (
              <div className="space-y-0">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {oneRepMaxes.slice(0, 10).map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-3 border-t border-neutral-800 first:border-0">
                    <div className="flex-1 min-w-0 pr-3">
                      <p className="text-sm font-medium capitalize truncate">{r.exercise_name}</p>
                      <p className="text-xs text-teal-400 capitalize">{r.muscle_group}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {r.best_weight}kg × {r.best_reps}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xl font-bold text-white">
                        {Math.round(Number(r.estimated_1rm))}
                        <span className="text-sm text-neutral-400"> kg</span>
                      </p>
                      <p className="text-xs text-neutral-500">est. 1RM</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
            <p className="text-sm font-medium mb-3">Heaviest Lifts</p>
            {personalRecords.length === 0 ? (
              <p className="text-neutral-500 text-sm">No data yet</p>
            ) : (
              <div className="space-y-0">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {personalRecords.map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-3 border-t border-neutral-800 first:border-0">
                    <div className="flex-1 min-w-0 pr-3">
                      <p className="text-sm font-medium capitalize truncate">{r.exercise_name}</p>
                      <p className="text-xs text-teal-400 capitalize">{r.muscle_group}</p>
                    </div>
                    <p className="text-lg font-bold text-white flex-shrink-0">
                      {r.max_weight}
                      <span className="text-sm text-neutral-400"> kg</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Muscle Groups Tab */}
      {activeTab === "muscles" && (
        <div className="space-y-4">

          <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 overflow-hidden">
            <p className="text-sm font-medium mb-4">Sets by Muscle Group</p>
            {muscleChartData.length === 0 ? (
              <p className="text-neutral-500 text-sm text-center py-8">No data yet</p>
            ) : (
              <div className="flex items-center gap-3">
                <ResponsiveContainer width="45%" height={160}>
                  <PieChart>
                    <Pie
                      data={muscleChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      dataKey="value"
                    >
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {muscleChartData.map((_: any, index: number) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "#171717", border: "1px solid #262626", borderRadius: 8 }}
                      itemStyle={{ color: "#fff" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {muscleChartData.map((m: any, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-neutral-300 capitalize truncate">{m.name}</span>
                      <span className="text-xs text-neutral-500 ml-auto flex-shrink-0">{m.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 overflow-hidden">
            <p className="text-sm font-medium mb-3">Volume by Muscle</p>
            {muscleChartData.length === 0 ? (
              <p className="text-neutral-500 text-sm text-center py-8">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={muscleChartData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 9, fill: "#737373" }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "#737373" }} width={70} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#171717", border: "1px solid #262626", borderRadius: 8 }}
                    itemStyle={{ color: "#fff" }}
                  />
                  <Bar dataKey="value" fill={TEAL} radius={[0, 4, 4, 0]} name="Sets" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

    </div>
  )
}