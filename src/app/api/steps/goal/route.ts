import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const { daily_step_target } = await req.json()

  await sql`
    UPDATE profiles SET daily_step_target = ${daily_step_target}
    WHERE id = ${userId}
  `
  return NextResponse.json({ success: true })
}