import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  const { id } = await params
  const { name, emoji, color, order_index, active } = await req.json()

  await sql`
    UPDATE goals SET
      name = COALESCE(${name ?? null}, name),
      emoji = COALESCE(${emoji ?? null}, emoji),
      color = COALESCE(${color ?? null}, color),
      order_index = COALESCE(${order_index ?? null}, order_index),
      active = COALESCE(${active ?? null}, active)
    WHERE id = ${id} AND user_id = ${userId}
  `
  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  const { id } = await params

  await sql`UPDATE goals SET active = false WHERE id = ${id} AND user_id = ${userId}`
  return NextResponse.json({ success: true })
}