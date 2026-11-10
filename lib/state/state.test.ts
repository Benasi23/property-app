import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activityAgeDays,
  countDashboardBuckets,
  dashboardBucket,
  deriveAuthPhase,
  describeProperty,
  documentDestinationError,
  formatTransitionTable,
  freshnessFromDays,
  isPipelineColumn,
  isStockBoardStatus,
  leadPipelineMachine,
  leadStageMatches,
  leadStatusStamps,
  linkSessionPhase,
  normalizeLeadStage,
  pipelineColumnFor,
  propertyStatusForReservationType,
  queueInactivityPoints,
  queueStagePoints,
  reduceAsync,
  reduceConfirm,
  reduceMutation,
  reminderDraftsForLead,
  reservationActions,
  reservationMachine,
  resolveStockMove,
  saleMachine,
  suggestedQueueAction,
  tallyPropertyStatuses,
} from "./index";

describe("defineMachine", () => {
  it("allows only declared reservation edges", () => {
    assert.equal(reservationMachine.transition("pending", "approve").state, "active");
    assert.equal(reservationMachine.can("pending", "release"), false);
    const illegal = reservationMachine.transition("active", "approve");
    assert.equal(illegal.ok, false);
    if (!illegal.ok) assert.equal(illegal.state, "active");
    assert.equal(reservationMachine.can("rejected", "approve"), false);
    assert.deepEqual(reservationMachine.successors("rejected"), []);
  });

  it("treats sale settled and fallen through as terminal", () => {
    assert.equal(saleMachine.transition("pending", "exchange").state, "exchanged");
    assert.equal(saleMachine.transition("exchanged", "settle").state, "settled");
    assert.equal(saleMachine.can("settled", "fall_through"), false);
    assert.equal(saleMachine.can("pending", "settle"), false);
    assert.match(formatTransitionTable(saleMachine), /pending \| exchange \| exchanged/);
  });

  it("lets a lead jump columns, because the board does", () => {
    const jump = leadPipelineMachine.transition("New", "Settlement");
    assert.equal(jump.ok, true);
    if (jump.ok) assert.equal(jump.state, "Settlement");
    assert.equal(leadPipelineMachine.can("New", "New"), false);
  });
});

describe("property stock moves", () => {
  it("picks the same RPC the board used to pick", () => {
    assert.deepEqual(resolveStockMove("available", "available"), { type: "noop" });
    assert.deepEqual(resolveStockMove("hold", "available"), { type: "release" });
    assert.deepEqual(resolveStockMove("available", "hold"), { type: "request_hold" });
    assert.deepEqual(resolveStockMove("reserved", "hold"), { type: "set_hold" });
    assert.deepEqual(resolveStockMove("hold", "reserved"), { type: "request_reservation" });
    assert.deepEqual(resolveStockMove("available", "under_contract"), {
      type: "under_contract",
      claimFirst: true,
    });
    assert.deepEqual(resolveStockMove("hold", "under_contract"), {
      type: "under_contract",
      claimFirst: false,
    });
    assert.deepEqual(resolveStockMove("under_contract", "finance_approved"), { type: "finance_approved" });
    assert.deepEqual(resolveStockMove("available", "sold"), { type: "mark_sold", alsoSetSold: false });
    assert.deepEqual(resolveStockMove("hold", "sold"), { type: "mark_sold", alsoSetSold: false });
    assert.deepEqual(resolveStockMove("reserved", "sold"), { type: "mark_sold", alsoSetSold: false });
  });

  it("follows mark_sold with a status write when the SQL update would match nothing", () => {
    assert.deepEqual(resolveStockMove("under_contract", "sold"), { type: "mark_sold", alsoSetSold: true });
    assert.deepEqual(resolveStockMove("finance_approved", "sold"), { type: "mark_sold", alsoSetSold: true });
    assert.deepEqual(resolveStockMove("withdrawn", "sold"), { type: "mark_sold", alsoSetSold: true });
  });

  it("refuses a destination that is not a board column", () => {
    assert.deepEqual(resolveStockMove("available", "withdrawn"), { type: "unsupported" });
    assert.deepEqual(resolveStockMove("available", "nope"), { type: "unsupported" });
  });

  it("splits a hold into pending approval versus an active countdown", () => {
    assert.deepEqual(describeProperty("hold", null), { status: "hold", approval: "pending" });
    assert.deepEqual(describeProperty("hold", "2026-12-01T00:00:00.000Z"), {
      status: "hold",
      approval: "active",
      expiresAt: "2026-12-01T00:00:00.000Z",
    });
    assert.deepEqual(describeProperty("available", null), { status: "available" });
    assert.deepEqual(describeProperty("mystery", null), { status: "unknown", raw: "mystery" });
    assert.equal(isStockBoardStatus("withdrawn"), false);
    assert.equal(isStockBoardStatus("finance_approved"), true);
  });

  it("counts every known status, including ones the old dashboard tally dropped", () => {
    const tally = tallyPropertyStatuses([
      { status: "available", price: 100 },
      { status: "hold", price: 5 },
      { status: "finance_approved", price: 9 },
      { status: "sold", price: 40 },
      { status: "withdrawn", price: 1 },
      { status: "nope", price: 1 },
    ]);
    assert.equal(tally.available, 1);
    assert.equal(tally.availValue, 100);
    assert.equal(tally.hold, 1);
    assert.equal(tally.finance_approved, 1);
    assert.equal(tally.sold, 1);
    assert.equal(tally.soldValue, 40);
    assert.equal(tally.withdrawn, 1);
    assert.equal(tally.unknown, 1);
  });
});

