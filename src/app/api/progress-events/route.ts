import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import {
  getRecentProgressEvents,
  getUnseenProgressEvents,
  markProgressEventsSeen,
} from "@/lib/progress-events"
import { generateWeeklyRecap } from "@/lib/progress-storytelling"

export async function GET(req: Request) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const unseenOnly = searchParams.get("unseen") === "true"
  const withWeeklyRecap = searchParams.get("weekly") === "true"
  const limit = Number(searchParams.get("limit") ?? 5)

  if (withWeeklyRecap) {
    await generateWeeklyRecap(userId).catch(console.error)
  }

  const events = unseenOnly
    ? await getUnseenProgressEvents(userId, limit)
    : await getRecentProgressEvents(userId, limit)

  return NextResponse.json({ events })
}

export async function PATCH(req: Request) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const eventIds = Array.isArray(body.eventIds) ? body.eventIds : []

  await markProgressEventsSeen(userId, eventIds)

  return NextResponse.json({ success: true })
}