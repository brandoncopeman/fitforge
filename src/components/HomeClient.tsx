"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Profile = {
  display_name?: string;
  daily_calorie_target: number;
  daily_protein_target: number;
  daily_step_target?: number;
  show_weight_on_home?: boolean;
  daily_quote?: {
    text?: string;
    author?: string;
  };
};

type ScheduleItem = {
  day_of_week: number;
  template_name?: string | null;
};

type WorkoutTemplate = {
  id: string | number;
  name: string;
  exercise_count?: number | null;
};

type ProgressEvent = {
  id: string;
  title: string;
  message: string;
  emoji: string | null;
  event_type: string;
};

type PlanStatus = {
  weeklyTarget: number;
  completedThisWeek: number;
  remainingThisWeek: number;
  status: "no_plan" | "on_track" | "behind" | "complete";
  title: string;
  message: string;
  emoji: string;
  streakWeeks: number;
};

type WeeklyRecapSummary = {
  id: string;
  title: string;
  message: string;
  emoji: string | null;
  workouts: number;
  volume: number;
  steps: number;
  goals: number;
  weightChange: number | null;
  created_at: string;
} | null;

function SortableSection({
  id,
  children,
  onClickCapture,
}: {
  id: string;
  children: React.ReactNode;
  onClickCapture: (e: React.MouseEvent) => void;
}) {
  const [pressing, setPressing] = useState(false);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  function startPressHint() {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
    }

    pressTimerRef.current = setTimeout(() => {
      setPressing(true);
    }, 250);
  }

  function stopPressHint() {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }

    setPressing(false);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onPointerDown={startPressHint}
      onPointerUp={stopPressHint}
      onPointerCancel={stopPressHint}
      onPointerLeave={stopPressHint}
      onClickCapture={onClickCapture}
      className={`h-full touch-none select-none ${
        isDragging ? "cursor-grabbing" : "cursor-pointer active:cursor-grab"
      } ${pressing || isDragging ? "home-card-pulse" : ""}`}
    >
      {children}
    </div>
  );
}

