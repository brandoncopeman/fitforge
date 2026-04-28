import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import sql from "@/lib/db"
import ProfileClient from "@/components/ProfileClient"

export default async function ProfilePage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const user = await currentUser()
  const profile = await sql`SELECT * FROM profiles WHERE id = ${userId}`

  return (
    <ProfileClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      profile={profile[0] as any}
      email={user?.emailAddresses[0]?.emailAddress || ""}
      firstName={user?.firstName || ""}
      lastName={user?.lastName || ""}
    />
  )
}