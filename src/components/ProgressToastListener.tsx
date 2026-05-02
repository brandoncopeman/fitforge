"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import confetti from "canvas-confetti"
import Link from "next/link"

type ProgressEvent = {
  id: string
  event_type: string
  title: string
  message: string
  emoji: string | null
  severity: string | null
  metadata?: {
    badgeKey?: string
    badgeTitle?: string
    badgeEmoji?: string
  } | null
}

type BadgeModalState = {
  count: number
  title: string
  emoji: string
} | null

const MAJOR_EVENT_TYPES = new Set([
  "workout_volume_increase",
  "weight_trend_cut",
  "weight_trend_bulk",
  "step_goal_hit",
  "goal_completed",
  "badge_unlocked",
  "weekly_recap",
])

export default function ProgressToastListener() {
  const [badgeModal, setBadgeModal] = useState<BadgeModalState>(null)

  useEffect(() => {
    let cancelled = false
    let checkedWeekly = false

    async function checkProgressEvents() {
      try {
        const url = checkedWeekly
          ? "/api/progress-events?unseen=true&limit=8"
          : "/api/progress-events?unseen=true&limit=8&weekly=true"

        checkedWeekly = true

        const res = await fetch(url)
        if (!res.ok) return

        const data = await res.json()
        const events: ProgressEvent[] = data.events ?? []

        if (cancelled || events.length === 0) return

        const badgeEvents = events.filter((event) => event.event_type === "badge_unlocked")
        const nonBadgeEvents = events.filter((event) => event.event_type !== "badge_unlocked")

        for (const event of nonBadgeEvents.reverse()) {
          toast.success(`${event.emoji ?? "✨"} ${event.title}`, {
            description: event.message,
            duration: event.event_type === "weekly_recap" ? 8000 : 5000,
          })

          if (MAJOR_EVENT_TYPES.has(event.event_type)) {
            confetti({
              particleCount: event.event_type === "weekly_recap" ? 120 : 80,
              spread: 70,
              origin: { y: 0.2 },
            })
          }
        }

        if (badgeEvents.length === 1) {
          const badge = badgeEvents[0]
          const badgeTitle = badge.metadata?.badgeTitle ?? badge.message.replace(/^.*?\s/, "")
          const badgeEmoji = badge.metadata?.badgeEmoji ?? "🏆"

          toast.success("🏆 Badge unlocked", {
            description: badge.message,
            duration: 6000,
          })

          setBadgeModal({
            count: 1,
            title: badgeTitle,
            emoji: badgeEmoji,
          })

          confetti({
            particleCount: 120,
            spread: 90,
            origin: { y: 0.2 },
          })
        }

        if (badgeEvents.length > 1) {
          toast.success(`🏆 ${badgeEvents.length} badges unlocked`, {
            description: "Go check your badge collection.",
            duration: 7000,
          })

          setBadgeModal({
            count: badgeEvents.length,
            title: `${badgeEvents.length} badges unlocked`,
            emoji: "🏆",
          })

          confetti({
            particleCount: 160,
            spread: 100,
            origin: { y: 0.2 },
          })
        }

        await fetch("/api/progress-events", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            eventIds: events.map((event) => event.id),
          }),
        })
      } catch (error) {
        console.error(error)
      }
    }

    checkProgressEvents()

    const timeout = window.setTimeout(checkProgressEvents, 1500)
    const interval = window.setInterval(checkProgressEvents, 5000)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      window.clearInterval(interval)
    }
  }, [])

  return (
    <>
      {badgeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-5">
          <div className="w-full max-w-sm rounded-3xl border border-teal-700/70 bg-neutral-950 p-6 text-center shadow-2xl shadow-teal-950/50">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl border border-teal-700/60 bg-teal-500/10 text-5xl">
              {badgeModal.emoji}
            </div>

            <p className="text-xs font-medium uppercase tracking-wide text-teal-300">
              Badge Unlocked
            </p>

            <h2 className="mt-2 text-2xl font-bold text-white">
              {badgeModal.title}
            </h2>

            <p className="mt-2 text-sm text-neutral-400">
              {badgeModal.count > 1
                ? "You earned multiple badges. Go check your collection."
                : "Nice work. Your badge collection is growing."}
            </p>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setBadgeModal(null)}
                className="flex-1 rounded-xl bg-neutral-800 py-3 text-sm font-medium text-neutral-300 hover:bg-neutral-700"
              >
                Close
              </button>

              <Link
                href="/stats?tab=badges"
                onClick={() => setBadgeModal(null)}
                className="flex-1 rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white hover:bg-teal-500"
              >
                View Badges
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}