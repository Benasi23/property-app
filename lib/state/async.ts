/**
 * Async view and one-shot mutation lifecycles.
 *
 * These replace the usual cluster of booleans (isLoading + isError + data)
 * where loading and error can both be true. Each phase carries only the
 * fields that exist in that phase.
 */

export type AsyncPhase<T> =
  | { phase: "idle" }
  | { phase: "loading"; data?: T }
  | { phase: "ready"; data: T }
  | { phase: "error"; message: string; data?: T };

export type AsyncEvent<T> =
  | { type: "start" }
  | { type: "succeed"; data: T }
  | { type: "fail"; message: string }
  | { type: "reset" };

export function reduceAsync<T>(state: AsyncPhase<T>, event: AsyncEvent<T>): AsyncPhase<T> {
  switch (event.type) {
    case "reset":
      return { phase: "idle" };
    case "start":
      if (state.phase === "ready") return { phase: "loading", data: state.data };
      if (state.phase === "error") return { phase: "loading", data: state.data };
      if (state.phase === "loading") return state;
      return { phase: "loading" };
    case "succeed":
      // Ignore a success that arrives when nothing is in flight (stale response).
      if (state.phase !== "loading") return state;
      return { phase: "ready", data: event.data };
    case "fail":
      if (state.phase !== "loading") return state;
      return { phase: "error", message: event.message, data: state.data };
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

export function asyncData<T>(state: AsyncPhase<T>): T | undefined {
  if (state.phase === "idle") return undefined;
  return state.data;
}

export type MutationPhase =
  | { phase: "idle" }
  | { phase: "pending" }
  | { phase: "success" }
  | { phase: "error"; message: string };

export type MutationEvent =
  | { type: "start" }
  | { type: "succeed" }
  | { type: "fail"; message: string }
  | { type: "reset" };

export function reduceMutation(state: MutationPhase, event: MutationEvent): MutationPhase {
  switch (event.type) {
    case "reset":
      return { phase: "idle" };
    case "start":
      if (state.phase === "pending") return state;
      return { phase: "pending" };
    case "succeed":
      if (state.phase !== "pending") return state;
      return { phase: "success" };
    case "fail":
      if (state.phase !== "pending") return state;
      return { phase: "error", message: event.message };
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

/** Two-step confirmation: idle → armed → submitting. Cancel is ignored while submitting. */
export type ConfirmPhase = "idle" | "armed" | "submitting";

export type ConfirmEvent = "arm" | "cancel" | "submit" | "succeed" | "fail";

export function reduceConfirm(state: ConfirmPhase, event: ConfirmEvent): ConfirmPhase {
  switch (event) {
    case "arm":
      return state === "idle" ? "armed" : state;
    case "cancel":
      return state === "armed" ? "idle" : state;
    case "submit":
      return state === "armed" ? "submitting" : state;
    case "succeed":
      return "idle";
    case "fail":
      return state === "submitting" ? "armed" : state;
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

/**
 * Invite / recovery link: we do not know whether a session exists until the
 * client has read it. `missing` and `ready` are mutually exclusive.
 */
export type LinkSessionPhase = "checking" | "ready" | "missing";

export function linkSessionPhase(checked: boolean, hasSession: boolean): LinkSessionPhase {
  if (!checked) return "checking";
  return hasSession ? "ready" : "missing";
}
