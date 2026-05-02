import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import sql from "@/lib/db"
import HomeClient from "@/components/HomeClient"

const QUOTES = [
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { text: "The pain you feel today will be the strength you feel tomorrow.", author: "Arnold Schwarzenegger" },
  { text: "Don't count the days, make the days count.", author: "Muhammad Ali" },
  { text: "The last three or four reps is what makes the muscle grow.", author: "Arnold Schwarzenegger" },
  { text: "You have to push past your perceived limits, push past that point you thought was as far as you can go.", author: "Drew Brees" },
  { text: "Once you learn to quit, it becomes a habit.", author: "Vince Lombardi" },
  { text: "If something stands between you and your success, move it. Never be denied.", author: "Dwayne Johnson" },
  { text: "The successful warrior is the average man, with laser-like focus.", author: "Bruce Lee" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "Your body can stand almost anything. It's your mind that you have to convince.", author: "Unknown" },
  { text: "Take care of your body. It's the only place you have to live.", author: "Jim Rohn" },
  { text: "What hurts today makes you stronger tomorrow.", author: "Jay Cutler" },
  { text: "To keep winning, I had to keep improving.", author: "Serena Williams" },
  { text: "I hated every minute of training, but I said, don't quit. Suffer now and live the rest of your life as a champion.", author: "Muhammad Ali" },
  { text: "The difference between the impossible and the possible lies in a person's determination.", author: "Tommy Lasorda" },
  { text: "Champions aren't made in gyms. Champions are made from something they have deep inside them.", author: "Muhammad Ali" },
  { text: "You miss 100% of the shots you don't take.", author: "Wayne Gretzky" },
  { text: "Strength does not come from the physical capacity. It comes from an indomitable will.", author: "Mahatma Gandhi" },
  { text: "It's not about having time, it's about making time.", author: "Unknown" },
  { text: "The only bad workout is the one that didn't happen.", author: "Unknown" },
  { text: "Discipline is doing what needs to be done, even when you don't want to.", author: "Unknown" },
  { text: "Push yourself because no one else is going to do it for you.", author: "Unknown" },
  { text: "Motivation is what gets you started. Habit is what keeps you going.", author: "Jim Ryun" },
  { text: "A champion is someone who gets up when they can't.", author: "Jack Dempsey" },
  { text: "The clock is ticking. Are you becoming the person you want to be?", author: "Greg Plitt" },
  { text: "Obsessed is a word the lazy use to describe the dedicated.", author: "Unknown" },
  { text: "Train insane or remain the same.", author: "Unknown" },
  { text: "No matter how slow you go, you are still lapping everybody on the couch.", author: "Unknown" },
  { text: "Success usually comes to those who are too busy to be looking for it.", author: "Henry David Thoreau" },
  { text: "Do something today that your future self will thank you for.", author: "Unknown" },
  { text: "The only place where success comes before work is in the dictionary.", author: "Vidal Sassoon" },
  { text: "If you want something you've never had, you must be willing to do something you've never done.", author: "Thomas Jefferson" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "You are what you do, not what you say you'll do.", author: "Carl Jung" },
  { text: "Today I will do what others won't, so tomorrow I can accomplish what others can't.", author: "Jerry Rice" },
  { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke" },
  { text: "Don't wish it were easier. Wish you were better.", author: "Jim Rohn" },
  { text: "If it doesn't challenge you, it doesn't change you.", author: "Fred DeVito" },
  { text: "Your biggest competition is the person you were yesterday.", author: "Unknown" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Well done is better than well said.", author: "Benjamin Franklin" },
  { text: "Energy and persistence conquer all things.", author: "Benjamin Franklin" },
  { text: "In training, you listen to your body. In competition, you tell your body to shut up.", author: "Rich Froning" },
  { text: "Most people give up right before the big break comes.", author: "Ross Perot" },
  { text: "What seems impossible today will one day become your warm up.", author: "Unknown" },
  { text: "The difference between try and triumph is a little umph.", author: "Marvin Phillips" },
  { text: "You are never too old to set another goal or to dream a new dream.", author: "C.S. Lewis" },
  { text: "Act as if what you do makes a difference. It does.", author: "William James" },
  { text: "Winning isn't everything, but wanting to win is.", author: "Vince Lombardi" },
]

export default async function HomePage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const [profileRows, planTemplates, schedule, todayCalories, todayStepsRows, latestWeightRows] = await Promise.all([
    sql`SELECT * FROM profiles WHERE id = ${userId}`,
    sql`SELECT * FROM workout_templates WHERE user_id = ${userId} AND in_plan = true ORDER BY plan_order ASC`,
    sql`
      SELECT gs.day_of_week, gs.template_id, wt.name as template_name
      FROM gym_schedule gs
      LEFT JOIN workout_templates wt ON gs.template_id = wt.id
      WHERE gs.user_id = ${userId}
    `,
    sql`SELECT COALESCE(SUM(calories), 0) as total FROM food_entries WHERE user_id = ${userId} AND log_date = CURRENT_DATE`,
    sql`SELECT steps FROM step_logs WHERE user_id = ${userId} AND log_date = CURRENT_DATE`,
    sql`SELECT weight_kg FROM weight_logs WHERE user_id = ${userId} ORDER BY log_date DESC LIMIT 1`,
  ])

  const profile = profileRows[0]
  if (!profile || !profile.weight_kg || !profile.goal) redirect("/onboarding")

  const lastPlanIndex = profile.last_plan_index ?? -1
  const nextPlanIndex = planTemplates.length > 0 ? (lastPlanIndex + 1) % planTemplates.length : -1
  const nextTemplate = nextPlanIndex >= 0 ? planTemplates[nextPlanIndex] : null
  const caloriesConsumed = Math.round(Number(todayCalories[0]?.total || 0))
  const todaySteps = Number(todayStepsRows[0]?.steps || 0)
  const latestWeight = latestWeightRows[0]?.weight_kg || null
  const today = new Date()
  const todayDow = today.getDay()

  // Daily quote — changes every day
  const dayOfYear = Math.floor((Date.now() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)
  const dailyQuote = QUOTES[dayOfYear % QUOTES.length]

  return (
    <HomeClient
      profile={{ ...profile, daily_quote: dailyQuote }}
      caloriesConsumed={caloriesConsumed}
      todaySteps={todaySteps}
      latestWeight={latestWeight}
      schedule={schedule}
            todayDow={todayDow}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nextTemplate={nextTemplate as any}
      sectionOrder={profile.home_section_order || ["calories", "protein", "steps", "schedule", "workouts", "stats", "goals", "next"]}    />
  )
}