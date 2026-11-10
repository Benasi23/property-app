/**
 * Minimal explicit state machine.
 *
 * States are a string union. Each state lists the events it accepts and the
 * state those events lead to. Anything absent from the table is illegal, so
 * callers cannot invent a transition by setting a boolean.
 */

export type TransitionResult<S extends string> =
  | { ok: true; from: S; event: string; state: S }
  | { ok: false; from: S; event: string; state: S; reason: "illegal" };

export type Machine<S extends string, E extends string> = {
  id: string;
  description: string;
  initial: S;
  states: readonly S[];
  events: readonly E[];
  transitions: { readonly [K in S]: Partial<Record<E, S>> };
  isState: (value: unknown) => value is S;
  parse: (value: unknown) => S | null;
  can: (state: S, event: E) => boolean;
  transition: (state: S, event: E) => TransitionResult<S>;
  eventsFrom: (state: S) => E[];
  successors: (state: S) => S[];
};

export function defineMachine<S extends string, E extends string>(config: {
  id: string;
  description: string;
  initial: S;
  states: readonly S[];
  events: readonly E[];
  transitions: { readonly [K in S]: Partial<Record<E, S>> };
}): Machine<S, E> {
  const known = new Set<string>(config.states);
  if (!known.has(config.initial)) {
    throw new Error(`${config.id}: initial state "${config.initial}" is not in states`);
  }

  const eventSet = new Set<string>(config.events);
  for (const state of config.states) {
    const row = config.transitions[state];
    if (!row) throw new Error(`${config.id}: missing transition row for "${state}"`);
    for (const [event, target] of Object.entries(row) as [E, S][]) {
      if (!eventSet.has(event)) {
        throw new Error(`${config.id}: event "${event}" from "${state}" is not declared`);
      }
      if (!known.has(target)) {
        throw new Error(`${config.id}: "${state}" + "${event}" targets unknown state "${target}"`);
      }
    }
  }

  const isState = (value: unknown): value is S =>
    typeof value === "string" && known.has(value);

  return {
    id: config.id,
    description: config.description,
    initial: config.initial,
    states: config.states,
    events: config.events,
    transitions: config.transitions,
    isState,
    parse: (value) => (isState(value) ? value : null),
    can: (state, event) => config.transitions[state][event] !== undefined,
    transition: (state, event) => {
      const next = config.transitions[state][event];
      if (next === undefined) {
        return { ok: false, from: state, event, state, reason: "illegal" };
      }
      return { ok: true, from: state, event, state: next };
    },
    eventsFrom: (state) => config.events.filter((event) => config.transitions[state][event] !== undefined),
    successors: (state) => {
      const seen = new Set<S>();
      for (const event of config.events) {
        const next = config.transitions[state][event];
        if (next !== undefined) seen.add(next);
      }
      return [...seen];
    },
  };
}

/** Every state can move to every other state. The event name is the target state. */
export function completeTransitions<S extends string>(
  states: readonly S[],
): { [K in S]: Partial<Record<S, S>> } {
  const table = {} as { [K in S]: Partial<Record<S, S>> };
  for (const from of states) {
    const row: Partial<Record<S, S>> = {};
    for (const to of states) {
      if (from !== to) row[to] = to;
    }
    table[from] = row;
  }
  return table;
}

/** Markdown table of the legal edges. Useful for docs and for agents reading a trace. */
export function formatTransitionTable<S extends string, E extends string>(
  machine: Machine<S, E>,
): string {
  const lines = ["| From | Event | To |", "| --- | --- | --- |"];
  for (const state of machine.states) {
    const row = machine.transitions[state];
    const events = (Object.keys(row) as E[]).filter((event) => row[event] !== undefined);
    if (events.length === 0) {
      lines.push(`| ${state} | — | terminal |`);
      continue;
    }
    for (const event of events) {
      lines.push(`| ${state} | ${event} | ${row[event]} |`);
    }
  }
  return lines.join("\n");
}
