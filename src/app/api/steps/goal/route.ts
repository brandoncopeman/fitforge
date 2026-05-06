import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

function toNumber(value: unknown, fallback = 8000) {
  const parsed = Number(value ?? fallback)
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function PATCH(req: Request) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const body = await req.json()

  const dailyStepTarget = Math.max(
    1,
    Math.round(toNumber(body.daily_step_target, 8000))
  )

  const rows = await sql`
    UPDATE profiles
    SET daily_step_target = ${dailyStepTarget}
    WHERE id = ${userId}
    RETURNING daily_step_target
  `

  if (!rows[0]) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    daily_step_target: Number(rows[0].daily_step_target ?? dailyStepTarget),
  })
}