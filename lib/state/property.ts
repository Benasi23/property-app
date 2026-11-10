import { completeTransitions, defineMachine } from "./machine";

/**
 * Lot status stored on `properties.status`.
 *
 * The stock board speaks a friendlier language than the database:
 * `hold` is shown as "Reserved", and `reserved` is "Expression of Interest".
 * `withdrawn` is a real stored status but has no board column, so lots in
 * that status (or any unrecognised string) fall off the board unless a
 * caller asks for them.
 *
 * The database setter (`set_property_status`) accepts every status from
 * every other status. The board does not: `resolveStockMove` is the
 * transition function the UI actually runs, and it picks the RPC that
 * matches today's behaviour.
 */

export const PROPERTY_STATUSES = [
  "available",
  "hold",
  "reserved",
  "under_contract",
  "finance_approved",
  "sold",
  "withdrawn",
] as const;

export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

/** Left-to-right order of the selling pipeline. Not a guard — jumps are allowed. */
export const PROPERTY_PIPELINE_ORDER = [
  "available",
  "hold",
  "reserved",
  "under_contract",
  "finance_approved",
  "sold",
] as const satisfies readonly PropertyStatus[];

export const PROPERTY_STATUS_LABEL: Record<PropertyStatus, string> = {
  available: "Available",
  hold: "Reserved",
  reserved: "Expression of Interest",
  under_contract: "Under Contract",
  finance_approved: "Finance Approved",
  sold: "Sold",
  withdrawn: "Withdrawn",
};

export const PROPERTY_STATUS_STYLE: Record<PropertyStatus, string> = {
  available: "bg-emerald-100 text-emerald-700",
  hold: "bg-amber-100 text-amber-700",
  reserved: "bg-orange-100 text-orange-700",
  under_contract: "bg-blue-100 text-blue-700",
  finance_approved: "bg-teal-100 text-teal-700",
  sold: "bg-slate-200 text-slate-700",
  withdrawn: "bg-slate-100 text-slate-500",
};

export const STOCK_COLUMNS: {
  key: (typeof PROPERTY_PIPELINE_ORDER)[number];
  label: string;
  dot: string;
  head: string;
}[] = [
  { key: "available", label: "Available", dot: "bg-emerald-500", head: "text-emerald-700" },
  { key: "hold", label: "Reserved", dot: "bg-amber-500", head: "text-amber-700" },
  { key: "reserved", label: "Expression of Interest", dot: "bg-orange-500", head: "text-orange-700" },
  { key: "under_contract", label: "Under Contract", dot: "bg-blue-500", head: "text-blue-700" },
  { key: "finance_approved", label: "Finance Approved", dot: "bg-teal-500", head: "text-teal-700" },
  { key: "sold", label: "Sold", dot: "bg-slate-500", head: "text-slate-700" },
];

/** Statuses that still represent an open deal (shown on the dashboard "in progress" list). */
export const IN_PROGRESS_STATUSES = [
  "hold",
  "reserved",
  "under_contract",
  "finance_approved",
] as const satisfies readonly PropertyStatus[];

/**
 * Statuses released back to available when HQ deletes a selling group.
 * Sold and withdrawn lots are left alone. Finance-approved was previously
 * omitted, so those lots stayed attached to a deleted group.
 */
export const RELEASE_ON_GROUP_DELETE = [
  "hold",
  "reserved",
  "under_contract",
  "finance_approved",
] as const satisfies readonly PropertyStatus[];

/**
 * `mark_sold` in the repo schema only updates rows currently in these
 * statuses. Other statuses need a follow-up `set_property_status('sold')`
 * or the toast says "sold" while the lot stays put.
 */
export const MARK_SOLD_DIRECT = ["available", "hold", "reserved"] as const satisfies readonly PropertyStatus[];

export const propertyStatusMachine = defineMachine({
  id: "property-status",
  description:
    "Stored lot status. The SQL setter allows every status from every other status. The board uses resolveStockMove to choose an RPC.",
  initial: "available",
  states: PROPERTY_STATUSES,
  events: PROPERTY_STATUSES,
  transitions: completeTransitions(PROPERTY_STATUSES),
});

export function parsePropertyStatus(value: unknown): PropertyStatus | null {
  return propertyStatusMachine.parse(value);
}

export function propertyStatusLabel(value: unknown): string {
  const parsed = parsePropertyStatus(value);
  if (parsed) return PROPERTY_STATUS_LABEL[parsed];
  return typeof value === "string" && value.trim() ? value.trim() : "Unknown";
}

export function propertyStatusStyle(value: unknown): string {
  const parsed = parsePropertyStatus(value);
  return parsed ? PROPERTY_STATUS_STYLE[parsed] : "bg-slate-100 text-slate-600";
}

