"use client"

import { useState } from "react"

export default function DeleteAccountSection() {
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")

  async function deleteAccount() {
    if (confirmation !== "DELETE") return

    setDeleting(true)
    setError("")

    try {
      const res = await fetch("/api/profile/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmation }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "Failed to delete account")
      }

      window.location.href = "/sign-in"
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account")
      setDeleting(false)
    }
  }

  return (
    <div className="bg-red-950/20 rounded-2xl border border-red-900/60 p-5">
      <p className="text-sm font-medium text-red-300">Danger Zone</p>
      <p className="text-sm text-neutral-400 mt-1">
        Permanently delete your FitForge account and all associated data.
      </p>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="mt-4 w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold transition-colors"
        >
          Delete Account
        </button>
      ) : (
        <div className="mt-4 space-y-3">
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
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="DELETE"
              className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => {
                setOpen(false)
                setConfirmation("")
                setError("")
              }}
              disabled={deleting}
              className="flex-1 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={deleteAccount}
              disabled={confirmation !== "DELETE" || deleting}
              className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:hover:bg-red-600 text-white font-semibold transition-colors"
            >
              {deleting ? "Deleting..." : "Permanently Delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}