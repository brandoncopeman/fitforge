import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import sql from "@/lib/db"

const FALLBACK_EXERCISES = [
  // Chest
  { id: "f1", name: "barbell bench press", bodyPart: "chest", target: "pectorals" },
  { id: "f2", name: "dumbbell bench press", bodyPart: "chest", target: "pectorals" },
  { id: "f3", name: "incline barbell bench press", bodyPart: "chest", target: "pectorals" },
  { id: "f4", name: "incline dumbbell bench press", bodyPart: "chest", target: "pectorals" },
  { id: "f5", name: "decline bench press", bodyPart: "chest", target: "pectorals" },
  { id: "f6", name: "dumbbell fly", bodyPart: "chest", target: "pectorals" },
  { id: "f7", name: "cable fly", bodyPart: "chest", target: "pectorals" },
  { id: "f8", name: "push up", bodyPart: "chest", target: "pectorals" },
  { id: "f9", name: "chest dip", bodyPart: "chest", target: "pectorals" },
  { id: "f10", name: "pec deck", bodyPart: "chest", target: "pectorals" },
  { id: "f11", name: "cable crossover", bodyPart: "chest", target: "pectorals" },
  { id: "f12", name: "smith machine bench press", bodyPart: "chest", target: "pectorals" },
  // Back
  { id: "f13", name: "deadlift", bodyPart: "back", target: "lats" },
  { id: "f14", name: "barbell row", bodyPart: "back", target: "lats" },
  { id: "f15", name: "dumbbell row", bodyPart: "back", target: "lats" },
  { id: "f16", name: "pull up", bodyPart: "back", target: "lats" },
  { id: "f17", name: "chin up", bodyPart: "back", target: "lats" },
  { id: "f18", name: "lat pulldown", bodyPart: "back", target: "lats" },
  { id: "f19", name: "cable row", bodyPart: "back", target: "lats" },
  { id: "f20", name: "t-bar row", bodyPart: "back", target: "lats" },
  { id: "f21", name: "face pull", bodyPart: "back", target: "rear delts" },
  { id: "f22", name: "hyperextension", bodyPart: "back", target: "lower back" },
  { id: "f23", name: "good morning", bodyPart: "back", target: "lower back" },
  { id: "f24", name: "cable pulldown", bodyPart: "back", target: "lats" },
  { id: "f25", name: "meadows row", bodyPart: "back", target: "lats" },
  { id: "f26", name: "rack pull", bodyPart: "back", target: "lats" },
  { id: "f27", name: "pendlay row", bodyPart: "back", target: "lats" },
  // Shoulder
  { id: "f28", name: "overhead press", bodyPart: "shoulder", target: "delts" },
  { id: "f29", name: "dumbbell shoulder press", bodyPart: "shoulder", target: "delts" },
  { id: "f30", name: "lateral raise", bodyPart: "shoulder", target: "delts" },
  { id: "f31", name: "front raise", bodyPart: "shoulder", target: "delts" },
  { id: "f32", name: "arnold press", bodyPart: "shoulder", target: "delts" },
  { id: "f33", name: "upright row", bodyPart: "shoulder", target: "delts" },
  { id: "f34", name: "cable lateral raise", bodyPart: "shoulder", target: "delts" },
  { id: "f35", name: "reverse fly", bodyPart: "shoulder", target: "rear delts" },
  { id: "f36", name: "smith machine shoulder press", bodyPart: "shoulder", target: "delts" },
  { id: "f37", name: "plate front raise", bodyPart: "shoulder", target: "delts" },
  // Upper arm (bicep/tricep)
  { id: "f38", name: "barbell curl", bodyPart: "upper arm", target: "biceps" },
  { id: "f39", name: "dumbbell curl", bodyPart: "upper arm", target: "biceps" },
  { id: "f40", name: "hammer curl", bodyPart: "upper arm", target: "biceps" },
  { id: "f41", name: "preacher curl", bodyPart: "upper arm", target: "biceps" },
  { id: "f42", name: "concentration curl", bodyPart: "upper arm", target: "biceps" },
  { id: "f43", name: "cable curl", bodyPart: "upper arm", target: "biceps" },
  { id: "f44", name: "incline dumbbell curl", bodyPart: "upper arm", target: "biceps" },
  { id: "f45", name: "tricep pushdown", bodyPart: "upper arm", target: "triceps" },
  { id: "f46", name: "skull crusher", bodyPart: "upper arm", target: "triceps" },
  { id: "f47", name: "tricep dip", bodyPart: "upper arm", target: "triceps" },
  { id: "f48", name: "overhead tricep extension", bodyPart: "upper arm", target: "triceps" },
  { id: "f49", name: "close grip bench press", bodyPart: "upper arm", target: "triceps" },
  { id: "f50", name: "cable overhead tricep extension", bodyPart: "upper arm", target: "triceps" },
  { id: "f51", name: "diamond push up", bodyPart: "upper arm", target: "triceps" },
  // Upper leg (quad/hamstring/glute)
  { id: "f52", name: "squat", bodyPart: "upper leg", target: "quads" },
  { id: "f53", name: "barbell squat", bodyPart: "upper leg", target: "quads" },
  { id: "f54", name: "front squat", bodyPart: "upper leg", target: "quads" },
  { id: "f55", name: "leg press", bodyPart: "upper leg", target: "quads" },
  { id: "f56", name: "leg extension", bodyPart: "upper leg", target: "quads" },
  { id: "f57", name: "leg curl", bodyPart: "upper leg", target: "hamstrings" },
  { id: "f58", name: "romanian deadlift", bodyPart: "upper leg", target: "hamstrings" },
  { id: "f59", name: "stiff leg deadlift", bodyPart: "upper leg", target: "hamstrings" },
  { id: "f60", name: "lunge", bodyPart: "upper leg", target: "quads" },
  { id: "f61", name: "walking lunge", bodyPart: "upper leg", target: "quads" },
  { id: "f62", name: "bulgarian split squat", bodyPart: "upper leg", target: "quads" },
  { id: "f63", name: "hip thrust", bodyPart: "upper leg", target: "glutes" },
  { id: "f64", name: "glute bridge", bodyPart: "upper leg", target: "glutes" },
  { id: "f65", name: "sumo deadlift", bodyPart: "upper leg", target: "glutes" },
  { id: "f66", name: "hack squat", bodyPart: "upper leg", target: "quads" },
  { id: "f67", name: "goblet squat", bodyPart: "upper leg", target: "quads" },
  { id: "f68", name: "step up", bodyPart: "upper leg", target: "quads" },
  // Lower leg
  { id: "f69", name: "calf raise", bodyPart: "lower leg", target: "calves" },
  { id: "f70", name: "seated calf raise", bodyPart: "lower leg", target: "calves" },
  { id: "f71", name: "standing calf raise", bodyPart: "lower leg", target: "calves" },
  { id: "f72", name: "donkey calf raise", bodyPart: "lower leg", target: "calves" },
  { id: "f73", name: "tibialis raise", bodyPart: "lower leg", target: "tibialis" },
  // Lower arm
  { id: "f74", name: "wrist curl", bodyPart: "lower arm", target: "forearms" },
  { id: "f75", name: "reverse wrist curl", bodyPart: "lower arm", target: "forearms" },
  { id: "f76", name: "reverse curl", bodyPart: "lower arm", target: "forearms" },
  { id: "f77", name: "farmer carry", bodyPart: "lower arm", target: "forearms" },
  { id: "f78", name: "wrist roller", bodyPart: "lower arm", target: "forearms" },
  // Waist / core
  { id: "f79", name: "crunch", bodyPart: "waist", target: "abs" },
  { id: "f80", name: "sit up", bodyPart: "waist", target: "abs" },
  { id: "f81", name: "plank", bodyPart: "waist", target: "abs" },
  { id: "f82", name: "ab wheel rollout", bodyPart: "waist", target: "abs" },
  { id: "f83", name: "cable crunch", bodyPart: "waist", target: "abs" },
  { id: "f84", name: "hanging leg raise", bodyPart: "waist", target: "abs" },
  { id: "f85", name: "leg raise", bodyPart: "waist", target: "abs" },
  { id: "f86", name: "russian twist", bodyPart: "waist", target: "obliques" },
  { id: "f87", name: "side plank", bodyPart: "waist", target: "obliques" },
  { id: "f88", name: "bicycle crunch", bodyPart: "waist", target: "abs" },
  { id: "f89", name: "wood chop", bodyPart: "waist", target: "obliques" },
  { id: "f90", name: "dragon flag", bodyPart: "waist", target: "abs" },
  // Neck
  { id: "f91", name: "neck curl", bodyPart: "neck", target: "neck" },
  { id: "f92", name: "neck extension", bodyPart: "neck", target: "neck" },
  { id: "f93", name: "neck lateral flexion", bodyPart: "neck", target: "neck" },
  // Cardio
  { id: "f94", name: "treadmill run", bodyPart: "cardio", target: "cardio" },
  { id: "f95", name: "cycling", bodyPart: "cardio", target: "cardio" },
  { id: "f96", name: "rowing machine", bodyPart: "cardio", target: "cardio" },
  { id: "f97", name: "jump rope", bodyPart: "cardio", target: "cardio" },
  { id: "f98", name: "stair climber", bodyPart: "cardio", target: "cardio" },
  { id: "f99", name: "elliptical", bodyPart: "cardio", target: "cardio" },
  { id: "f100", name: "burpee", bodyPart: "cardio", target: "cardio" },
  { id: "f101", name: "battle rope", bodyPart: "cardio", target: "cardio" },
  { id: "f102", name: "box jump", bodyPart: "cardio", target: "cardio" },
  { id: "f103", name: "sled push", bodyPart: "cardio", target: "cardio" },
  // Smith machine
  { id: "f104", name: "smith machine squat", bodyPart: "upper leg", target: "quads" },
  { id: "f105", name: "smith machine row", bodyPart: "back", target: "lats" },
  { id: "f106", name: "smith machine hip thrust", bodyPart: "upper leg", target: "glutes" },
  // Cable
  { id: "f107", name: "cable kickback", bodyPart: "upper leg", target: "glutes" },
  { id: "f108", name: "cable pull through", bodyPart: "upper leg", target: "glutes" },
  { id: "f109", name: "cable crunch", bodyPart: "waist", target: "abs" },
  { id: "f110", name: "cable chest fly", bodyPart: "chest", target: "pectorals" },
]

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const query = searchParams.get("q")?.trim().toLowerCase()

  if (!query || query.length < 2) return NextResponse.json([])

  // First search DB (seeded exercises from RapidAPI)
  const dbResults = await sql`
    SELECT id, name, body_part as "bodyPart", target
    FROM exercises
    WHERE name ILIKE ${"%" + query + "%"}
       OR body_part ILIKE ${"%" + query + "%"}
       OR target ILIKE ${"%" + query + "%"}
    ORDER BY
      CASE WHEN name ILIKE ${query + "%"} THEN 0 ELSE 1 END,
      name ASC
    LIMIT 15
  `

  // Then search fallback list
  const fallbackResults = FALLBACK_EXERCISES.filter(ex =>
    ex.name.includes(query) ||
    ex.bodyPart.includes(query) ||
    ex.target.includes(query)
  )

  // Merge, deduplicate by name
  const dbNames = new Set((dbResults as {name: string}[]).map(r => r.name.toLowerCase()))
  const merged = [
    ...dbResults,
    ...fallbackResults
      .filter(f => !dbNames.has(f.name.toLowerCase()))
      .map(f => ({ id: f.id, name: f.name, bodyPart: f.bodyPart, target: f.target }))
  ]

  return NextResponse.json(merged.slice(0, 15))
}