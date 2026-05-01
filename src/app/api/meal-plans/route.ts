import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const plans = await sql`
    SELECT mp.*, 
      COUNT(mpe.id) as entry_count,
      COALESCE(SUM(mpe.calories), 0) as total_calories,
      COALESCE(SUM(mpe.protein_g), 0) as total_protein
    FROM meal_plans mp
    LEFT JOIN meal_plan_entries mpe ON mpe.meal_plan_id = mp.id
    WHERE mp.user_id = ${userId}
    GROUP BY mp.id
    ORDER BY mp.created_at DESC
  `
  return NextResponse.json(plans)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const { name } = await req.json()
  const rows = await sql`
    INSERT INTO meal_plans (user_id, name)
    VALUES (${userId}, ${name})
    RETURNING *
  `
  return NextResponse.json(rows[0])
}