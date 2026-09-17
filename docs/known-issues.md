# Known Issues

Tracked here deliberately rather than left to be rediscovered from old commit messages. None of these are fixed as part of the Mongo → Supabase migration (Phases 0–9) — they're candidates for a separate post-migration modernization phase.

## RESOLVED: Root-level dependency duplication (Modernization 3A, PR #12)

Root `package.json` listed `@radix-ui/react-tooltip`, `jspdf`, `jspdf-autotable`, and `jwt-decode` as dependencies, duplicated from `client/package.json`'s own copies. Nothing at the root level (there is no root-level application code, only orchestration scripts) actually imported any of them — this predated the Supabase migration entirely and was flagged in the original codebase audit.

Removed in Modernization 3A. Root has no `react-scripts`/`typescript` peer conflict, so this `npm uninstall` completed cleanly with no compatibility flags. Verified: `npm ci` succeeds, `scripts/verify-rls.mjs` still resolves `@supabase/supabase-js`, and root's `npm audit` dropped from 3 vulnerabilities to 0.

## Confirmed-dead client dependencies, deferred pending CRA → Vite (Modernization 3A)

Six `client/package.json` dependencies are confirmed unused — zero imports anywhere in `client/src`, and zero references in any config file (`tailwind.config.js`, etc.), verified by repo-wide grep immediately before the Modernization 3 audit and again immediately before attempting removal:

- `axios`
- `jwt-decode`
- `@radix-ui/react-tooltip`
- `@radix-ui/react-icons`
- `class-variance-authority`
- `tailwind-variants`

**Why they weren't removed now.** Removing any one of them with `npm uninstall` in `client/` triggers a full dependency-tree re-resolution, which surfaces a pre-existing, unrelated peer-dependency conflict:

```
npm error code ERESOLVE
npm error While resolving: react-scripts@5.0.1
npm error Found: typescript@5.9.3
npm error   peer typescript@">= 2.7" from fork-ts-checker-webpack-plugin@6.5.3
npm error   peerOptional typescript@"^5" from i18next@25.2.1
npm error   ... (react-i18next, tsutils, same)
npm error
npm error Could not resolve dependency:
npm error peerOptional typescript@"^3.2.1 || ^4" from react-scripts@5.0.1
npm error
npm error Conflicting peer dependency: typescript@4.9.5
```

`react-scripts@5.0.1` declares an optional peer `typescript@^3.2.1 || ^4`; `i18next`/`react-i18next` each declare an optional peer `typescript@^5`. No single `typescript` version satisfies both, so npm's resolver — which re-validates the entire tree on any install/uninstall, not just the packages named on the command line — refuses to proceed without `--legacy-peer-deps` or `--force`. The six packages above have nothing to do with `typescript`, `i18next`, or `react-scripts`; they merely happen to be *any* operation that makes npm re-check peers it hasn't been asked to re-validate since the lockfile was last written.

**Why `--legacy-peer-deps` was deliberately rejected**, rather than used once to unblock this: the conflict's root cause is `react-scripts` itself (CRA's toolchain pins an obsolete TypeScript peer range), and CRA → Vite is already planned as **Modernization 6**, which removes `react-scripts` entirely and eliminates this conflict at the source. Reaching for a compatibility flag now to remove six dead packages would mean carrying that flag (or its lockfile consequences) forward through every `npm ci` and CI run between now and Modernization 6, normalizing a workaround for a problem that has a real fix already on the roadmap. That trade wasn't worth it for a cleanup with no functional urgency.

**Acceptance criterion for the post-Vite dependency cleanup (to be scoped in or immediately after Modernization 6):** once `react-scripts` is removed and this peer conflict no longer exists, `npm uninstall axios jwt-decode @radix-ui/react-tooltip @radix-ui/react-icons class-variance-authority tailwind-variants` must complete via a normal, unmodified `npm uninstall` — no `--legacy-peer-deps`, `--force`, or lockfile hand-editing — and `npm ci` + the full client test suite must still pass afterward.

## CRA/tooling and ESLint debt

