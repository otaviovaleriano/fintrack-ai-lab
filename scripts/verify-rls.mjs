#!/usr/bin/env node
// Verifies Row Level Security isolation on expenses, savings_goals, and
// profiles using REAL authenticated Supabase sessions via @supabase/supabase-js
// - the same Auth/session/Data API path the React client will use starting
// in Phase 4 - not database-owner queries, which bypass RLS entirely and
// would prove nothing.
//
// Usage:
//   Set USER_A_PASSWORD and USER_B_PASSWORD in your own shell first
//   (never paste these into chat), then run:
//     node scripts/verify-rls.mjs
//
// SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY are read from client/.env so
// you don't have to duplicate them anywhere.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

function loadClientEnv() {
  const path = fileURLToPath(new URL("../client/.env", import.meta.url));
  const raw = readFileSync(path, "utf8");
  const vars = {};
  for (const line of raw.split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match) vars[match[1]] = match[2].trim();
  }
  return vars;
}

const env = loadClientEnv();
const SUPABASE_URL = env.REACT_APP_SUPABASE_URL;
const PUBLISHABLE_KEY = env.REACT_APP_SUPABASE_PUBLISHABLE_KEY;

const USER_A = {
  email: "usera.fintrack.test@example.com",
  password: process.env.USER_A_PASSWORD,
};
const USER_B = {
  email: "userb.fintrack.test@example.com",
  password: process.env.USER_B_PASSWORD,
};

if (!SUPABASE_URL || !PUBLISHABLE_KEY) {
  console.error("Could not read REACT_APP_SUPABASE_URL / REACT_APP_SUPABASE_PUBLISHABLE_KEY from client/.env");
  process.exit(1);
}
if (!USER_A.password || !USER_B.password) {
  console.error("Set USER_A_PASSWORD and USER_B_PASSWORD in your shell before running this script.");
  process.exit(1);
}

let pass = 0;
let fail = 0;

function report(label, ok, detail = "") {
  const icon = ok ? "PASS" : "FAIL";
  if (ok) pass++;
  else fail++;
  console.log(`[${icon}] ${label}${detail ? " - " + detail : ""}`);
}

