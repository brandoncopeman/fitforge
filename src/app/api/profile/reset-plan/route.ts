import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

export async function POST() {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 })
  }

  await sql`
    UPDATE profiles
    SET last_plan_index = -1
    WHERE id = ${userId}
  `

  return NextResponse.json({ success: true })
}