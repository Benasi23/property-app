import { leadStageMatches } from "./lead";

/**
 * How stale a lead feels, from the age of the latest activity timestamp.
 * Thresholds match the stale-deals route: 4 days warm, 8 stale, 15 critical.
 * A missing timestamp is `unknown`. The daily cron uses 999 instead of null
 * when the timestamp is missing; pass that sentinel in `whenMissing`.
 */

export type Freshness = "unknown" | "fresh" | "warm" | "stale" | "critical";

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysBetween(fromMs: number, nowMs: number): number {
  return Math.floor((nowMs - fromMs) / DAY_MS);
}

/**
 * Age in days of the first usable timestamp. `whenMissing` is returned when
 * every value is empty. An unparseable timestamp returns NaN so callers that
 * compare with `>=` keep the old "does not match" behaviour.
 */
export function activityAgeDays(
  dates: ReadonlyArray<string | null | undefined>,
  nowMs: number,
  whenMissing: number | null,
): number | null {
  const iso = dates.find((value) => typeof value === "string" && value.trim() !== "");
  if (!iso) return whenMissing;
  const parsed = new Date(iso).getTime();
  if (Number.isNaN(parsed)) return Number.NaN;
  return daysBetween(parsed, nowMs);
}

export function freshnessFromDays(days: number | null): Freshness {
  if (days === null) return "unknown";
  if (days >= 15) return "critical";
  if (days >= 8) return "stale";
  if (days >= 4) return "warm";
  return "fresh";
}

export function queueInactivityPoints(daysSince: number): number {
  if (!Number.isFinite(daysSince)) return 0;
  if (daysSince >= 15) return 100;
  if (daysSince >= 8) return 60;
  if (daysSince >= 4) return 30;
  return 0;
}

/** Pack-sent and qualified match either spelling ("Pack Sent" or "pack_sent"). */
export function queueStagePoints(stage: unknown): number {
  if (leadStageMatches(stage, "pack_sent")) return 40;
  if (leadStageMatches(stage, "qualified")) return 20;
  return 0;
}

export function suggestedQueueAction(stage: unknown): string {
  if (leadStageMatches(stage, "pack_sent")) return "Follow up pack";
  if (leadStageMatches(stage, "qualified")) return "Call & convert";
  return "Check status";
}

export type ReminderKind = "follow_up" | "call" | "urgent";

export type ReminderDraft = {
  lead_id: string;
  type: ReminderKind;
  message: string;
};

/**
 * Reminder rules from the daily cron. Stage matching accepts the board's
 * title-case labels and the snake_case strings the cron used to require.
 */
export function reminderDraftsForLead(
  lead: { id: string; name?: string | null; stage?: string | null },
  daysSince: number,
): ReminderDraft[] {
  const drafts: ReminderDraft[] = [];
  const name = lead.name ?? "";
  if (leadStageMatches(lead.stage, "pack_sent") && daysSince >= 2) {
    drafts.push({ lead_id: lead.id, type: "follow_up", message: `Follow up pack: ${name}` });
  }
  if (leadStageMatches(lead.stage, "qualified") && daysSince >= 1) {
    drafts.push({ lead_id: lead.id, type: "call", message: `Call qualified lead: ${name}` });
  }
  if (daysSince >= 8) {
    drafts.push({ lead_id: lead.id, type: "urgent", message: `Stale deal: ${name}` });
  }
  return drafts;
}