function newClient() {
  // persistSession/autoRefreshToken default to browser storage APIs that
  // don't exist in Node - disable them, this is a short-lived script, not
  // a long-running session.
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signInAs({ email, password }) {
  const client = newClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  return { client, userId: data.user.id };
}

// Runs the full ownership matrix (insert/select/update/delete, both
// directions, forged-ownership insert, and unauthenticated) against one
// table.
async function testTableIsolation(table, { a, b, anon, buildRow, updatePatch, updatedValueCheck }) {
  console.log(`\n--- ${table} ---`);

  // Clean slate: remove anything left over from a previous run.
  await a.client.from(table).delete().eq("user_id", a.userId);
  await b.client.from(table).delete().eq("user_id", b.userId);

  // A inserts their own row.
  const insertA = await a.client.from(table).insert(buildRow(a.userId)).select();
  report(`User A can INSERT own ${table} row`, !insertA.error && insertA.data?.[0]?.id, insertA.error?.message);
  const idA = insertA.data?.[0]?.id;

  // A selects their own row.
  const selectA = await a.client.from(table).select().eq("id", idA);
  report(`User A can SELECT own ${table} row`, selectA.data?.length === 1);

  // A updates their own row.
  const updateA = await a.client.from(table).update(updatePatch).eq("id", idA).select();
  report(`User A can UPDATE own ${table} row`, !updateA.error && updatedValueCheck(updateA.data?.[0]), updateA.error?.message);

  // B inserts their own row (independent of A's).
  const insertB = await b.client.from(table).insert(buildRow(b.userId)).select();
  report(`User B can INSERT own ${table} row`, !insertB.error && insertB.data?.[0]?.id, insertB.error?.message);
  const idB = insertB.data?.[0]?.id;

  // The WITH CHECK test: A tries to insert a row claiming to belong to B.
  // This is a different failure mode from the rest of this matrix - RLS
  // makes existing rows you don't own invisible (zero rows, no error),
  // but a WITH CHECK violation on INSERT is a hard Postgres error
  // ("new row violates row-level security policy"), surfaced by
  // PostgREST as a 403/42501. Asserting on the error here specifically
  // proves the WITH CHECK clause is doing something, not just USING.
  const forgedInsert = await a.client.from(table).insert(buildRow(b.userId)).select();
  report(
    `User A cannot INSERT a ${table} row claiming to be User B's (WITH CHECK)`,
    !!forgedInsert.error,
    forgedInsert.error ? `error: ${forgedInsert.error.code} ${forgedInsert.error.message}` : "no error raised - CHECK did not fire"
  );

  // B cannot see/touch A's row.
  const bSeesA = await b.client.from(table).select().eq("id", idA);
  report(`User B cannot SELECT User A's ${table} row`, bSeesA.data?.length === 0, `rows visible: ${bSeesA.data?.length}`);

  const bUpdatesA = await b.client.from(table).update(updatePatch).eq("id", idA).select();
  report(`User B cannot UPDATE User A's ${table} row`, !bUpdatesA.error && bUpdatesA.data?.length === 0, `rows affected: ${bUpdatesA.data?.length}`);

  const bDeletesA = await b.client.from(table).delete().eq("id", idA).select();
  report(`User B cannot DELETE User A's ${table} row`, !bDeletesA.error && bDeletesA.data?.length === 0, `rows affected: ${bDeletesA.data?.length}`);

  // A cannot see/touch B's row (the reverse direction).
  const aSeesB = await a.client.from(table).select().eq("id", idB);
  report(`User A cannot SELECT User B's ${table} row`, aSeesB.data?.length === 0, `rows visible: ${aSeesB.data?.length}`);

  const aDeletesB = await a.client.from(table).delete().eq("id", idB).select();
  report(`User A cannot DELETE User B's ${table} row`, !aDeletesB.error && aDeletesB.data?.length === 0, `rows affected: ${aDeletesB.data?.length}`);

  // A's row survived all of B's attempts, unchanged by them.
  const reselectA = await a.client.from(table).select().eq("id", idA);
  report(`User A's ${table} row is unaffected by User B's attempts`, updatedValueCheck(reselectA.data?.[0]));

  // Unauthenticated cannot see anything.
  const anonSelect = await anon.client.from(table).select();
  // Blocked can mean either "RLS silently returned zero rows" or "the
  // anon role has no GRANT on this table at all, so PostgREST returned a
  // permission-denied error before RLS was even evaluated" - both are
  // valid proof unauthenticated access is blocked, since we deliberately
  // did not grant anon anything (only `authenticated` has table
  // privileges, matching the policies, which are also `to authenticated`
  // only).
  report(
    `Unauthenticated request cannot read ${table} rows`,
    !!anonSelect.error || anonSelect.data?.length === 0,
    anonSelect.error ? `blocked at GRANT level: ${anonSelect.error.message}` : `rows visible: ${anonSelect.data?.length}`
  );

  // Unauthenticated cannot insert.
  const anonInsert = await anon.client.from(table).insert(buildRow(a.userId)).select();
  report(`Unauthenticated INSERT into ${table} is rejected`, !!anonInsert.error, anonInsert.error?.message);

  // Cleanup - both users delete their own row.
  await a.client.from(table).delete().eq("id", idA);
  await b.client.from(table).delete().eq("id", idB);
}

async function testProfilesIsolation(a, b, anon) {
  console.log(`\n--- profiles ---`);

  const aOwn = await a.client.from("profiles").select().eq("id", a.userId);
  report("User A can SELECT own profile", aOwn.data?.length === 1);

  const bOwn = await b.client.from("profiles").select().eq("id", b.userId);
  report("User B can SELECT own profile", bOwn.data?.length === 1);

  const aReadsB = await a.client.from("profiles").select().eq("id", b.userId);
  report("User A cannot SELECT User B's profile", aReadsB.data?.length === 0, `rows visible: ${aReadsB.data?.length}`);

  const bReadsA = await b.client.from("profiles").select().eq("id", a.userId);
  report("User B cannot SELECT User A's profile", bReadsA.data?.length === 0, `rows visible: ${bReadsA.data?.length}`);

  const aUpdatesB = await a.client.from("profiles").update({ name: "hijacked" }).eq("id", b.userId).select();
  report("User A cannot UPDATE User B's profile", !aUpdatesB.error && aUpdatesB.data?.length === 0, `rows affected: ${aUpdatesB.data?.length}`);

  const anonSelect = await anon.client.from("profiles").select();
  report(
    "Unauthenticated request cannot read profiles",
    !!anonSelect.error || anonSelect.data?.length === 0,
    anonSelect.error ? `blocked at GRANT level: ${anonSelect.error.message}` : `rows visible: ${anonSelect.data?.length}`
  );
}

async function main() {
  console.log("Signing in as User A and User B...");
  const a = await signInAs(USER_A);
  const b = await signInAs(USER_B);
  const anon = { client: newClient() }; // no sign-in - exercises the anon role
  console.log(`User A id: ${a.userId}`);
  console.log(`User B id: ${b.userId}`);

  await testTableIsolation("expenses", {
    a,
    b,
    anon,
    buildRow: (userId) => ({
      type: "expense",
      category: "RLS test",
      description: "verify-rls.mjs",
      amount: 12.34,
      date: "2026-01-01",
      user_id: userId,
    }),
    updatePatch: { amount: 99.99 },
    updatedValueCheck: (row) => row?.amount === 99.99,
  });

  await testTableIsolation("savings_goals", {
    a,
    b,
    anon,
    buildRow: (userId) => ({
      amount: 500,
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      user_id: userId,
    }),
    updatePatch: { amount: 750 },
    updatedValueCheck: (row) => row?.amount === 750,
  });

  await testProfilesIsolation(a, b, anon);

  console.log(`\n${pass} passed, ${fail} failed.`);
  process.exitCode = fail > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