describe("reservations", () => {
  it("offers release only while active, and review only to HQ on a pending row", () => {
    assert.deepEqual(reservationActions("active", false), { release: true, review: false, awaitingApproval: false });
    assert.deepEqual(reservationActions("pending", true), { release: false, review: true, awaitingApproval: true });
    assert.deepEqual(reservationActions("pending", false), { release: false, review: false, awaitingApproval: true });
    assert.deepEqual(reservationActions("rejected", true), { release: false, review: false, awaitingApproval: false });
    assert.deepEqual(reservationActions("nope", true), { release: false, review: false, awaitingApproval: false });
    assert.equal(propertyStatusForReservationType("hold"), "hold");
    assert.equal(propertyStatusForReservationType("reservation"), "reserved");
  });
});

describe("lead stages", () => {
  it("treats board labels and cron snake_case as the same stage", () => {
    assert.equal(normalizeLeadStage("Pack Sent"), "pack_sent");
    assert.equal(normalizeLeadStage("pack_sent"), "pack_sent");
    assert.equal(normalizeLeadStage("pack sent"), "pack_sent");
    assert.equal(leadStageMatches("Qualified", "qualified"), true);
    assert.equal(pipelineColumnFor("pack_sent"), "Pack Sent");
    assert.equal(pipelineColumnFor(""), "New");
    assert.equal(pipelineColumnFor(null), "New");
    assert.equal(pipelineColumnFor("Won"), null);
    assert.equal(pipelineColumnFor("Lost"), null);
    assert.equal(pipelineColumnFor("not-a-stage"), null);
    assert.equal(isPipelineColumn("Settlement"), true);
  });

  it("stamps the same lead status timestamps as the API route", () => {
    assert.deepEqual(leadStatusStamps("pack_sent"), ["pack_sent_date"]);
    assert.deepEqual(leadStatusStamps("contract"), ["contract_signed_date"]);
    assert.deepEqual(leadStatusStamps("settled"), ["settlement_date"]);
    assert.deepEqual(leadStatusStamps("Pack Sent"), []);
    assert.deepEqual(leadStatusStamps("assigned"), []);
  });

  it("counts an explicit status first, and falls back to stage only when status is empty", () => {
    assert.equal(dashboardBucket({ status: "enquiry", stage: "Qualified" }), "enquiry");
    assert.equal(dashboardBucket({ status: "assigned", stage: "Qualified" }), null);
    assert.equal(dashboardBucket({ status: "", stage: "Pack Sent" }), "pack_sent");
    assert.equal(dashboardBucket({ status: null, stage: "Settlement" }), "settled");
    assert.equal(dashboardBucket({ status: null, stage: "Won" }), null);
    const counts = countDashboardBuckets([
      { status: "qualified" },
      { status: null, stage: "pack_sent" },
      { status: "closed", stage: "Won" },
    ]);
    assert.equal(counts.qualified, 1);
    assert.equal(counts.pack_sent, 1);
    assert.equal(counts.settled, 0);
  });
});