- `client`'s own `npm audit` reports **63 vulnerabilities** (13 low, 14 moderate, 32 high, 4 critical), almost entirely from `react-scripts@5.0.1`'s aging, deep transitive dependency tree (old `webpack`, `babel`, and related build-tooling packages). This is a well-known characteristic of Create React App projects that haven't migrated off `react-scripts`, not something introduced by this migration. A move to Vite (or another actively-maintained toolchain) would likely resolve most of this at once, but that's a real, separate modernization project, not a dependency bump.
- Pre-existing ESLint unused-import warnings, surfaced during Phase 8's build verification: `Dashboard.js` (`DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `Tooltip`, `TooltipContent`, `TooltipTrigger`, `i18n`) and `Expenses.js` (`i18n`).

## Modernization 4 — jsPDF security upgrade: investigation complete, implementation deferred until after CRA → Vite

Root's copy of `jspdf` (and its transitive `dompurify`) was the unused duplicate removed in Modernization 3A — root's `npm audit` is now clean. The same vulnerabilities remain in `client/package.json`, where `jspdf@3.0.1` and `jspdf-autotable@5.0.2` are genuinely used for the PDF export feature in [Dashboard.js](../client/src/pages/Dashboard.js)/[Expenses.js](../client/src/pages/Expenses.js). Modernization 4 investigated the upgrade in full (no code/dependency changes made); findings are preserved here so the implementation can proceed directly once CRA → Vite (Modernization 6) removes the blocker.

**Target versions:** `jspdf@4.2.1`, `jspdf-autotable@5.0.8`. The autotable companion **must** be upgraded alongside `jspdf` — `jspdf-autotable@5.0.2`'s own `peerDependencies` declares `"jspdf": "^2 || ^3"` and does not permit `^4`; `5.0.7` (first published version after 5.0.2; 5.0.3–5.0.6 were never published) widened this to `"^2 || ^3 || ^4"` specifically to support jsPDF 4.x, with `5.0.8` adding only an unrelated pagination bugfix.

**Vulnerability/reachability analysis:**

| Package | Severity | Direct/transitive | Fix requires |
|---|---|---|---|
| `jspdf` | Critical (CVSS up to 9.6 — HTML injection in output methods, AcroForm/`addJS` PDF-injection to arbitrary JS execution, BMP/GIF-dimension DoS, XMP metadata injection, Node.js path traversal) | Direct, `3.0.1` | Major version bump — only `4.2.1` is patched; vulnerable range is `<=4.2.0`. |
| `dompurify` | Moderate (XSS sanitizer-bypass CVEs) | Transitive, optional dep of `jspdf`, only invoked by jsPDF's `.html()` method | Resolves automatically — `jspdf@4.2.1`'s own `optionalDependencies` range (`^3.3.1`) permits (and a fresh install selects) the patched `3.4.15`. |
| `fflate` | Moderate (ZIP64 parsing infinite loop in `unzipSync`) | Transitive, hard dep of `jspdf`, only invoked by custom font/zip loading | Resolves automatically — `jspdf@4.2.1`'s `dependencies` range (`^0.8.1`) permits the patched `0.8.3`. |

These are the only **production/runtime** findings in `client`'s dependency tree — everything else `npm audit` reports there comes from `react-scripts`'s dev-only build toolchain (see "CRA/tooling and ESLint debt" above).

**None of the above are reachable through FinTrack's actual usage today.** Both PDF-export call sites only use `addImage` (with one hardcoded, developer-controlled logo — never a user-supplied image), `setFontSize`, `text`, `autoTable`, and `save()`. Neither file calls `.html()` (so `dompurify` is never invoked), neither uses AcroForm/`addJS`/custom fonts (so the injection and `fflate` paths are never invoked), and jsPDF only ever runs in the browser build here (so the Node.js path-traversal fix is moot). We're upgrading anyway because: (a) any future feature touching these subsystems (user-uploaded logos, an HTML report template, custom/branded fonts) would immediately reopen a currently-critical CVE class; (b) automated scanners will keep flagging this regardless of reachability nuance; (c) the upgrade's own technical cost is low — see below — so there's no real benefit to leaving it.