export default function HomeClient({
  profile,
  caloriesConsumed,
  todaySteps,
  latestWeight,
  schedule,
  todayDow,
  nextTemplate,
  sectionOrder: initialOrder,
  progressEvents,
  planStatus,
  weeklyRecap,
}: {
  profile: Profile;
  caloriesConsumed: number;
  todaySteps: number;
  latestWeight: number | null;
  schedule: ScheduleItem[];
  todayDow: number;
  nextTemplate: WorkoutTemplate | null;
  sectionOrder: string[];
  progressEvents: ProgressEvent[];
  planStatus: PlanStatus;
  weeklyRecap: WeeklyRecapSummary;
}) {
  const [sectionOrder, setSectionOrder] = useState(initialOrder);
  const isDraggingRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 500,
        tolerance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 500,
        tolerance: 8,
      },
    })
  );

  function handleDragStart() {
    isDraggingRef.current = true;
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sectionOrder.indexOf(String(active.id));
      const newIndex = sectionOrder.indexOf(String(over.id));
      const reordered = arrayMove(sectionOrder, oldIndex, newIndex);

      setSectionOrder(reordered);

      fetch("/api/profile/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ home_section_order: reordered }),
      });
    }

    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
  }

  const getSchedDay = (i: number) => schedule.find((s) => s.day_of_week === i);

  const latestProgressEvent = progressEvents[0];

  const SECTIONS: Record<string, React.ReactNode> = {
    calories: (
      <Link
        href="/food"
        className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 hover:border-teal-700 transition-colors block h-full"
      >
        <p className="text-neutral-400 text-xs mb-1">Daily Calories</p>
        <p className="text-2xl font-bold text-teal-400">{caloriesConsumed}</p>
        <p className="text-neutral-500 text-xs mt-1">
          of {profile.daily_calorie_target} kcal
        </p>
        <div className="w-full h-1 bg-neutral-800 rounded-full mt-3">
          <div
            className={`h-1 rounded-full ${
              caloriesConsumed > profile.daily_calorie_target
                ? "bg-red-500"
                : "bg-teal-500"
            }`}
            style={{
              width: `${Math.min(
                100,
                profile.daily_calorie_target > 0
                  ? (caloriesConsumed / profile.daily_calorie_target) * 100
                  : 0
              )}%`,
            }}
          />
        </div>
      </Link>
    ),

    protein: (
      <Link
        href="/macros"
        className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 hover:border-teal-700 transition-colors block h-full"
      >
        {profile.show_weight_on_home && latestWeight ? (
          <>
            <p className="text-neutral-400 text-xs mb-1">Weight</p>
            <p className="text-2xl font-bold text-white">
              {latestWeight}
              <span className="text-base text-neutral-400">kg</span>
            </p>
            <p className="text-neutral-500 text-xs mt-1">tap to update</p>
          </>
        ) : (
          <>
            <p className="text-neutral-400 text-xs mb-1">Daily Protein</p>
            <p className="text-2xl font-bold text-teal-400">
              {profile.daily_protein_target}g
            </p>
            <p className="text-neutral-500 text-xs mt-1">protein target</p>
          </>
        )}
        <div className="w-full h-1 bg-neutral-800 rounded-full mt-3">
          <div
            className="h-1 rounded-full bg-blue-500"
            style={{ width: "0%" }}
          />
        </div>
      </Link>
    ),

    steps: (
      <Link
        href="/steps"
        className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 hover:border-teal-700 transition-colors block h-full"
      >
        <p className="text-neutral-400 text-xs mb-1">Daily Steps</p>
        <p className="text-2xl font-bold text-white">
          {todaySteps.toLocaleString()}
        </p>
        <p className="text-neutral-500 text-xs mt-1">
          of {profile.daily_step_target?.toLocaleString()} goal
        </p>
        <div className="w-full h-1 bg-neutral-800 rounded-full mt-3">
          <div
            className="h-1 bg-teal-600 rounded-full"
            style={{
              width: `${Math.min(
                100,
                (todaySteps / (profile.daily_step_target || 8000)) * 100
              )}%`,
            }}
          />
        </div>
      </Link>
    ),

    schedule: (
      <Link
        href="/schedule"
        className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 hover:border-teal-700 transition-colors block h-full"
      >
        <p className="text-neutral-400 text-xs mb-2">This Week</p>
        <div className="grid grid-cols-7 gap-0.5">
          {DAYS_SHORT.map((day, i) => {
            const sd = getSchedDay(i);
            const isGym = !!sd;
            const isToday = i === todayDow;

            return (
              <div key={i} className="flex flex-col items-center">
                <span
                  className={`text-xs mb-0.5 ${
                    isToday ? "font-bold text-teal-400" : "text-neutral-500"
                  }`}
                >
                  {day[0]}
                </span>
                <div
                  className={`w-full aspect-square rounded flex items-center justify-center ${
                    isGym ? "bg-teal-600" : "bg-neutral-800"
                  } ${isToday ? "ring-1 ring-teal-400" : ""}`}
                >
                  {isGym && sd?.template_name && (
                    <div className="w-1 h-1 rounded-full bg-white" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Link>
    ),

    workouts: (
      <Link
        href="/workouts"
        className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 hover:border-teal-700 transition-colors block h-full"
      >
        <p className="text-neutral-400 text-xs mb-1">Workouts</p>
        <p className="text-xl">🏋️</p>
        <p className="text-neutral-400 text-xs mt-2">Templates & history</p>
      </Link>
    ),

    stats: (
      <Link
        href="/stats"
        className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 hover:border-teal-700 transition-colors block h-full"
      >
        <p className="text-neutral-400 text-xs mb-1">Stats</p>
        <p className="text-xl">📈</p>
        <p className="text-neutral-400 text-xs mt-2">Progress & records</p>
      </Link>
    ),

    goals: (
      <Link
        href="/goals"
        className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 hover:border-teal-700 transition-colors block h-full"
      >
        <p className="text-neutral-400 text-xs mb-1">Goals</p>
        <p className="text-xl">🎯</p>
        <p className="text-neutral-400 text-xs mt-2">Daily habits & tracker</p>
      </Link>
    ),

    food: (
      <Link
        href="/food"
        className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 hover:border-teal-700 transition-colors block h-full"
      >
        <p className="text-neutral-400 text-xs mb-1">Food</p>
        <p className="text-xl">🥗</p>
        <p className="text-neutral-400 text-xs mt-2">Log meals & macros</p>
      </Link>
    ),

    macros: (
      <Link
        href="/macros"
        className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 hover:border-teal-700 transition-colors block h-full"
      >
        <p className="text-neutral-400 text-xs mb-1">Macros</p>
        <p className="text-xl">⚖️</p>
        <p className="text-neutral-400 text-xs mt-2">TDEE & targets</p>
      </Link>
    ),

    next: (
      <Link
        href={
          nextTemplate
            ? `/workouts/new?template=${nextTemplate.id}`
            : "/workouts/new"
        }
        className="bg-teal-600/10 border border-teal-700/50 hover:bg-teal-600/20 rounded-xl p-4 transition-colors block h-full"
      >
        <p className="text-xs text-teal-400 font-medium mb-0.5">
          {nextTemplate ? "Next in plan" : "No plan set up"}
        </p>
        <p className="text-white font-semibold text-sm">
          {nextTemplate ? nextTemplate.name : "Empty Workout"}
        </p>
        <p className="text-neutral-400 text-xs mt-1">
          {nextTemplate
            ? `${nextTemplate.exercise_count ?? ""} exercises`
            : "Free session"}
        </p>
      </Link>
    ),
  };

  const gridSections = sectionOrder.filter(
    (s) => s !== "progress" && SECTIONS[s]
  );

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-5">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">FitForge</h1>
          <UserButton />
        </div>

        <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-5 mb-4">
          <h2 className="text-lg font-semibold mb-2">
            Welcome back, {profile.display_name || "there"}!
          </h2>
          <p className="text-neutral-300 text-sm italic">
            “{profile.daily_quote?.text}”
          </p>
          <p className="text-neutral-500 text-xs mt-1">
            — {profile.daily_quote?.author}
          </p>
        </div>

        <Link
          href="/stats?tab=badges"
          className="block bg-gradient-to-br from-teal-950/80 via-neutral-900 to-neutral-900 rounded-2xl border border-teal-800/70 p-5 mb-4 hover:border-teal-500 transition-colors shadow-lg shadow-teal-950/20"
        >
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-teal-500/10 border border-teal-700/60 flex items-center justify-center text-2xl flex-shrink-0">
              {latestProgressEvent?.emoji ?? "✨"}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3 mb-1">
                <p className="text-xs font-medium text-teal-300 uppercase tracking-wide">
                  Progress Story
                </p>
                <p className="text-xs text-neutral-500">View badges →</p>
              </div>

              {latestProgressEvent ? (
                <>
                  <h2 className="text-lg font-bold text-white leading-snug">
                    {latestProgressEvent.title}
                  </h2>
                  <p className="text-sm text-neutral-300 mt-1 leading-relaxed">
                    {latestProgressEvent.message}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-bold text-white leading-snug">
                    Start building your story
                  </h2>
                  <p className="text-sm text-neutral-300 mt-1 leading-relaxed">
                    Log workouts, weight, steps, or goals and FitForge will
                    start spotting your progress.
                  </p>
                </>
              )}
            </div>
          </div>
        </Link>

        <div className="grid grid-cols-1 gap-3 mb-4">
          <Link
            href="/workouts"
            className={`block rounded-2xl border p-5 transition-colors ${
              planStatus.status === "complete"
                ? "bg-teal-600/10 border-teal-700/60 hover:border-teal-500"
                : planStatus.status === "behind"
                ? "bg-orange-950/30 border-orange-800/60 hover:border-orange-600"
                : "bg-neutral-900 border-neutral-800 hover:border-teal-700"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-2xl flex-shrink-0">
                  {planStatus.emoji}
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                    Plan Status
                  </p>
                  <h2 className="text-lg font-bold text-white leading-snug">
                    {planStatus.title}
                  </h2>
                  <p className="text-sm text-neutral-400 mt-1">
                    {planStatus.message}
                  </p>
                </div>
              </div>

              {planStatus.weeklyTarget > 0 && (
                <div className="text-right flex-shrink-0">
                  <p className="text-2xl font-bold text-teal-400">
                    {planStatus.completedThisWeek}/{planStatus.weeklyTarget}
                  </p>
                  <p className="text-xs text-neutral-500">this week</p>
                </div>
              )}
            </div>

            {planStatus.weeklyTarget > 0 && (
              <div className="mt-4">
                <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-teal-500 rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        (planStatus.completedThisWeek /
                          planStatus.weeklyTarget) *
                          100
                      )}%`,
                    }}
                  />
                </div>

                {planStatus.streakWeeks > 0 && (
                  <p className="text-xs text-neutral-500 mt-2">
                    🔥 {planStatus.streakWeeks}-week workout streak
                  </p>
                )}
              </div>
            )}
          </Link>

          {weeklyRecap && (
            <Link
              href="/stats"
              className="block rounded-2xl border border-neutral-800 bg-neutral-900 p-5 hover:border-teal-700 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                    Weekly Recap
                  </p>
                  <h2 className="text-lg font-bold text-white">
                    {weeklyRecap.emoji ?? "📅"} {weeklyRecap.title}
                  </h2>
                </div>
                <p className="text-xs text-neutral-500">View stats →</p>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-xl bg-neutral-800 p-2">
                  <p className="text-lg font-bold text-teal-400">
                    {weeklyRecap.workouts}
                  </p>
                  <p className="text-[10px] text-neutral-500">workouts</p>
                </div>

                <div className="rounded-xl bg-neutral-800 p-2">
                  <p className="text-lg font-bold text-white">
                    {weeklyRecap.volume.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-neutral-500">kg</p>
                </div>

                <div className="rounded-xl bg-neutral-800 p-2">
                  <p className="text-lg font-bold text-white">
                    {weeklyRecap.steps.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-neutral-500">steps</p>
                </div>

                <div className="rounded-xl bg-neutral-800 p-2">
                  <p className="text-lg font-bold text-white">
                    {weeklyRecap.goals}
                  </p>
                  <p className="text-[10px] text-neutral-500">goals</p>
                </div>
              </div>

              {weeklyRecap.weightChange !== null && (
                <p className="text-xs text-neutral-500 mt-3">
                  Weight trend:{" "}
                  <span
                    className={
                      weeklyRecap.weightChange < 0
                        ? "text-teal-400"
                        : weeklyRecap.weightChange > 0
                        ? "text-orange-400"
                        : "text-neutral-400"
                    }
                  >
                    {weeklyRecap.weightChange > 0 ? "+" : ""}
                    {weeklyRecap.weightChange}kg
                  </span>
                </p>
              )}
            </Link>
          )}
        </div>
        <p className="text-xs text-neutral-600 mb-2 text-center">
          Press and hold a card to rearrange
        </p>
        <DndContext
          id="home-dnd"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={gridSections} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-3 auto-rows-fr">
              {gridSections.map((id) => (
                <SortableSection
                  key={id}
                  id={id}
                  onClickCapture={(e) => {
                    if (isDraggingRef.current) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                >
                  {SECTIONS[id]}
                </SortableSection>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </main>
  );
}