describe("freshness and queue", () => {
  const now = Date.parse("2026-11-10T00:00:00.000Z");

  it("classifies age with the stale-deals thresholds", () => {
    assert.equal(freshnessFromDays(null), "unknown");
    assert.equal(freshnessFromDays(0), "fresh");
    assert.equal(freshnessFromDays(3), "fresh");
    assert.equal(freshnessFromDays(4), "warm");
    assert.equal(freshnessFromDays(8), "stale");
    assert.equal(freshnessFromDays(15), "critical");
    assert.equal(freshnessFromDays(Number.NaN), "fresh");
  });

  it("uses the first present timestamp and the caller's missing-value policy", () => {
    assert.equal(activityAgeDays([null, "2026-11-06T00:00:00.000Z"], now, null), 4);
    assert.equal(activityAgeDays([null, undefined, ""], now, 999), 999);
    assert.equal(activityAgeDays(["not-a-date"], now, null), Number.NaN);
  });

  it("scores title-case stages the cron used to miss", () => {
    assert.equal(queueStagePoints("Pack Sent"), 40);
    assert.equal(queueStagePoints("pack_sent"), 40);
    assert.equal(queueStagePoints("Qualified"), 20);
    assert.equal(queueStagePoints("New"), 0);
    assert.equal(queueInactivityPoints(15), 100);
    assert.equal(queueInactivityPoints(8), 60);
    assert.equal(queueInactivityPoints(4), 30);
    assert.equal(queueInactivityPoints(Number.NaN), 0);
    assert.equal(suggestedQueueAction("Pack Sent"), "Follow up pack");
    assert.equal(suggestedQueueAction("qualified"), "Call & convert");
    assert.equal(suggestedQueueAction("New"), "Check status");
  });

  it("builds the same reminder copy, for both stage spellings", () => {
    const drafts = reminderDraftsForLead({ id: "l1", name: "Ada", stage: "Pack Sent" }, 9);
    assert.deepEqual(
      drafts.map((draft) => draft.type),
      ["follow_up", "urgent"],
    );
    assert.equal(drafts[0]?.message, "Follow up pack: Ada");
    const qualified = reminderDraftsForLead({ id: "l2", name: "Bea", stage: "qualified" }, 1);
    assert.equal(qualified.length, 1);
    assert.equal(qualified[0]?.type, "call");
  });
});

describe("async, mutation, confirm, auth, documents", () => {
  it("refuses a success that arrives when nothing is loading", () => {
    const idle = reduceAsync({ phase: "idle" }, { type: "succeed", data: 1 });
    assert.equal(idle.phase, "idle");
    const loading = reduceAsync({ phase: "idle" }, { type: "start" });
    const ready = reduceAsync(loading, { type: "succeed", data: [1, 2] });
    assert.deepEqual(ready, { phase: "ready", data: [1, 2] });
    const refreshing = reduceAsync(ready, { type: "start" });
    assert.equal(refreshing.phase, "loading");
    if (refreshing.phase === "loading") assert.deepEqual(refreshing.data, [1, 2]);
    const failed = reduceAsync(refreshing, { type: "fail", message: "nope" });
    assert.equal(failed.phase, "error");
    if (failed.phase === "error") assert.deepEqual(failed.data, [1, 2]);
  });

  it("keeps a mutation single-flight", () => {
    const pending = reduceMutation({ phase: "idle" }, { type: "start" });
    assert.equal(reduceMutation(pending, { type: "start" }).phase, "pending");
    assert.equal(reduceMutation(pending, { type: "succeed" }).phase, "success");
    const errored = reduceMutation(pending, { type: "fail", message: "bad" });
    assert.deepEqual(errored, { phase: "error", message: "bad" });
    assert.equal(reduceMutation({ phase: "success" }, { type: "fail", message: "x" }).phase, "success");
  });

  it("ignores cancel while a confirmed action is submitting", () => {
    assert.equal(reduceConfirm("idle", "submit"), "idle");
    assert.equal(reduceConfirm("idle", "arm"), "armed");
    assert.equal(reduceConfirm("armed", "submit"), "submitting");
    assert.equal(reduceConfirm("submitting", "cancel"), "submitting");
    assert.equal(reduceConfirm("submitting", "fail"), "armed");
    assert.equal(reduceConfirm("submitting", "succeed"), "idle");
  });

  it("derives session phases without overlapping flags", () => {
    assert.equal(deriveAuthPhase(true, true), "loading");
    assert.equal(deriveAuthPhase(false, false), "anonymous");
    assert.equal(deriveAuthPhase(false, true), "signed_in");
    assert.equal(linkSessionPhase(false, false), "checking");
    assert.equal(linkSessionPhase(true, false), "missing");
    assert.equal(linkSessionPhase(true, true), "ready");
  });

  it("requires an id only for the destination that uses it", () => {
    assert.equal(documentDestinationError("general", "", ""), null);
    assert.equal(documentDestinationError("project", "", "lot"), "Choose a project");
    assert.equal(documentDestinationError("property", "proj", ""), "Choose a property");
    assert.equal(documentDestinationError("property", "", "lot"), null);
  });
});
