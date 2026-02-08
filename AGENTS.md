Rakesh owns this. Start: say hi + 1 motivating line.
Work style: telegraph; noun-phrases ok; drop grammar; min tokens.

## Agent Protocol
- Contact: Rakesh.
- Workspace root: `/Users/rakesh/Developer`.
- 3rd-party/OSS repos: `/Users/rakesh/Developer/oss` (create if missing).
- PRs: use `gh pr view` / `gh pr diff` (no URLs).
- “Make a note” => edit `AGENTS.md` (shortcut; not blocker). Ignore `CLAUDE.md` if present.
- No `./runner`. Use `trash` for deletes.
- Need upstream file: stage in `/tmp/`, then cherry-pick; never overwrite tracked files.
- Bugs: add regression test when it fits.
- Keep files under ~500 LOC; split/refactor as needed.
- Commits: Conventional Commits (`feat|fix|refactor|build|ci|chore|docs|style|perf|test`).
- Editor: `code <path>`.
- CI: `gh run list/view`; rerun/fix till green.
- Prefer end-to-end verify; if blocked, state exactly what is missing.
- New deps: quick health check (recent releases/commits, adoption).
- Slash commands path: `~/.codex/prompts/` (use if present).
- Web: search early; quote exact errors; prioritize recent sources.
- Style: telegraph. Drop filler/grammar. Min tokens.

## Important Locations
- Repo root: `/Users/rakesh/Developer/agency/studio-saas-monorepo-personal`
- Docs: `docs/`
- Web E2E tests: `apps/web/tests`
- Playwright config: `apps/web/playwright.config.ts`

## Docs
- Start by reading relevant docs (`README.md`, `docs/`, package-level docs) before coding.
- If `docs:list` script or `bin/docs-list` exists, run it first; ignore if unavailable.
- Follow linked docs until domain context is clear; honor `read_when` hints.
- Keep notes short; update docs when behavior/API changes.
- For cross-cutting docs, add `read_when` hints.

## PR Feedback
- Active PR: `gh pr view --json number,title,url --jq '"PR #\\(.number): \\(.title)\\n\\(.url)"'`
- PR comments: use `gh pr view` plus `gh api .../comments --paginate` as needed.
- Replies: cite fix and file/line; resolve threads only after fix lands.
- If `CHANGELOG.md` exists, add merge acknowledgment there; else include in PR summary/comment.

## Flow & Runtime
- Use repo’s package manager/runtime; no swaps without approval.
- Use Codex background for long jobs; use persistent terminals only when interactive debugging is required.

## Build / Test
- Before handoff, run relevant gate: `pnpm lint`, `pnpm check`, `pnpm typecheck`, `pnpm build`, and targeted tests.
- For user-facing route/flow changes, run `cd apps/web && pnpm e2e` when feasible.
- If CI is red: `gh run list/view`, rerun/fix, push, repeat till green.
- Keep validation observable with logs/output and clear pass/fail notes.
- If full validation is blocked, state exactly what was not run and why.

## Git
- Safe by default: `git status`, `git diff`, `git log`.
- If user asks a question about changes, answer first; do not revert/delete/edit unless explicitly asked.
- Question-only messages are never consent for mutation (`edit`, `revert`, `delete`, `restore`, `trash`, `checkout`).
- If instruction is ambiguous, ask one short clarification before any mutating command.
- Before any revert/delete/restore, restate target files + requested action in-thread first.
- Push only when user asks.
- `git checkout` ok for review or explicit request.
- Branch changes require user consent.
- Destructive ops forbidden unless explicit (`reset --hard`, `clean`, `restore`, `rm`, etc.).
- Don’t delete/rename unexpected files; stop and ask.
- No repo-wide search/replace scripts; keep edits small/reviewable.
- Avoid manual `git stash` unless explicitly requested.
- If user types a command (example: “pull and push”), treat that as consent for that command.
- No amend unless asked.
- Big review: `git --no-pager diff --color=never`.
- Multi-agent: check `git status`/`git diff` before edits; ship small focused changes.

## Language/Stack Notes
- TypeScript/Next.js stack: use workspace `pnpm` commands; follow existing patterns.
- Keep modules focused; extract shared logic to `packages/*` when reused.

## Next.js Agent Rule
- At start of any Next.js task, call the Next.js MCP `init` tool first.
- For Next.js APIs/patterns, use Next.js MCP docs/runtime tools before assumptions.

## Environment & Configuration
- Copy `.env.example` to `.env.local` and fill required values before `pnpm dev`.
- Never commit secrets.
- When adding env vars, update `.env.example` and document usage in PR notes.

## Screenshots ("use a screenshot")
- Pick newest PNG in `~/Desktop` or `~/Downloads`.
- Verify it is the correct UI; do not trust filename.
- Check dimensions: `sips -g pixelWidth -g pixelHeight <file>` (prefer 2x source assets).
- Optimize with `imageoptim <file>` if installed (`brew install imageoptim-cli`).
- Replace asset, keep dimensions, run relevant checks, verify CI.

## Tools
- Check availability first: `command -v <tool>`.
- Primary tools on this machine: `gh`, `trash`, `peekaboo`.
- `gh`: use for PR/issues/CI/release workflows (`gh pr view`, `gh issue view`, `gh run list/view`).
- `trash`: preferred delete path instead of destructive removal.
- `peekaboo`: screen capture/inspection/click automation when UI verification is needed.
- Optional tools: `lldb`, `oracle`, `mcporter`.
- `oracle` usage: `npx -y @steipete/oracle --help` (use when stuck/reviewing).
- `mcporter` usage: `npx mcporter --help` then `npx mcporter <server>`.
- Do not assume `~/Projects/*` tool paths exist on this machine.

## Critical Thinking
- Fix root cause, not bandaid.
- If unsure: read more code first; if still blocked, ask with short concrete options.
- If instructions conflict, call it out and choose safer path.
- If unrecognized changes appear, assume concurrent work; focus your files. If risky/conflicting, stop and ask.
- Leave short breadcrumb notes in thread for major decisions.

<frontend_aesthetics>
Avoid “AI slop” UI. Be opinionated + distinctive.

Do:
- Typography: pick a real font; avoid Inter/Roboto/Arial/system defaults.
- Theme: commit to a palette; use CSS vars; bold accents > timid gradients.
- Motion: 1–2 high-impact moments (staggered reveal beats random micro-anim).
- Background: add depth (gradients/patterns), not flat default.

Avoid: purple-on-white clichés, generic component grids, predictable layouts.
</frontend_aesthetics>
