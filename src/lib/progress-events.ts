import sql from "@/lib/db"

export type ProgressEventInput = {
  userId: string
  eventType: string
  title: string
  message: string
  emoji?: string
  severity?: "positive" | "neutral" | "warning"
  source?: string | null
  sourceId?: string | null
  metadata?: Record<string, unknown>
  dedupeKey?: string | null
}

export async function createProgressEvent(input: ProgressEventInput) {
  const {
    userId,
    eventType,
    title,
    message,
    emoji = "✨",
    severity = "positive",
    source = null,
    sourceId = null,
    metadata = {},
    dedupeKey = null,
  } = input

  const rows = await sql`
    INSERT INTO progress_events (
      user_id,
      event_type,
      title,
      message,
      emoji,
      severity,
      source,
      source_id,
      metadata,
      dedupe_key
    )
    VALUES (
      ${userId},
      ${eventType},
      ${title},
      ${message},
      ${emoji},
      ${severity},
      ${source},
      ${sourceId},
      ${JSON.stringify(metadata)}::jsonb,
      ${dedupeKey}
    )
    ON CONFLICT (user_id, dedupe_key)
    WHERE dedupe_key IS NOT NULL
    DO NOTHING
    RETURNING *
  `

  return rows[0] ?? null
}

export async function getRecentProgressEvents(userId: string, limit = 5) {
  return sql`
    SELECT *
    FROM progress_events
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `
}

export async function getUnseenProgressEvents(userId: string, limit = 5) {
  return sql`
    SELECT *
    FROM progress_events
    WHERE user_id = ${userId}
      AND seen = false
    ORDER BY created_at DESC
    LIMIT ${limit}
  `
}

export async function markProgressEventsSeen(userId: string, eventIds: string[]) {
  if (eventIds.length === 0) return []

  return sql`
    UPDATE progress_events
    SET seen = true
    WHERE user_id = ${userId}
      AND id = ANY(${eventIds})
    RETURNING id
  `
}