**Confirmed breaking changes relevant to FinTrack: none.** jsPDF's own release notes for `v4.0.0` state explicitly "there are no other breaking changes" beyond a Node.js-build-only filesystem restriction (irrelevant — FinTrack never runs jsPDF outside the browser); `v4.1.0`/`v4.2.0`/`v4.2.1` are pure security patches with no API changes. `doc.lastAutoTable.finalY` (used by Dashboard.js's chained two-table export) is confirmed still present in the autotable build. The only genuinely open item is empirical, not from the changelogs: **both `Dashboard.js` and `Expenses.js` call `doc.addImage(logoBase64, "PNG", ...)` where the data URI is actually `data:image/jpeg;...`** — a pre-existing format-string mismatch in both files. Several of jsPDF's patched CVEs hardened image-format/dimension validation, so this mismatch must be re-tested against the actual export output during implementation, not assumed to still silently work.

**PDF regression scenarios identified for implementation-time verification:** zero / one / multiple transactions; one long description and one long category (no `maxLength` constraint exists on either field); decimal amounts, including values needing rounding; a date-filtered export (partial and empty result sets); Dashboard's goal-not-set (`"Not Set"`) vs. goal-set path; the chained two-table Dashboard export (`doc.lastAutoTable.finalY` offset). A coarse structural smoke test (assert the output starts with the `%PDF-` magic bytes and grows monotonically with row count) was identified as feasible automation, explicitly *not* a byte-for-byte snapshot (jsPDF embeds timestamps/xref offsets, so two runs of identical input are never byte-identical) — but whether `addImage` with a JPEG data URI works cleanly under Jest's jsdom environment needs a quick empirical spike before committing to it, not an assumption. Visual/manual comparison remains the right tool for logo placement, table wrapping, and the `lastAutoTable` offset — not worth automating.

**Rollback plan:** revert the `jspdf`/`jspdf-autotable` version bumps in `client/package.json` and the lockfile in a single commit; no source changes are anticipated unless the `addImage` mismatch check above turns up a real problem.

**Acceptance criteria:** both export buttons produce a valid, visually-correct PDF across all scenarios above; production build succeeds with no new warnings (jsPDF 4.2.1 adds a `package.json` `"exports"` map, absent in 3.0.1 — lower-risk than the `react-router-dom`/Jest resolution issue from Modernization 1, since both its `browser`/`default` conditions point at the same ES build already used via the legacy `module` field, but must still be verified against this project's specific webpack version, not assumed safe); `npm audit` reports zero findings for `jspdf`/`fflate`/`dompurify`; no file other than `Dashboard.js`/`Expenses.js` (only if the `addImage` mismatch requires a fix) and the two dependency manifests changes.

**Why this isn't happening now:** a normal `npm install jspdf@4.2.1 jspdf-autotable@5.0.8` (tested via `--dry-run`, confirmed via `git status` that nothing changed) hits the identical pre-existing `react-scripts`/TypeScript/`i18next` peer conflict documented above for the six deferred client dependencies — the blocker is the CRA toolchain, not `jspdf` itself. Per the same reasoning as that deferral, we're not reaching for `--legacy-peer-deps`, `--force`, manual lockfile editing, or TypeScript pinning to force this through. This upgrade is scheduled to be revisited immediately after Modernization 6 (CRA → Vite), alongside the six deferred dependency removals.

## Functional bug: `SetGoalModal.jsx` date-only timezone/off-by-one

Found during Phase 6's live testing, confirmed not to be a migration-introduced bug: dates shift by one day in both directions —

- **Edit-prefill**: `new Date(initialGoal.startDate)` parses the stored date-only string as UTC midnight, then displays it in the browser's local timezone, which can roll it back a day depending on the local UTC offset.
- **Save**: `startDate.toISOString().split("T")[0]` converts the picker's local-midnight `Date` object to UTC before truncating to a date string, which can push it forward a day for the same reason.

Confirmed via direct database inspection during Phase 6 testing that `api.js` persists exactly what it's given and returns exactly what's stored — the shift happens entirely inside `SetGoalModal.jsx`'s `Date` conversions. This bug predates the Supabase migration (the same code, operating on the same string-shaped dates, existed against the old Mongo-backed data) and was simply never observable before, since Savings Goals was non-functional end-to-end until Phase 6.

A correct fix needs to stop round-tripping date-only values through `Date`/timezone conversions at all — e.g. parsing/formatting with a library function that treats the value as a plain calendar date (no time component, no timezone), not `new Date(string)` / `.toISOString()`.
