# Refresh sources

> **Cadence**: quarterly, or whenever Microsoft significantly updates the
> Virtual WAN documentation set. The goal is to detect URL rot, moved
> sections, deprecated guidance, and net-new controls worth adopting.

## Objective

Re-validate every Microsoft Learn citation in the pack and surface a
**delta report** the maintainer can act on. Do **not** silently rewrite
controls — propose changes for human review.

## Inputs

- The four anchor pages and their in-scope first-hop sub-pages, listed
  in [`00-blueprint.prompt.md`](00-blueprint.prompt.md#phase-1-source-harvesting).
- All Microsoft Learn URLs currently cited inside the pack — extract
  them automatically with:

  ```bash
  grep -hoE 'https://learn\.microsoft\.com[^)\s>]+' \
       README.md 01-vwan-review-checklist.md \
       02-vwan-review-addendum.md 03-vwan-waf-cheatsheet.md \
    | sort -u
  ```

- Optional Palo Alto Networks Cloud NGFW docs URL set:

  ```bash
  grep -hoE 'https://docs\.paloaltonetworks\.com[^)\s>]+' \
       *.md | sort -u
  ```

## Procedure

1. **HEAD-check each URL** with `curl -sI` and capture the HTTP status.
   Anything other than `200` → flag.
2. **For 200s**, fetch the page and search for the anchor fragment (the
   `#section-id` part of each URL). If the fragment no longer exists,
   flag as **MOVED**.
3. **Diff the four anchor pages** against the per-control "Source"
   citations in [`02-vwan-review-addendum.md`](../02-vwan-review-addendum.md):
   - New "Workload design checklist" / "Configuration recommendations"
     bullets in WAF VWAN that have no matching control → propose a new
     control ID and draft entry.
   - Existing controls whose source bullet has been removed → mark
     **STALE** with a Microsoft Learn diff snippet.
4. **Check for net-new Microsoft Azure features** that materially
   change Virtual WAN posture (recent examples: hub-to-hub encryption
   GA expansion, ER Metro, routing intent regional rollout). Each
   warrants a new control proposal.
5. **Check Palo Alto Cloud NGFW** for:
   - Supported-regions list deltas (affects `PA-02`).
   - Management-plane options (Azure-native / Panorama / Strata Cloud
     Manager) — affects `PA-05` and the decision matrix in
     [`01-vwan-review-checklist.md`](../01-vwan-review-checklist.md).
   - DNAT / SNAT and routing intent integration changes.

## Output

Produce a Markdown report at `agent-output/refresh-{YYYY-MM-DD}.md`
(create the folder if missing). Sections:

```markdown
# Source refresh — <date>

## Summary
- URLs checked: <n>
- BROKEN (non-200): <n>
- MOVED (anchor missing): <n>
- STALE (source bullet removed): <n>
- NEW (candidate new control): <n>

## Detailed findings
| ID / URL | Status | Action |
| -------- | ------ | ------ |
| ...      | ...    | ...    |

## Proposed control additions
- **CONTROL-PROPOSAL**: prefix `<REL/SEC/...>-<next-id>` — short title.
  - Source: <new MS Learn URL>
  - Draft `Why it matters`, `Priority`, `Risk`, `Suggested check`.

## Proposed control removals / merges
- `<EXISTING-ID>` — rationale + replacement (if any).
```

## Guardrails

- **Never renumber** existing control IDs. Removed controls become
  tombstones — keep the row in the addendum with a `Status: deprecated`
  marker and a link to the replacement.
- **Never edit the four primary Markdown files in this pass.** Output
  only the report and proposed diffs; let a human apply them via
  [`add-or-update-control.prompt.md`](add-or-update-control.prompt.md).
- Cite every claim with the exact Microsoft Learn URL and section anchor.
- If a Microsoft page no longer exists, search Microsoft Learn for the
  canonical replacement before recording the URL as BROKEN.

## Verification

After producing the report, run:

```bash
node scripts/verify.mjs
npx markdownlint-cli2 'agent-output/refresh-*.md'
```

Attach the report to a PR titled
`docs: source refresh <YYYY-MM-DD>` for human review.
