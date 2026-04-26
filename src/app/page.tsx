import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">FitForge </h1>
          <UserButton  />
        </div>

        {/* Placeholder content */}
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
          <h2 className="text-xl font-semibold mb-2">Welcome to FitForge!</h2>
          <p className="text-neutral-400">
          You&apos;re logged in. More features coming soon — workouts, food tracking, and more.
          </p>
        </div>
      </div>
    </main>
  );
}