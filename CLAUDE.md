# CLAUDE.md

The canonical agent guide for this repo is **[AGENTS.md](AGENTS.md)** — read it
first. It has the repo map, commands, conventions, the standing ship workflow,
verification recipes (background server, Playwright, Excel-formula validation),
and the gotchas. Everything there applies to Claude Code.

Claude-specific notes:

- **Ship ritual is mandatory** on every change: `npm run build` → verify → bump
  `package.json` semver → update `CHANGELOG.md` (dated entry + release-tag link)
  → commit with the `Co-Authored-By` and `Claude-Session` trailers → PR →
  squash-merge → reset the working branch from `main`. See AGENTS.md §5.
- **Prefer verifying to asserting.** The finance math and the Excel export can be
  checked exactly (API vs. `formulas` engine; screenshots via Playwright). Do that
  before claiming correctness — see AGENTS.md §6.
- When picking up new work, skim **[TODO.md](TODO.md)** — it's prioritized and may
  already cover the request.
