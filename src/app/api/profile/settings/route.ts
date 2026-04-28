import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const { show_weight_on_home, goal_weight_kg } = await req.json()

  await sql`
    UPDATE profiles SET
      show_weight_on_home = COALESCE(${show_weight_on_home ?? null}, show_weight_on_home),
      goal_weight_kg = COALESCE(${goal_weight_kg ?? null}, goal_weight_kg)
    WHERE id = ${userId}
  `
  return NextResponse.json({ success: true })
}