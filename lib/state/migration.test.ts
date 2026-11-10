import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { MARK_SOLD_STATUSES, PROPERTY_STATUSES } from "./property";

const canonical = readFileSync("supabase/canonical_lot_status.sql", "utf8");

function section(name: string): string {
  const start = canonical.indexOf(`-- BEGIN ${name}`);
  const end = canonical.indexOf(`-- END ${name}`);
  assert.ok(start >= 0 && end > start, `missing section ${name}`);
  return canonical.slice(start, end);
}

describe("canonical lot status migration", () => {
  const setter = section("set_property_status");
  const sold = section("mark_sold");
  const aliases = section("reservation_aliases");
  const executable = canonical.slice(canonical.indexOf("\nbegin;"));

  it("defines one setter that accepts every lot status, including finance_approved", () => {
    assert.match(setter, /create or replace function public\.set_property_status\(p_property_id uuid, p_status text\)/);
    assert.match(setter, /returns void/);
    assert.match(setter, /security definer/);
    assert.match(setter, /set search_path = public/);
    for (const status of PROPERTY_STATUSES) {
      assert.match(setter, new RegExp(`'${status}'`));
    }
    assert.match(setter, /released_at = now\(\)/);
    assert.match(section("property_status_check"), /'finance_approved'/);
  });

  it("lets mark_sold update under_contract and finance_approved without changing its signature", () => {
    assert.match(
      sold,
      /create or replace function public\.mark_sold\(\s*p_property_id uuid,\s*p_buyer_name text default null,\s*p_buyer_email text default null,\s*p_sale_price numeric default null\s*\) returns uuid/,
    );
    assert.match(sold, /security definer/);
    assert.match(sold, /set search_path = public/);
    assert.match(sold, /You can only sell a lot your group is holding/);
    assert.match(sold, /'pending'/);
    for (const status of MARK_SOLD_STATUSES) {
      assert.match(sold, new RegExp(`'${status}'`));
    }
    assert.match(
      sold,
      /status in \('available','hold','reserved','under_contract','finance_approved'\)/,
    );
  });

  it("adds the missing reservation name as a wrapper and does not replace a body that already exists", () => {
    for (const name of [
      "request_hold",
      "request_reservation",
      "approve_hold",
      "approve_request",
      "reject_hold",
      "reject_request",
    ]) {
      assert.match(aliases, new RegExp(`public\\.${name}\\(`));
    }
    assert.match(aliases, /return public\.request_hold\(p_property_id\)/);
    assert.match(aliases, /return public\.request_reservation\(p_property_id\)/);
    assert.match(aliases, /perform public\.approve_hold\(p_reservation_id\)/);
    assert.match(aliases, /perform public\.approve_request\(p_reservation_id\)/);
    assert.match(aliases, /perform public\.reject_hold\(p_reservation_id\)/);
    assert.match(aliases, /perform public\.reject_request\(p_reservation_id\)/);
    assert.match(aliases, /to_regprocedure\('public\.request_hold\(uuid\)'\) is not null/);
    assert.match(aliases, /security definer/);
    assert.match(canonical, /copy_execute_grants/);
  });

  it("does not drop the live functions, and leaves the older migrations untouched", () => {
    assert.equal(executable.includes("drop function"), false);
    const release = readFileSync("supabase/release_cooldown.sql", "utf8");
    const underContract = readFileSync("supabase/under_contract.sql", "utf8");
    const finance = readFileSync("supabase/finance_approved.sql", "utf8");
    assert.match(
      release,
      /p_status not in \('available','hold','reserved','under_contract','sold','withdrawn'\)/,
    );
    assert.equal(release.includes("finance_approved"), false);
    assert.equal(underContract.includes("finance_approved"), false);
    assert.match(finance, /'finance_approved'/);
    assert.equal(finance.includes("released_at"), false);
    const schema = readFileSync("supabase/schema.sql", "utf8");
    assert.match(schema, /status in \('hold','reserved','available'\)/);
  });
});
