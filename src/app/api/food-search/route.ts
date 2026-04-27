import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const query = searchParams.get("q")?.trim()
  if (!query || query.length < 2) return NextResponse.json([])

  try {
    const res = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=10&dataType=Foundation,SR%20Legacy&api_key=${process.env.USDA_API_KEY}`,
      { next: { revalidate: 3600 } }
    )
    const data = await res.json()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = (data.foods || []).slice(0, 10).map((food: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const getNutrient = (id: number) => food.foodNutrients?.find((n: any) => n.nutrientId === id)?.value || 0
      return {
        name: food.description.toLowerCase(),
        calories_100g: Math.round(getNutrient(1008)),
        protein_100g: Math.round(getNutrient(1003)),
        carbs_100g: Math.round(getNutrient(1005)),
        fat_100g: Math.round(getNutrient(1004)),
      }
    })

    return NextResponse.json(results)
  } catch {
    return NextResponse.json([])
  }
}