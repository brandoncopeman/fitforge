import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

type Params = {
  params: Promise<{
    id: string
  }>
}

function cleanOptionalText(value: unknown) {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") return null

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function clampTargetDaysOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null

  return Math.min(7, Math.max(1, Math.round(parsed)))
}

export async function PATCH(req: Request, context: Params) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const { id } = await context.params
  const body = await req.json()

  const name = cleanOptionalText(body.name)
  const emoji = cleanOptionalText(body.emoji)
  const color = cleanOptionalText(body.color)
  const orderIndex = toNumberOrNull(body.order_index)
  const targetDaysPerWeek = clampTargetDaysOrNull(body.target_days_per_week)
  const active = typeof body.active === "boolean" ? body.active : null

  const rows = await sql`
    UPDATE goals SET
      name = COALESCE(${name}, name),
      emoji = COALESCE(${emoji}, emoji),
      color = COALESCE(${color}, color),
      order_index = COALESCE(${orderIndex}, order_index),
      target_days_per_week = COALESCE(${targetDaysPerWeek}, target_days_per_week),
      active = COALESCE(${active}, active)
    WHERE id = ${id}
      AND user_id = ${userId}
    RETURNING *
  `

  if (!rows[0]) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 })
  }

  return NextResponse.json(rows[0])
}

export async function DELETE(_req: Request, context: Params) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  const { id } = await context.params

  const rows = await sql`
    UPDATE goals
    SET active = false
    WHERE id = ${id}
      AND user_id = ${userId}
    RETURNING *
  `

  if (!rows[0]) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}