# Maintenance prompts

These prompts keep the Azure VWAN Review Pack accurate and current. They are
written for any LLM-based coding assistant (VS Code Copilot Chat,
Claude Code, Cursor, etc.) and rely only on standard tools (`curl`, `node`,
`git`, `gh`, a markdown linter).

| Prompt                                                                  | When to use                                                                                                       |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [`00-blueprint.prompt.md`](00-blueprint.prompt.md)                      | Read first. Captures the original construction plan so future maintainers know how the pack was built and scoped. |
| [`refresh-sources.prompt.md`](refresh-sources.prompt.md)                | Quarterly. Re-fetches the four Microsoft Learn anchor pages, flags moved sections, expired URLs, stale citations. |
| [`add-or-update-control.prompt.md`](add-or-update-control.prompt.md)    | Whenever you need to add a new control row or modify an existing one across checklist + addendum + cheat-sheet.   |
| [`verify-pack.prompt.md`](verify-pack.prompt.md)                        | Before every commit. Runs the anchor + markdown lint gate.                                                        |

## Convention

- The pack has exactly four maintained Markdown files:
  `README.md`, `01-vwan-review-checklist.md`, `02-vwan-review-addendum.md`,
  `03-vwan-waf-cheatsheet.md`.
- Control IDs are immutable once assigned. Add new IDs, never reuse.
- Every checklist row must back-link to an `A-{ID}` anchor in the addendum.
- The cheat-sheet introduces no new controls — back-links only.
- Status / Risk / Priority rubrics are owned by `README.md`.

## Verification gates

Both gates run in CI via [`.github/workflows/docs.yml`](https://github.com/jonathan-vella/azure-vwan-review/blob/main/.github/workflows/docs.yml)
and locally via [`scripts/verify.mjs`](https://github.com/jonathan-vella/azure-vwan-review/blob/main/scripts/verify.mjs):

1. **Anchor resolution** — every `#a-{id}` link resolves.
2. **Markdown lint** — `markdownlint-cli2` against the four Markdown files.
3. **MkDocs strict build** — `mkdocs build --strict` catches broken
   internal links and nav drift.
