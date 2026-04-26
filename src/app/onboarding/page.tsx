"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

// The shape of all the form data
type FormData = {
  display_name: string
  age: string
  sex: string
  weight_kg: string
  height_cm: string
  activity_level: string
  goal: string
}

// Each step of the wizard
const STEPS = ["About You", "Your Body", "Activity", "Your Goal"]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [form, setForm] = useState<FormData>({
    display_name: "",
    age: "",
    sex: "",
    weight_kg: "",
    height_cm: "",
    activity_level: "",
    goal: "",
  })

  // Update a single field in the form
  function update(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // Go to next step
  function next() {
    setError("")
    if (!validateStep()) return
    setStep((s) => s + 1)
  }

  // Go to previous step
  function back() {
    setError("")
    setStep((s) => s - 1)
  }

  // Validate the current step before allowing next
  function validateStep(): boolean {
    if (step === 0) {
      if (!form.display_name.trim()) { setError("Please enter your name"); return false }
      if (!form.age || Number(form.age) < 10 || Number(form.age) > 100) { setError("Please enter a valid age"); return false }
      if (!form.sex) { setError("Please select a sex"); return false }
    }
    if (step === 1) {
      if (!form.weight_kg || Number(form.weight_kg) < 20) { setError("Please enter a valid weight"); return false }
      if (!form.height_cm || Number(form.height_cm) < 50) { setError("Please enter a valid height"); return false }
    }
    if (step === 2) {
      if (!form.activity_level) { setError("Please select an activity level"); return false }
    }
    if (step === 3) {
      if (!form.goal) { setError("Please select a goal"); return false }
    }
    return true
  }

  // Submit the form on the last step
  async function submit() {
    if (!validateStep()) return
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: form.display_name,
          age: Number(form.age),
          sex: form.sex,
          weight_kg: Number(form.weight_kg),
          height_cm: Number(form.height_cm),
          activity_level: form.activity_level,
          goal: form.goal,
        }),
      })

      if (!res.ok) throw new Error("Failed to save profile")

      const data = await res.json()
      
      // Save targets to show on success (optional nice touch)
      console.log(`Targets set: ${data.daily_calories} kcal, ${data.daily_protein}g protein`)

      // Go to home page
      router.push("/")
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <h1 className="text-3xl font-bold text-center mb-2">FitForge</h1>
        <p className="text-neutral-400 text-center mb-8">Let&apos;s set up your profile</p>

        {/* Step indicator */}
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((label, i) => (
            <div key={i} className="flex flex-col items-center flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-1 
                ${i < step ? "bg-teal-600 text-white" : 
                  i === step ? "bg-teal-500 text-white" : 
                  "bg-neutral-800 text-neutral-500"}`}>
                {i < step ? "✓" : i + 1}
              </div>
              <span className={`text-xs hidden sm:block ${i === step ? "text-teal-400" : "text-neutral-500"}`}>
                {label}
              </span>
              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-full mt-4 ${i < step ? "bg-teal-600" : "bg-neutral-800"}`} 
                  style={{ position: "absolute", left: 0, display: "none" }} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">

          {/* Step 0 — About You */}
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">About You</h2>

              <div>
                <label className="block text-sm text-neutral-400 mb-1">What should we call you?</label>
                <input
                  type="text"
                  placeholder="Your name"
                  value={form.display_name}
                  onChange={(e) => update("display_name", e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-400 mb-1">Age</label>
                <input
                  type="number"
                  placeholder="e.g. 25"
                  value={form.age}
                  onChange={(e) => update("age", e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-400 mb-2">Sex</label>
                <div className="grid grid-cols-3 gap-2">
                  {["male", "female", "other"].map((option) => (
                    <button
                      key={option}
                      onClick={() => update("sex", option)}
                      className={`py-2.5 rounded-lg border capitalize text-sm font-medium transition-colors
                        ${form.sex === option 
                          ? "bg-teal-600 border-teal-500 text-white" 
                          : "bg-neutral-800 border-neutral-700 text-neutral-300 hover:border-neutral-600"}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 1 — Your Body */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Your Body</h2>

              <div>
                <label className="block text-sm text-neutral-400 mb-1">Weight (kg)</label>
                <input
                  type="number"
                  placeholder="e.g. 75"
                  value={form.weight_kg}
                  onChange={(e) => update("weight_kg", e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-teal-500"
                />
                <p className="text-xs text-neutral-500 mt-1">To convert lbs → kg: divide by 2.2</p>
              </div>

              <div>
                <label className="block text-sm text-neutral-400 mb-1">Height (cm)</label>
                <input
                  type="number"
                  placeholder="e.g. 178"
                  value={form.height_cm}
                  onChange={(e) => update("height_cm", e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-teal-500"
                />
                <p className="text-xs text-neutral-500 mt-1">To convert inches → cm: multiply by 2.54</p>
              </div>
            </div>
          )}

          {/* Step 2 — Activity Level */}
          {step === 2 && (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold mb-4">Activity Level</h2>
              <p className="text-neutral-400 text-sm mb-4">How active are you on a typical week?</p>

              {[
                { value: "sedentary", label: "Sedentary", desc: "Desk job, little or no exercise" },
                { value: "light", label: "Lightly Active", desc: "Light exercise 1–3 days/week" },
                { value: "moderate", label: "Moderately Active", desc: "Moderate exercise 3–5 days/week" },
                { value: "active", label: "Very Active", desc: "Hard exercise 6–7 days/week" },
                { value: "very_active", label: "Extremely Active", desc: "Hard daily exercise + physical job" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => update("activity_level", option.value)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors
                    ${form.activity_level === option.value
                      ? "bg-teal-600/20 border-teal-500 text-white"
                      : "bg-neutral-800 border-neutral-700 text-neutral-300 hover:border-neutral-600"}`}
                >
                  <div className="font-medium text-sm">{option.label}</div>
                  <div className="text-xs text-neutral-400 mt-0.5">{option.desc}</div>
                </button>
              ))}
            </div>
          )}

          {/* Step 3 — Goal */}
          {step === 3 && (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold mb-4">Your Goal</h2>
              <p className="text-neutral-400 text-sm mb-4">What are you working towards?</p>

              {[
                { value: "cut", label: "Lose Weight", desc: "Eat 500 calories below your target (−0.5kg/week)" },
                { value: "maintain", label: "Stay the Same", desc: "Eat at your maintenance calories" },
                { value: "bulk", label: "Build Muscle", desc: "Eat 300 calories above your target" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => update("goal", option.value)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors
                    ${form.goal === option.value
                      ? "bg-teal-600/20 border-teal-500 text-white"
                      : "bg-neutral-800 border-neutral-700 text-neutral-300 hover:border-neutral-600"}`}
                >
                  <div className="font-medium text-sm">{option.label}</div>
                  <div className="text-xs text-neutral-400 mt-0.5">{option.desc}</div>
                </button>
              ))}
            </div>
          )}

          {/* Error message */}
          {error && (
            <p className="text-red-400 text-sm mt-4">{error}</p>
          )}

          {/* Navigation buttons */}
          <div className="flex gap-3 mt-6">
            {step > 0 && (
              <button
                onClick={back}
                className="flex-1 py-2.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800 transition-colors"
              >
                Back
              </button>
            )}

            {step < STEPS.length - 1 ? (
              <button
                onClick={next}
                className="flex-1 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={loading}
                className="flex-1 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium transition-colors disabled:opacity-50"
              >
                {loading ? "Saving..." : "Let's Go!"}
              </button>
            )}
          </div>
        </div>

        {/* Step count text */}
        <p className="text-center text-neutral-500 text-sm mt-4">
          Step {step + 1} of {STEPS.length}
        </p>
      </div>
    </main>
  )
}