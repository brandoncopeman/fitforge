"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const ALL_NAV_ITEMS = [
  {
    id: "home",
    href: "/",
    label: "Home",
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: "workouts",
    href: "/workouts",
    label: "Workouts",
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 4v16M18 4v16M4 8h4M16 8h4M4 16h4M16 16h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "quickstart",
    href: "/workouts/new",
    label: "Quick Start",
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    ),
  },
  {
    id: "food",
    href: "/food",
    label: "Food",
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1" strokeLinecap="round" />
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
        <line x1="6" y1="1" x2="6" y2="4" strokeLinecap="round" />
        <line x1="10" y1="1" x2="10" y2="4" strokeLinecap="round" />
        <line x1="14" y1="1" x2="14" y2="4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "stats",
    href: "/stats",
    label: "Stats",
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="20" x2="18" y2="10" strokeLinecap="round" />
        <line x1="12" y1="20" x2="12" y2="4" strokeLinecap="round" />
        <line x1="6" y1="20" x2="6" y2="14" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "macros",
    href: "/macros",
    label: "Macros",
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a10 10 0 0 1 0 20" />
        <path d="M12 12h8" />
      </svg>
    ),
  },
  {
    id: "steps",
    href: "/steps",
    label: "Steps",
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 4v6l3 3-3 3v4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11 20v-6l-3-3 3-3V4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "schedule",
    href: "/schedule",
    label: "Schedule",
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" />
        <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" />
        <line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "goals",
    href: "/goals",
    label: "Goals",
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
  },
  {
    id: "profile",
    href: "/profile",
    label: "Profile",
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
]

export default function BottomNavClient({
  navItems,
  nextTemplateId,
}: {
  navItems: string[]
  nextTemplateId: string | null
}) {  const pathname = usePathname()

  if (pathname === "/workouts/new") return null

  const homeItem = ALL_NAV_ITEMS.find(item => item.id === "home")!
  const profileItem = ALL_NAV_ITEMS.find(item => item.id === "profile")!

  const selectedItems = ALL_NAV_ITEMS.filter(item =>
    navItems.includes(item.id) &&
    item.id !== "home" &&
    item.id !== "profile"
  )

  const displayItems = [homeItem, ...selectedItems, profileItem].map(item => ({
    ...item,
    href: item.id === "quickstart" && nextTemplateId
      ? `/workouts/new?template=${nextTemplateId}`
      : item.href,
  }))
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-800 z-40">
      <div className="max-w-2xl mx-auto flex items-center justify-around px-2 py-2">
        {displayItems.map(({ id, href, label, icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href))
          return (
            <Link
              key={id}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
                active ? "text-teal-400" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {icon()}
              <span className="text-xs font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}