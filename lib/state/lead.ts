import { completeTransitions, defineMachine } from "./machine";

/**
 * Leads are described by two columns that drifted apart:
 *
 * - `stage` is what the CRM screens write. The pipeline board uses title
 *   case ("Pack Sent"). The lead detail form uses a shorter list that adds
 *   Won and Lost. The daily cron and queue look for snake_case
 *   ("pack_sent"), so those jobs never saw board leads.
 * - `status` is a second pipeline (enquiry → settled) plus a legacy CRM
 *   vocabulary (new → closed) used by analytics and a few API routes.
 *
 * Reads go through `normalizeLeadStage` so both spellings mean the same
 * stage. Writes from the board still store the column label, so existing
 * rows are not rewritten just by being displayed.
 */

export const LEAD_STAGE_DEFS = [
  { id: "new", label: "New", aliases: ["new", "enquiry"] },
  { id: "contacted", label: "Contacted", aliases: ["contacted"] },
  { id: "qualified", label: "Qualified", aliases: ["qualified"] },
  { id: "pack_sent", label: "Pack Sent", aliases: ["pack_sent", "pack sent"] },
  { id: "contract_signed", label: "Contract Signed", aliases: ["contract", "contract_signed", "contract signed"] },
  { id: "settlement", label: "Settlement", aliases: ["settled", "settlement"] },
  { id: "won", label: "Won", aliases: ["won", "closed"] },
  { id: "lost", label: "Lost", aliases: ["lost"] },
] as const;

export type LeadStageId = (typeof LEAD_STAGE_DEFS)[number]["id"];

export const PIPELINE_COLUMNS = [
  "New",
  "Contacted",
  "Qualified",
  "Pack Sent",
  "Contract Signed",
  "Settlement",
] as const;

export type PipelineColumn = (typeof PIPELINE_COLUMNS)[number];

/** Recommended order. The board still allows a jump to any other column. */
export const leadPipelineMachine = defineMachine({
  id: "lead-pipeline",
  description:
    "CRM board columns. Dropping a card on any other column is legal; the stored stage becomes that column's label.",
  initial: "New",
  states: PIPELINE_COLUMNS,
  events: PIPELINE_COLUMNS,
  transitions: completeTransitions(PIPELINE_COLUMNS),
});

const STAGE_BY_KEY = new Map<string, LeadStageId>();
for (const stage of LEAD_STAGE_DEFS) {
  STAGE_BY_KEY.set(stage.id, stage.id);
  STAGE_BY_KEY.set(stage.label.toLowerCase(), stage.id);
  for (const alias of stage.aliases) STAGE_BY_KEY.set(alias.toLowerCase(), stage.id);
}

function fold(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

export function normalizeLeadStage(value: unknown): LeadStageId | null {
  if (typeof value !== "string") return null;
  const direct = STAGE_BY_KEY.get(value.trim().toLowerCase());
  if (direct) return direct;
  return STAGE_BY_KEY.get(fold(value)) ?? null;
}

export function leadStageLabel(value: unknown): string {
  const id = normalizeLeadStage(value);
  if (!id) return typeof value === "string" && value.trim() ? value.trim() : "New";
  return LEAD_STAGE_DEFS.find((stage) => stage.id === id)?.label ?? "New";
}

export function leadStageMatches(value: unknown, id: LeadStageId): boolean {
  return normalizeLeadStage(value) === id;
}

/** Column a stage belongs on. Empty stage is treated as New, matching the board. Won, Lost and unknown strings are off-board. */
export function pipelineColumnFor(value: unknown): PipelineColumn | null {
  if (value == null || (typeof value === "string" && value.trim() === "")) return "New";
  const id = normalizeLeadStage(value);
  if (!id) return null;
  const label = leadStageLabel(id);
  return (PIPELINE_COLUMNS as readonly string[]).includes(label) ? (label as PipelineColumn) : null;
}

export function isPipelineColumn(value: unknown): value is PipelineColumn {
  return typeof value === "string" && (PIPELINE_COLUMNS as readonly string[]).includes(value);
}

/** Stage labels offered on the lead detail form, including outcomes that are not board columns. */
export const LEAD_STAGE_OPTIONS: readonly string[] = LEAD_STAGE_DEFS.map((stage) => stage.label);

export const LEGACY_LEAD_STATUSES = ["new", "contacted", "assigned", "closed"] as const;
export type LegacyLeadStatus = (typeof LEGACY_LEAD_STATUSES)[number];

export const LEAD_STATUS_PIPELINE = [
  "enquiry",
  "qualified",
  "pack_sent",
  "contract",
  "settled",
] as const;
export type LeadStatusPipeline = (typeof LEAD_STATUS_PIPELINE)[number];

export type LeadStatusStamp = "pack_sent_date" | "contract_signed_date" | "settlement_date";

/** Timestamp columns `updateLeadStatus` fills. Unknown statuses update the status only. */
export function leadStatusStamps(status: unknown): LeadStatusStamp[] {
  if (status === "pack_sent") return ["pack_sent_date"];
  if (status === "contract") return ["contract_signed_date"];
  if (status === "settled") return ["settlement_date"];
  return [];
}

const STAGE_TO_BUCKET: Partial<Record<LeadStageId, LeadStatusPipeline>> = {
  new: "enquiry",
  qualified: "qualified",
  pack_sent: "pack_sent",
  contract_signed: "contract",
  settlement: "settled",
};

/**
 * Bucket for the metrics API. An explicit `status` wins. When status is
 * empty, a recognised `stage` is counted so board leads are not invisible.
 * Legacy statuses such as "assigned" are left uncounted.
 */
export function dashboardBucket(lead: {
  status?: string | null;
  stage?: string | null;
}): LeadStatusPipeline | null {
  const status = typeof lead.status === "string" ? lead.status.trim() : "";
  if ((LEAD_STATUS_PIPELINE as readonly string[]).includes(status)) {
    return status as LeadStatusPipeline;
  }
  if (status) return null;
  const stage = normalizeLeadStage(lead.stage);
  if (!stage) return null;
  return STAGE_TO_BUCKET[stage] ?? null;
}

export type DashboardBuckets = Record<LeadStatusPipeline, number>;

export function countDashboardBuckets(
  leads: ReadonlyArray<{ status?: string | null; stage?: string | null }>,
): DashboardBuckets {
  const counts: DashboardBuckets = {
    enquiry: 0,
    qualified: 0,
    pack_sent: 0,
    contract: 0,
    settled: 0,
  };
  for (const lead of leads) {
    const bucket = dashboardBucket(lead);
    if (bucket) counts[bucket] += 1;
  }
  return counts;
}

export function countLegacyLeadStatuses(
  leads: ReadonlyArray<{ status?: string | null }>,
): { name: LegacyLeadStatus; value: number }[] {
  return LEGACY_LEAD_STATUSES.map((status) => ({
    name: status,
    value: leads.filter((lead) => lead.status === status).length,
  }));
}
