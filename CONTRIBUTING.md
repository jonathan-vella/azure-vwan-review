<!-- markdownlint-disable MD041 -->

# Contributing

Thanks for helping keep the Azure Virtual WAN Review Pack accurate and current.
Contributions are routed through GitHub issues so changes stay reviewable and
the three-file invariant (checklist ↔ addendum ↔ cheat-sheet) is never broken
mid-PR.

## The five-line flow

1. **Open an issue** using the matching template — pick
   [Control gap or addition proposal](.github/ISSUE_TEMPLATE/control-proposal.yml)
   or [Source URL rot](.github/ISSUE_TEMPLATE/source-url-rot.yml).
2. **Wait for the issue to be triaged** (label + acknowledgement).
3. **Fork + branch + edit** the three primary files together using the
   recipe in
   [`prompts/add-or-update-control.prompt.md`](prompts/add-or-update-control.prompt.md).
4. **Run the local gate**: `node scripts/verify.mjs && npx markdownlint-cli2 '*.md' 'prompts/*.md' && mkdocs build --strict`.
5. **Open a PR** that references the issue (`Closes #N`); CI re-runs the
   same three gates.

## Conventions

- Control IDs are **immutable**. Add new IDs at the next available
  number; never reuse a deprecated ID. See
  [`prompts/00-blueprint.prompt.md`](prompts/00-blueprint.prompt.md) for
  prefix → section mapping.
- **No code fences inside table cells.** Multi-line content lives in the
  addendum so the checklist tables paste cleanly into Word and Excel.
- The cheat-sheet introduces **no new controls** — back-links only.
- Every citation must point at a real Microsoft Learn page section that
  currently returns HTTP 200.

## Local setup

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pip install pre-commit && pre-commit install
```

`pre-commit` then runs the anchor + lint gate automatically on every commit;
`mkdocs build --strict` is a pre-push hook.

## Code of conduct

Be kind. Assume good faith. Prefer specifics over hot takes.
