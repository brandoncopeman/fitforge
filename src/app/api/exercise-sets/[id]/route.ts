import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const { reps, weight_kg } = body

  const rows = await sql`
    UPDATE exercise_sets SET
      reps = COALESCE(${reps}, reps),
      weight_kg = COALESCE(${weight_kg}, weight_kg)
    WHERE id = ${id}
    RETURNING *
  `
  return NextResponse.json(rows[0])
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  const { id } = await params

  await sql`DELETE FROM exercise_sets WHERE id = ${id}`
  return NextResponse.json({ success: true })
}