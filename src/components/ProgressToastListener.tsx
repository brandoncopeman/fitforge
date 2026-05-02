"use client"

import { useEffect } from "react"
import { toast } from "sonner"
import confetti from "canvas-confetti"

type ProgressEvent = {
  id: string
  event_type: string
  title: string
  message: string
  emoji: string | null
  severity: string | null
}

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

          toast.success("🏆 Badge unlocked", {
            description: badge.message,
            duration: 6000,
          })

          confetti({
            particleCount: 100,
            spread: 80,
            origin: { y: 0.2 },
          })
        }

        if (badgeEvents.length > 1) {
          toast.success(`🏆 ${badgeEvents.length} badges unlocked`, {
            description: "Go check your badge collection.",
            duration: 7000,
          })

          confetti({
            particleCount: 140,
            spread: 90,
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

  return null
}