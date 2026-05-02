"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useClerk } from "@clerk/nextjs"
import Link from "next/link"

type Profile = {
  display_name: string
  weight_kg: number
  height_cm: number
  age: number
  sex: string
  activity_level: string
  goal: string
  daily_calorie_target: number
  daily_protein_target: number
  daily_step_target: number
  weekly_workout_target: number
  nav_items: string[]
}

const ALL_NAV_OPTIONS = [
  { id: "workouts", label: "Workouts" },
  { id: "quickstart", label: "Quick Start" },
  { id: "food", label: "Food" },
  { id: "stats", label: "Stats" },
  { id: "macros", label: "Macros" },
  { id: "steps", label: "Steps" },
  { id: "schedule", label: "Schedule" },
  { id: "goals", label: "Goals" },
]

export default function ProfileClient({
  profile,
  email,
  firstName,
  lastName,
}: {
  profile: Profile
  email: string
  firstName: string
  lastName: string
}) {
  const router = useRouter()
  const { signOut } = useClerk()
  const [displayName, setDisplayName] = useState(profile.display_name || `${firstName} ${lastName}`.trim())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [navItems, setNavItems] = useState<string[]>(
    (profile.nav_items || ["workouts", "quickstart", "food"])
      .filter((id: string) => id !== "home" && id !== "profile")
  )
  const [savingNav, setSavingNav] = useState(false)
  const [navSaved, setNavSaved] = useState(false)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  async function saveName() {
    setSaving(true)
    await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...profile, display_name: displayName }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function toggleNavItem(id: string) {
    setNavItems(prev => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev
        return prev.filter(i => i !== id)
      } else {
        if (prev.length >= 3) return prev
        return [...prev, id]
      }
    })
  }

  async function saveNav() {
    setSavingNav(true)
    await fetch("/api/profile/nav", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nav_items: navItems }),
    })
    setSavingNav(false)
    setNavSaved(true)
    setTimeout(() => setNavSaved(false), 2000)
    router.refresh()
  }

  async function handleSignOut() {
    await signOut()
    router.push("/sign-in")
  }

  async function deleteAccount() {
    if (deleteConfirmation !== "DELETE") return

    setDeletingAccount(true)
    setDeleteError("")

    try {
      const res = await fetch("/api/profile/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmation: deleteConfirmation }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "Failed to delete account")
      }

      await signOut()
      router.push("/sign-in")
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Failed to delete account")
      setDeletingAccount(false)
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6 pb-24">
      <div className="max-w-2xl mx-auto">

        <div className="mb-6">
          <h1 className="text-2xl font-bold">Profile</h1>
        </div>

        {/* Avatar + name */}
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-5 mb-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-teal-600 flex items-center justify-center text-2xl font-bold flex-shrink-0">
              {(displayName || email)[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-lg">{displayName || email}</p>
              <p className="text-neutral-400 text-sm">{email}</p>
            </div>
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1 block">Display Name</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
              />
              <button
                onClick={saveName}
                disabled={saving}
                className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm"
              >
                {saved ? "Saved!" : saving ? "..." : "Save"}
              </button>
            </div>
          </div>
        </div>

        {/* Customize nav */}
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-5 mb-4">
          <p className="text-sm font-medium mb-1">Customize Navigation</p>
          <p className="text-xs text-neutral-500 mb-4">
            Choose 3 items. Home and Profile are always shown.
          </p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {ALL_NAV_OPTIONS.map(option => {
              const isSelected = navItems.includes(option.id)
              const isDisabled = !isSelected && navItems.length >= 3
              return (
                <button
                  key={option.id}
                  onClick={() => toggleNavItem(option.id)}
                  disabled={isDisabled}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-colors ${
                    isSelected
                      ? "bg-teal-600/20 border-teal-500 text-white"
                      : isDisabled
                      ? "bg-neutral-800/50 border-neutral-800 text-neutral-600 cursor-not-allowed"
                      : "bg-neutral-800 border-neutral-700 text-neutral-300 hover:border-neutral-600"
                  }`}
                >
                  <span>{option.label}</span>
                  {isSelected && <span className="text-teal-400 text-xs">✓</span>}
                </button>
              )
            })}
          </div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-neutral-500">{navItems.length}/3 selected</p>
          </div>
          <button
            onClick={saveNav}
            disabled={savingNav}
            className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {navSaved ? "Saved!" : savingNav ? "Saving..." : "Save Navigation"}
          </button>
        </div>

        {/* Stats summary */}
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-5 mb-4">
          <p className="text-sm font-medium mb-3">Your Stats</p>
          <div className="space-y-0">
            {[
              { label: "Weight", value: `${profile.weight_kg}kg` },
              { label: "Height", value: `${profile.height_cm}cm` },
              { label: "Age", value: profile.age },
              { label: "Sex", value: profile.sex },
              { label: "Goal", value: profile.goal === "cut" ? "Lose Weight" : profile.goal === "bulk" ? "Build Muscle" : "Maintain" },
              { label: "Activity", value: profile.activity_level },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between py-2.5 border-b border-neutral-800 last:border-0">
                <span className="text-neutral-500 text-sm">{label}</span>
                <span className="capitalize text-sm font-medium">{value}</span>
              </div>
            ))}
          </div>
          <Link href="/macros" className="mt-3 block text-center text-teal-400 hover:text-teal-300 text-sm">
            Recalibrate targets →
          </Link>
        </div>

        {/* Daily goals */}
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-5 mb-4">
          <p className="text-sm font-medium mb-3">Daily Goals</p>
          <div className="space-y-0">
            {[
              { label: "Calories", value: `${profile.daily_calorie_target} kcal` },
              { label: "Protein", value: `${profile.daily_protein_target}g` },
              { label: "Steps", value: profile.daily_step_target?.toLocaleString() },
              { label: "Workouts/week", value: profile.weekly_workout_target },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between py-2.5 border-b border-neutral-800 last:border-0">
                <span className="text-neutral-500 text-sm">{label}</span>
                <span className="text-sm font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Account */}
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-5 mb-4">
          <p className="text-sm font-medium mb-3">Account</p>
          <div className="flex justify-between py-2.5 text-sm">
            <span className="text-neutral-500">Email</span>
            <span className="text-neutral-300">{email}</span>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="w-full py-3 border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-600 rounded-xl text-sm transition-colors mb-3"
        >
          Sign Out
        </button>

        {/* Danger zone */}
        <div className="bg-red-950/20 border border-red-900/30 rounded-2xl p-4">
          <p className="text-sm font-medium text-red-400 mb-1">Danger Zone</p>
          <p className="text-xs text-neutral-500 mb-3">
            Permanently delete your account and all data. This cannot be undone.
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-red-500 hover:text-red-400 text-sm border border-red-900 px-4 py-2 rounded-lg transition-colors"
            >
              Delete Account
            </button>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl bg-neutral-950 border border-red-900/70 p-4">
                <p className="text-sm font-semibold text-red-300 mb-2">
                  This cannot be undone.
                </p>
                <p className="text-sm text-neutral-400">
                  This will permanently delete your profile, workouts, templates,
                  food logs, weight logs, step logs, goals, progress stories, badges,
                  and account access.
                </p>
              </div>

              <div>
                <label className="text-xs text-neutral-500 block mb-1">
                  Type DELETE to confirm
                </label>
                <input
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="DELETE"
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-500"
                />
              </div>

              {deleteError && (
                <p className="text-sm text-red-400">
                  {deleteError}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setDeleteConfirmation("")
                    setDeleteError("")
                  }}
                  disabled={deletingAccount}
                  className="flex-1 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium transition-colors"
                >
                  Cancel
                </button>

                <button
                  onClick={deleteAccount}
                  disabled={deleteConfirmation !== "DELETE" || deletingAccount}
                  className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:hover:bg-red-600 text-white font-semibold transition-colors"
                >
                  {deletingAccount ? "Deleting..." : "Permanently Delete"}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </main>
  )
}