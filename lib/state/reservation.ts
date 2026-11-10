import { defineMachine } from "./machine";

/**
 * Reservation row status (`reservations.status`).
 *
 * Entry is either `active` (auto-approved hold, HQ action, or plain reserve)
 * or `pending` (a group asked for another hold inside the cooldown).
 * Approval and rejection are HQ-only. Release, expiry, conversion and
 * cancellation only apply to an active reservation.
 */

export const RESERVATION_STATUSES = [
  "pending",
  "active",
  "rejected",
  "expired",
  "released",
  "converted",
  "cancelled",
] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const RESERVATION_EVENTS = [
  "approve",
  "reject",
  "expire",
  "release",
  "convert",
  "cancel",
] as const;

export type ReservationEvent = (typeof RESERVATION_EVENTS)[number];

export const reservationMachine = defineMachine({
  id: "reservation",
  description: "Hold and reservation lifecycle, including HQ approval.",
  initial: "active",
  states: RESERVATION_STATUSES,
  events: RESERVATION_EVENTS,
  transitions: {
    pending: { approve: "active", reject: "rejected" },
    active: {
      expire: "expired",
      release: "released",
      convert: "converted",
      cancel: "cancelled",
    },
    rejected: {},
    expired: {},
    released: {},
    converted: {},
    cancelled: {},
  },
});

export const RESERVATION_STATUS_STYLE: Record<ReservationStatus, string> = {
  active: "bg-emerald-100 text-emerald-700",
  converted: "bg-blue-100 text-blue-700",
  released: "bg-slate-100 text-slate-500",
  expired: "bg-amber-100 text-amber-700",
  cancelled: "bg-slate-100 text-slate-500",
  pending: "bg-purple-100 text-purple-700",
  rejected: "bg-red-100 text-red-700",
};

export function parseReservationStatus(value: unknown): ReservationStatus | null {
  return reservationMachine.parse(value);
}

export function reservationStatusStyle(value: unknown): string {
  const parsed = parseReservationStatus(value);
  return parsed ? RESERVATION_STATUS_STYLE[parsed] : "bg-slate-100 text-slate-600";
}

export type ReservationActions = {
  release: boolean;
  /** HQ can approve or reject this row. */
  review: boolean;
  /** The row is waiting on HQ, whoever is looking at it. */
  awaitingApproval: boolean;
};

/** Which row actions the reservations screen should offer. */
export function reservationActions(status: unknown, isHq: boolean): ReservationActions {
  const parsed = parseReservationStatus(status);
  const awaitingApproval = parsed === "pending";
  return {
    release: parsed === "active",
    review: isHq && awaitingApproval && reservationMachine.can(parsed, "approve"),
    awaitingApproval,
  };
}

export const RESERVATION_TYPES = ["hold", "reservation"] as const;
export type ReservationType = (typeof RESERVATION_TYPES)[number];

export function parseReservationType(value: unknown): ReservationType | null {
  return value === "hold" || value === "reservation" ? value : null;
}

/**
 * Placing a reservation on an available lot moves the lot to `reserved`.
 * Placing a hold moves it to `hold`. This mirrors `reserve_property`.
 */
export function propertyStatusForReservationType(type: ReservationType): "hold" | "reserved" {
  return type === "reservation" ? "reserved" : "hold";
}
