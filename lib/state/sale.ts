import { defineMachine } from "./machine";

/**
 * `sales.status`. No screen reads this yet. The machine is the contract for
 * a future sale screen: a sale is created `pending` by `mark_sold`, can be
 * exchanged, and ends settled or fallen through. Settled and fallen through
 * are terminal.
 */

export const SALE_STATUSES = ["pending", "exchanged", "settled", "fallen_through"] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

export const SALE_EVENTS = ["exchange", "settle", "fall_through"] as const;
export type SaleEvent = (typeof SALE_EVENTS)[number];

export const saleMachine = defineMachine({
  id: "sale",
  description: "Sale record created when a lot is marked sold. Not yet shown in the UI.",
  initial: "pending",
  states: SALE_STATUSES,
  events: SALE_EVENTS,
  transitions: {
    pending: { exchange: "exchanged", fall_through: "fallen_through" },
    exchanged: { settle: "settled", fall_through: "fallen_through" },
    settled: {},
    fallen_through: {},
  },
});

export function parseSaleStatus(value: unknown): SaleStatus | null {
  return saleMachine.parse(value);
}
