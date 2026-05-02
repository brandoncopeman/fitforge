import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const goals = await sql`
    SELECT * FROM goals
    WHERE user_id = ${userId} AND active = true
    ORDER BY order_index ASC
  `
  return NextResponse.json(goals)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const { name, emoji, color } = await req.json()

  const count = await sql`SELECT COUNT(*) FROM goals WHERE user_id = ${userId} AND active = true`
  const order = Number(count[0].count)

  const rows = await sql`
    INSERT INTO goals (user_id, name, emoji, color, order_index)
    VALUES (${userId}, ${name}, ${emoji || '🎯'}, ${color || 'teal'}, ${order})
    RETURNING *
  `
  return NextResponse.json(rows[0])
}