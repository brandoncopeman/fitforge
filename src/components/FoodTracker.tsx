"use client"

import { useState, useRef } from "react"
import Link from "next/link"

type FoodEntry = {
  id: string
  food_name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  meal_type: string
  serving_grams: number | null
}

type SearchResult = {
  name: string
  calories_100g: number
  protein_100g: number
  carbs_100g: number
  fat_100g: number
}

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const

export default function FoodTracker({
  initialEntries,
  calorieTarget,
  proteinTarget,
  today,
}: {
  initialEntries: FoodEntry[]
  calorieTarget: number
  proteinTarget: number
  today: string
}) {
  const [entries, setEntries] = useState<FoodEntry[]>(initialEntries)
  const [showAdd, setShowAdd] = useState(false)
  const [mealType, setMealType] = useState<typeof MEAL_TYPES[number]>("snack")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<SearchResult | null>(null)
  const [serving, setServing] = useState("100")
  const [manualMode, setManualMode] = useState(false)
  const [manual, setManual] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "" })
  const [saving, setSaving] = useState(false)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Totals
  const totalCalories = entries.reduce((sum, e) => sum + Number(e.calories), 0)
  const totalProtein = entries.reduce((sum, e) => sum + Number(e.protein_g), 0)
  const totalCarbs = entries.reduce((sum, e) => sum + Number(e.carbs_g), 0)
  const totalFat = entries.reduce((sum, e) => sum + Number(e.fat_g), 0)

  function handleSearch(value: string) {
    setSearchQuery(value)
    setSelected(null)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (value.length < 2) { setSearchResults([]); return }

    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/food-search?q=${encodeURIComponent(value)}`)
        const data = await res.json()
        setSearchResults(Array.isArray(data) ? data : [])
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 400)
  }

  function selectFood(food: SearchResult) {
    setSelected(food)
    setSearchQuery(food.name)
    setSearchResults([])
    setServing("100")
  }

  // Calculate macros based on serving size
  const servingNum = Number(serving) || 100
  const scaledCalories = selected ? Math.round(selected.calories_100g * servingNum / 100) : 0
  const scaledProtein = selected ? Math.round(selected.protein_100g * servingNum / 100) : 0
  const scaledCarbs = selected ? Math.round(selected.carbs_100g * servingNum / 100) : 0
  const scaledFat = selected ? Math.round(selected.fat_100g * servingNum / 100) : 0

  async function addEntry() {
    setSaving(true)
    try {
      const body = manualMode ? {
        food_name: manual.name,
        calories: Number(manual.calories),
        protein_g: Number(manual.protein) || 0,
        carbs_g: Number(manual.carbs) || 0,
        fat_g: Number(manual.fat) || 0,
        meal_type: mealType,
        log_date: today,
      } : {
        food_name: selected?.name || searchQuery,
        calories: scaledCalories,
        protein_g: scaledProtein,
        carbs_g: scaledCarbs,
        fat_g: scaledFat,
        serving_grams: servingNum,
        meal_type: mealType,
        log_date: today,
      }

      const res = await fetch("/api/food-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      setEntries(prev => [...prev, data])
      setShowAdd(false)
      setSelected(null)
      setSearchQuery("")
      setManual({ name: "", calories: "", protein: "", carbs: "", fat: "" })
    } finally {
      setSaving(false)
    }
  }

  async function deleteEntry(id: string) {
    await fetch(`/api/food-entries?id=${id}`, { method: "DELETE" })
    setEntries(prev => prev.filter(e => e.id !== id))
  }
  async function adjustEntry(id: string, delta: number) {
    const entry = entries.find(e => e.id === id)
    if (!entry) return
  
    if (delta === -1 && Number(entry.calories) <= 0) {
      deleteEntry(id)
      return
    }
  
    // Scale all macros by the same ratio
    const currentCalories = Number(entry.calories)
    
  
    // Simpler approach — just add or subtract one serving worth
    const servingCalories = entry.serving_grams
      ? (currentCalories / Number(entry.serving_grams)) * 100
      : currentCalories
  
    const newCalories = Math.max(0, currentCalories + (delta * servingCalories))
    const newProtein = Math.max(0, Number(entry.protein_g) + (delta * (Number(entry.protein_g) / (currentCalories || 1)) * servingCalories))
    const newCarbs = Math.max(0, Number(entry.carbs_g) + (delta * (Number(entry.carbs_g) / (currentCalories || 1)) * servingCalories))
    const newFat = Math.max(0, Number(entry.fat_g) + (delta * (Number(entry.fat_g) / (currentCalories || 1)) * servingCalories))
    const newServing = entry.serving_grams ? Math.max(0, Number(entry.serving_grams) + (delta * 100)) : null
  
    await fetch("/api/food-entries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        calories: Math.round(newCalories),
        protein_g: Math.round(newProtein),
        carbs_g: Math.round(newCarbs),
        fat_g: Math.round(newFat),
        serving_grams: newServing,
      }),
    })
  
    setEntries(prev => prev.map(e => e.id === id ? {
      ...e,
      calories: Math.round(newCalories),
      protein_g: Math.round(newProtein),
      carbs_g: Math.round(newCarbs),
      fat_g: Math.round(newFat),
      serving_grams: newServing,
    } : e))
  }
  const caloriePercent = Math.min(100, Math.round((totalCalories / calorieTarget) * 100))
  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6 pb-24">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <Link href="/" className="text-neutral-500 text-sm hover:text-neutral-300">← Home</Link>
          <h1 className="text-2xl font-bold mt-1">Food Tracker</h1>
          <p className="text-neutral-400 text-sm mt-0.5">{new Date(today + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
        </div>

        {/* Daily summary */}
        <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 mb-4">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-neutral-400 text-xs">Calories</p>
              <p className="text-3xl font-bold">
                <span className="text-teal-400">{Math.round(totalCalories)}</span>
                <span className="text-neutral-500 text-lg"> / {calorieTarget}</span>
              </p>
            </div>
            <p className="text-neutral-400 text-sm">{caloriePercent}%</p>
          </div>
          {/* Calorie progress bar */}
          <div className="w-full h-2 bg-neutral-800 rounded-full mb-4">
            <div
              className={`h-2 rounded-full transition-all ${caloriePercent >= 100 ? "bg-red-500" : "bg-teal-500"}`}
              style={{ width: `${caloriePercent}%` }}
            />
          </div>

          {/* Macros row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Protein", value: totalProtein, target: proteinTarget, color: "bg-blue-500" },
              { label: "Carbs", value: totalCarbs, target: null, color: "bg-yellow-500" },
              { label: "Fat", value: totalFat, target: null, color: "bg-orange-500" },
            ].map(({ label, value, target, color }) => (
              <div key={label}>
                <p className="text-xs text-neutral-500 mb-1">{label}</p>
                <p className="text-sm font-bold text-white">
                  {Math.round(value)}g
                  {target && <span className="text-neutral-500 font-normal"> / {target}g</span>}
                </p>
                <div className="w-full h-1.5 bg-neutral-800 rounded-full mt-1">
                  <div
                    className={`h-1.5 rounded-full ${color}`}
                    style={{ width: target ? `${Math.min(100, (value / target) * 100)}%` : "0%" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Meal sections */}
        {MEAL_TYPES.map(meal => {
          const mealEntries = entries.filter(e => e.meal_type === meal)
          const mealCalories = mealEntries.reduce((sum, e) => sum + Number(e.calories), 0)

          return (
            <div key={meal} className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold capitalize text-neutral-300">{meal}</h2>
                <span className="text-xs text-neutral-500">{Math.round(mealCalories)} kcal</span>
              </div>

              <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
                {mealEntries.length === 0 ? (
                  <p className="text-neutral-600 text-xs p-3">No entries</p>
                ) : (
                  mealEntries.map(entry => (
                    <div key={entry.id} className="flex items-center justify-between p-3 border-b border-neutral-800 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate capitalize">{entry.food_name}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {Math.round(Number(entry.calories))} kcal
                          {entry.serving_grams && ` · ${entry.serving_grams}g`}
                          {Number(entry.protein_g) > 0 && ` · ${Math.round(Number(entry.protein_g))}g protein`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                        <button
                          onClick={() => adjustEntry(entry.id, -1)}
                          className="w-7 h-7 rounded bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 text-sm flex items-center justify-center"
                        >−</button>
                        <button
                          onClick={() => adjustEntry(entry.id, 1)}
                          className="w-7 h-7 rounded bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 text-sm flex items-center justify-center"
                        >+</button>
                        <button
                          onClick={() => deleteEntry(entry.id)}
                          className="text-neutral-600 hover:text-red-400 text-xs ml-1 w-5 text-center"
                        >✕</button>
                      </div>
                    </div>
                  ))
                  )}
                  <button
                    onClick={() => { setShowAdd(true); setMealType(meal) }}
                    className="w-full p-3 text-left text-xs text-neutral-500 hover:text-teal-400 transition-colors border-t border-neutral-800"
                  >
                    + Add food
                  </button>
                  </div>
                  </div>
                          )
                        })}

        {/* Add food panel */}
        {showAdd && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-neutral-900 rounded-2xl border border-neutral-800 w-full max-w-md flex flex-col" style={{ maxHeight: "90vh" }}>

              {/* Header */}
              <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
                <h2 className="font-semibold capitalize">Add to {mealType}</h2>
                <button onClick={() => { setShowAdd(false); setSelected(null); setSearchQuery("") }} className="text-neutral-500 hover:text-white">✕</button>
              </div>

              <div className="overflow-y-auto flex-1 p-4 space-y-4">

                {/* Meal type selector */}
                <div className="flex gap-2">
                  {MEAL_TYPES.map(m => (
                    <button
                      key={m}
                      onClick={() => setMealType(m)}
                      className={`flex-1 py-1.5 rounded-lg text-xs capitalize transition-colors ${
                        mealType === m ? "bg-teal-600 text-white" : "bg-neutral-800 text-neutral-400"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                {/* Mode toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setManualMode(false)}
                    className={`flex-1 py-2 rounded-lg text-sm transition-colors ${!manualMode ? "bg-neutral-700 text-white" : "bg-neutral-800 text-neutral-400"}`}
                  >
                    Search Food
                  </button>
                  <button
                    onClick={() => setManualMode(true)}
                    className={`flex-1 py-2 rounded-lg text-sm transition-colors ${manualMode ? "bg-neutral-700 text-white" : "bg-neutral-800 text-neutral-400"}`}
                  >
                    Manual Entry
                  </button>
                </div>

                {!manualMode ? (
                  <>
                    {/* Search */}
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => handleSearch(e.target.value)}
                      placeholder="Search foods (e.g. chicken breast)"
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500"
                      autoFocus
                    />

                    {searching && <p className="text-neutral-500 text-sm text-center">Searching...</p>}

                    {searchResults.length > 0 && (
                      <div className="space-y-1">
                        {searchResults.map((food, i) => (
                          <button
                            key={i}
                            onClick={() => selectFood(food)}
                            className="w-full text-left p-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors"
                          >
                            <p className="text-sm font-medium capitalize">{food.name}</p>
                            <p className="text-xs text-neutral-400 mt-0.5">
                              {food.calories_100g} kcal · {food.protein_100g}g protein per 100g
                            </p>
                          </button>
                        ))}
                      </div>
                    )}

                    {selected && (
                      <div className="bg-neutral-800 rounded-xl p-4 space-y-3">
                        <p className="font-medium text-sm capitalize">{selected.name}</p>

                        <div>
                          <label className="text-xs text-neutral-400 mb-1 block">Serving size (grams)</label>
                          <input
                            type="number"
                            value={serving}
                            onChange={e => setServing(e.target.value)}
                            onFocus={e => e.target.select()}
                            className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
                          />
                        </div>

                        <div className="grid grid-cols-4 gap-2 text-center">
                          {[
                            { label: "Calories", value: scaledCalories },
                            { label: "Protein", value: `${scaledProtein}g` },
                            { label: "Carbs", value: `${scaledCarbs}g` },
                            { label: "Fat", value: `${scaledFat}g` },
                          ].map(({ label, value }) => (
                            <div key={label} className="bg-neutral-700 rounded-lg p-2">
                              <p className="text-xs text-neutral-400">{label}</p>
                              <p className="text-sm font-bold text-white">{value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* Manual entry */
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={manual.name}
                      onChange={e => setManual(p => ({ ...p, name: e.target.value }))}
                      placeholder="Food name"
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500"
                    />
                    <input
                      type="number"
                      value={manual.calories}
                      onChange={e => setManual(p => ({ ...p, calories: e.target.value }))}
                      placeholder="Calories"
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      {["protein", "carbs", "fat"].map(macro => (
                        <input
                          key={macro}
                          type="number"
                          value={manual[macro as keyof typeof manual]}
                          onChange={e => setManual(p => ({ ...p, [macro]: e.target.value }))}
                          placeholder={`${macro} (g)`}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Add button */}
              <div className="p-4 border-t border-neutral-800">
                <button
                  onClick={addEntry}
                  disabled={saving || (!manualMode && !selected && !searchQuery) || (manualMode && !manual.name)}
                  className="w-full py-3 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-medium rounded-xl transition-colors"
                >
                  {saving ? "Adding..." : "Add to Log"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}