export function isStockBoardStatus(value: unknown): value is (typeof PROPERTY_PIPELINE_ORDER)[number] {
  return typeof value === "string" && (PROPERTY_PIPELINE_ORDER as readonly string[]).includes(value);
}

export function isInProgressStatus(value: unknown): value is (typeof IN_PROGRESS_STATUSES)[number] {
  return typeof value === "string" && (IN_PROGRESS_STATUSES as readonly string[]).includes(value);
}

/**
 * A hold is stored as status `hold`. Whether HQ still has to approve it is
 * not a column: a null `hold_expires_at` means the countdown has not started.
 */
export type PropertyLifecycle =
  | { status: "available" }
  | { status: "hold"; approval: "pending" }
  | { status: "hold"; approval: "active"; expiresAt: string }
  | { status: "reserved" }
  | { status: "under_contract" }
  | { status: "finance_approved" }
  | { status: "sold" }
  | { status: "withdrawn" }
  | { status: "unknown"; raw: string };

export function describeProperty(
  status: unknown,
  holdExpiresAt?: string | null,
): PropertyLifecycle {
  const parsed = parsePropertyStatus(status);
  if (parsed === "hold") {
    if (holdExpiresAt) return { status: "hold", approval: "active", expiresAt: holdExpiresAt };
    return { status: "hold", approval: "pending" };
  }
  if (parsed) return { status: parsed };
  return { status: "unknown", raw: typeof status === "string" ? status : "" };
}

export type StockMove =
  | { type: "noop" }
  | { type: "unsupported" }
  | { type: "release" }
  | { type: "mark_sold"; alsoSetSold: boolean }
  | { type: "request_hold" }
  | { type: "set_hold" }
  | { type: "request_reservation" }
  | { type: "under_contract"; claimFirst: boolean }
  | { type: "finance_approved" };

/**
 * Command the stock board should run to move a lot from `from` to `to`.
 * Same RPC choices as the previous if/else chain, plus a follow-up status
 * write when `mark_sold` cannot itself update the row.
 */
export function resolveStockMove(from: string, to: string): StockMove {
  if (from === to) return { type: "noop" };
  switch (to) {
    case "available":
      return { type: "release" };
    case "sold":
      return {
        type: "mark_sold",
        alsoSetSold: !(MARK_SOLD_DIRECT as readonly string[]).includes(from),
      };
    case "hold":
      return from === "available" ? { type: "request_hold" } : { type: "set_hold" };
    case "reserved":
      return { type: "request_reservation" };
    case "under_contract":
      return { type: "under_contract", claimFirst: from === "available" };
    case "finance_approved":
      return { type: "finance_approved" };
    default:
      return { type: "unsupported" };
  }
}

export type PropertyTally = {
  total: number;
  available: number;
  hold: number;
  reserved: number;
  under_contract: number;
  finance_approved: number;
  sold: number;
  withdrawn: number;
  unknown: number;
  availValue: number;
  soldValue: number;
};

export function tallyPropertyStatuses(
  rows: ReadonlyArray<{ status: string; price?: number | null }>,
): PropertyTally {
  const tally: PropertyTally = {
    total: rows.length,
    available: 0,
    hold: 0,
    reserved: 0,
    under_contract: 0,
    finance_approved: 0,
    sold: 0,
    withdrawn: 0,
    unknown: 0,
    availValue: 0,
    soldValue: 0,
  };
  for (const row of rows) {
    const price = Number(row.price || 0);
    switch (parsePropertyStatus(row.status)) {
      case "available":
        tally.available += 1;
        tally.availValue += price;
        break;
      case "hold":
        tally.hold += 1;
        break;
      case "reserved":
        tally.reserved += 1;
        break;
      case "under_contract":
        tally.under_contract += 1;
        break;
      case "finance_approved":
        tally.finance_approved += 1;
        break;
      case "sold":
        tally.sold += 1;
        tally.soldValue += price;
        break;
      case "withdrawn":
        tally.withdrawn += 1;
        break;
      default:
        tally.unknown += 1;
    }
  }
  return tally;
}

export type GroupStockTally = {
  hold: number;
  reserved: number;
  under_contract: number;
  finance_approved: number;
  sold: number;
  soldValue: number;
};

export function emptyGroupStockTally(): GroupStockTally {
  return { hold: 0, reserved: 0, under_contract: 0, finance_approved: 0, sold: 0, soldValue: 0 };
}

export function addToGroupStockTally(tally: GroupStockTally, status: string, price?: number | null) {
  switch (parsePropertyStatus(status)) {
    case "hold":
      tally.hold += 1;
      break;
    case "reserved":
      tally.reserved += 1;
      break;
    case "under_contract":
      tally.under_contract += 1;
      break;
    case "finance_approved":
      tally.finance_approved += 1;
      break;
    case "sold":
      tally.sold += 1;
      tally.soldValue += Number(price || 0);
      break;
    default:
      break;
  }
}
