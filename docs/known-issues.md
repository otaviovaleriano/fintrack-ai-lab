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

## Remaining dependency vulnerabilities (`client/package.json`)

Root's copy of `jspdf` (and its transitive `dompurify`) was the unused duplicate removed in Modernization 3A — root's `npm audit` is now clean. The same vulnerabilities remain in `client/package.json`, where `jspdf` is genuinely used for the PDF export feature in `Dashboard.js`/`Expenses.js`:

| Package | Severity | Direct/transitive | Fix requires |
|---|---|---|---|
| `jspdf` | Critical (CVSS up to 9.6 — HTML injection/XSS in "New Window" paths, plus several DoS/injection CVEs) | Direct, `3.0.1` | Major version bump — only `4.2.1` is patched; the vulnerable range is `<=4.2.0`. Not resolvable via `npm audit fix` without `--force`, since `^3.0.1` cannot resolve to `4.2.1` on its own. |
| `dompurify` | Moderate (multiple XSS sanitizer-bypass CVEs) | Transitive, pulled in solely by `jspdf@3.0.1` | Resolves automatically once `jspdf` is upgraded — not an independent decision. |

Upgrading `client`'s copy needs its own test pass against jsPDF's `4.x` API before being treated as routine dependency hygiene — this is Modernization 4's scope, not incidental cleanup.

## Functional bug: `SetGoalModal.jsx` date-only timezone/off-by-one

Found during Phase 6's live testing, confirmed not to be a migration-introduced bug: dates shift by one day in both directions —

- **Edit-prefill**: `new Date(initialGoal.startDate)` parses the stored date-only string as UTC midnight, then displays it in the browser's local timezone, which can roll it back a day depending on the local UTC offset.
- **Save**: `startDate.toISOString().split("T")[0]` converts the picker's local-midnight `Date` object to UTC before truncating to a date string, which can push it forward a day for the same reason.

Confirmed via direct database inspection during Phase 6 testing that `api.js` persists exactly what it's given and returns exactly what's stored — the shift happens entirely inside `SetGoalModal.jsx`'s `Date` conversions. This bug predates the Supabase migration (the same code, operating on the same string-shaped dates, existed against the old Mongo-backed data) and was simply never observable before, since Savings Goals was non-functional end-to-end until Phase 6.

A correct fix needs to stop round-tripping date-only values through `Date`/timezone conversions at all — e.g. parsing/formatting with a library function that treats the value as a plain calendar date (no time component, no timezone), not `new Date(string)` / `.toISOString()`.
