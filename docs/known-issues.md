# Known Issues

Tracked here deliberately rather than left to be rediscovered from old commit messages. None of these are fixed as part of the Mongo → Supabase migration (Phases 0–9) — they're candidates for a separate post-migration modernization phase.

## Unused `axios` / `jwt-decode` in `client/`

Both packages are listed in `client/package.json` but no longer imported anywhere in `client/src` (confirmed via repo-wide grep in Phases 4 and 6, when their last consumers were removed). Removing either with `npm uninstall` currently fails with:

```
npm error peerOptional typescript@"^3.2.1 || ^4" from react-scripts@5.0.1
```

This is a pre-existing `react-scripts`/`typescript` peer-dependency conflict, unrelated to either package — not something to force-resolve (`--legacy-peer-deps`/`--force`) mid-migration, since that can affect the whole dependency tree's resolution in ways that weren't reviewed here.

## Root-level dependency duplication

Root `package.json` lists `@radix-ui/react-tooltip`, `jspdf`, `jspdf-autotable`, and `jwt-decode` as dependencies, duplicated from `client/package.json`'s own copies. Nothing at the root level (there is no root-level application code, only orchestration scripts) actually imports any of them — this predates the Supabase migration entirely and was flagged in the original codebase audit.

## CRA/tooling and ESLint debt

- `client`'s own `npm audit` reports **63 vulnerabilities** (13 low, 14 moderate, 32 high, 4 critical), almost entirely from `react-scripts@5.0.1`'s aging, deep transitive dependency tree (old `webpack`, `babel`, and related build-tooling packages). This is a well-known characteristic of Create React App projects that haven't migrated off `react-scripts`, not something introduced by this migration. A move to Vite (or another actively-maintained toolchain) would likely resolve most of this at once, but that's a real, separate modernization project, not a dependency bump.
- Pre-existing ESLint unused-import warnings, surfaced during Phase 8's build verification: `Dashboard.js` (`DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `Tooltip`, `TooltipContent`, `TooltipTrigger`, `i18n`) and `Expenses.js` (`i18n`).

## Remaining dependency vulnerabilities (root `package.json`)

| Package | Severity | Direct/transitive | Fix requires |
|---|---|---|---|
| `jspdf` | Critical (CVSS up to 9.6 — HTML injection/XSS in "New Window" paths, plus several DoS/injection CVEs) | Direct, `3.0.1` | Major version bump — only `4.2.1` is patched; the vulnerable range is `<=4.2.0`. Not resolvable via `npm audit fix` without `--force`, since `^3.0.1` cannot resolve to `4.2.1` on its own. |
| `dompurify` | Moderate (multiple XSS sanitizer-bypass CVEs) | Transitive, pulled in solely by `jspdf@3.0.1` | Resolves automatically once `jspdf` is upgraded or removed — not an independent decision. |

Both vulnerabilities are currently reported against the root's *unused, duplicated* copy of `jspdf` (see "Root-level dependency duplication" above) — removing that dead copy would clear both from root's audit with no upgrade risk. It would **not** fix the underlying issue: `client/package.json` has its own `jspdf@3.0.1`, genuinely used for the PDF export feature in `Dashboard.js`/`Expenses.js`, and hits the same major-version wall. Upgrading that copy needs its own test pass against jsPDF's `4.x` API before being treated as routine dependency hygiene.

## Functional bug: `SetGoalModal.jsx` date-only timezone/off-by-one

Found during Phase 6's live testing, confirmed not to be a migration-introduced bug: dates shift by one day in both directions —

- **Edit-prefill**: `new Date(initialGoal.startDate)` parses the stored date-only string as UTC midnight, then displays it in the browser's local timezone, which can roll it back a day depending on the local UTC offset.
- **Save**: `startDate.toISOString().split("T")[0]` converts the picker's local-midnight `Date` object to UTC before truncating to a date string, which can push it forward a day for the same reason.

Confirmed via direct database inspection during Phase 6 testing that `api.js` persists exactly what it's given and returns exactly what's stored — the shift happens entirely inside `SetGoalModal.jsx`'s `Date` conversions. This bug predates the Supabase migration (the same code, operating on the same string-shaped dates, existed against the old Mongo-backed data) and was simply never observable before, since Savings Goals was non-functional end-to-end until Phase 6.

A correct fix needs to stop round-tripping date-only values through `Date`/timezone conversions at all — e.g. parsing/formatting with a library function that treats the value as a plain calendar date (no time component, no timezone), not `new Date(string)` / `.toISOString()`.
