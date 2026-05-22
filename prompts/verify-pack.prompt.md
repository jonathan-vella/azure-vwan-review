# Verify the pack

> Run this before every commit and before opening a PR. It is the same
> gate the CI workflow enforces — running it locally avoids a red CI
> round-trip.

## One-liner

```bash
node scripts/verify.mjs \
  && npx markdownlint-cli2 '*.md' \
  && mkdocs build --strict
```

If any of the three fails, **do not commit**. Diagnose and fix.

## What each gate enforces

### 1. `scripts/verify.mjs` — anchor resolution

Walks every Markdown link `[...](target#fragment)` across the four
primary files and confirms the fragment resolves to a real heading slug
in the target file.

Common failure modes:

- Renaming an H2 / H3 (e.g. `## Cost Optimization` → `## Cost`) — all
  cheat-sheet back-links break. Fix by reverting the heading rename or
  updating every consumer.
- Adding a new addendum entry without the matching `[→ A-<ID>]` back-link
  in the checklist row. Add the back-link.

### 2. `markdownlint-cli2` — style

Catches table malformation, missing blank lines, broken list nesting,
and long lines that paste poorly into Word / Excel.

Configured via
[`.markdownlint-cli2.jsonc`](https://github.com/jonathan-vella/azure-vwan-review/blob/main/.markdownlint-cli2.jsonc)
at the repo root.

### 3. `mkdocs build --strict` — site build

Catches:

- Internal links (`[text](path/file.md)`) that point at files not listed
  in `nav` or missing from disk.
- Heading-anchor links that MkDocs cannot resolve (this catches drift
  the simple regex anchor-checker misses, because MkDocs uses pymdownx
  slug rules that differ slightly from GitHub).

## Smoke test for Word / Excel paste

The four-file pack is meant to be **copy-pasted into Word and Excel**
without row inflation. After any table edit, manually paste **one
pillar table** into Excel and confirm the row count matches the
Markdown source. This is the regression we keep from the original
build's Phase 6 step 13.

## If you must skip a gate

Don't. There is no scenario where bypassing a gate is the right call —
if a gate is wrong, fix the gate (open an issue), don't bypass it.
