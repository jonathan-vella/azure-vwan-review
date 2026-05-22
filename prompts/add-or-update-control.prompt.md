# Add or update a control

> Use this prompt every time you change the control set — add, modify, or
> deprecate a row. It enforces the three-file invariant
> (checklist ↔ addendum ↔ cheat-sheet) so the pack never drifts.

## Inputs you must collect first

1. **Section** — one of: Reliability, Security, Cost Optimization,
   Operational Excellence, Performance Efficiency, CAF topology, Palo
   Alto Cloud NGFW, Routing scenarios.
2. **Prefix** derived from section — `REL`, `SEC`, `COST`, `OPS`, `PERF`,
   `CAF`, `PA`, `RT`.
3. **Operation** — `add`, `update`, or `deprecate`.
4. **For `add`**: next available numeric suffix. Find it with:

   ```bash
   grep -oE '\b(REL|SEC|COST|OPS|PERF|CAF|PA|RT)-[0-9]+' *.md \
     | sort -u | grep '^<PREFIX>-' | tail -1
   ```

   Use the next integer. **Never reuse a deprecated ID.**
5. **Microsoft Learn citation** — must point to a real, currently-200
   page and a real section anchor. Verify before authoring.

## Required edits (all three or none)

### 1. `01-vwan-review-checklist.md`

Add or modify a row in the appropriate pillar / section table. Columns:

```text
ID | Control | Why it matters | Priority | Risk if gap | Evidence (path) | Suggested check | Status | Reference
```

Rules:

- `Priority` ∈ `Required` / `Recommended` / `Optional` per the
  [README Priority rubric](https://github.com/jonathan-vella/azure-vwan-review/blob/main/README.md#priority-rubric).
- `Risk if gap` ∈ `H` / `M` / `L` per the
  [README Risk rubric](https://github.com/jonathan-vella/azure-vwan-review/blob/main/README.md#risk-rubric).
- `Evidence (path)` = `<TBD>` for new controls (filled later by
  reviewers).
- `Suggested check` = short inline reference only (e.g. `see A-REL-12`).
  The full ARG query / `az` command / Portal procedure lives in the
  addendum.
- `Status` = `<TBD>` for new controls.
- `Reference` = exactly `[→ A-<ID>](02-vwan-review-addendum.md#a-<lowercase-id>)`.

**No code fences inside any cell.** Multi-line content goes to the
addendum.

### 2. `02-vwan-review-addendum.md`

Add (or update) the `### A-<ID>` block under the matching `## <Section>`
H2. Required fields:

```markdown
### A-<ID>

**Control**: One-sentence statement (must match the checklist row).
**Source**: Microsoft Learn URL with `#section-id` anchor.
**Rationale**: Why this control matters — 1-3 sentences.
**Common misconfigs**: Field-observed mistakes that motivate the check.
**Suggested check**: Full procedure. Pick the most authoritative form:

- **ARG** (preferred when available) — KQL query inside a fenced block.
- **`az` CLI** — single shell command. Tag with `ARG: not available` if
  the property is not exposed in Resource Graph.
- **REST / Portal** — last-resort, only when neither ARG nor `az` works.
```

If a control has no ARG coverage today, **explicitly tag it** so
reviewers do not waste time hunting for queries.

### 3. `03-vwan-waf-cheatsheet.md`

Add a one-line bullet under the matching pillar with a back-link to the
checklist anchor. **The cheat-sheet introduces no new controls** — it
mirrors checklist IDs only. Format:

```markdown
- Short one-line summary. → [<ID>](01-vwan-review-checklist.md#<section-slug>)
```

## Deprecation flow

If `operation = deprecate`:

- **Keep** the checklist row but set `Status` = `Deprecated` and append
  `(deprecated — see <REPLACEMENT-ID>)` to the Control column.
- **Keep** the addendum entry; add a `**Deprecation note**` line with
  the date and replacement (or "no replacement — control superseded by
  Microsoft default").
- **Remove** the cheat-sheet line.
- **Never** delete the ID. Tombstones preserve historical anchors.

## Verification (mandatory)

```bash
node scripts/verify.mjs
npx markdownlint-cli2 '*.md'
mkdocs build --strict
```

All three must pass before commit.

## Commit message

```text
docs: add <ID> — <short title>
docs: update <ID> — <reason>
docs: deprecate <ID> — superseded by <REPLACEMENT-ID>
```

## Done-when checklist

- [ ] Checklist row present with all 9 columns populated.
- [ ] Addendum `### A-<ID>` block present and reachable from the
      checklist back-link.
- [ ] Cheat-sheet line present (skip for deprecations).
- [ ] `node scripts/verify.mjs` exits 0.
- [ ] `npx markdownlint-cli2 '*.md'` exits 0.
- [ ] `mkdocs build --strict` exits 0.
- [ ] Microsoft Learn URL in the addendum returns HTTP 200 and the
      `#section-id` anchor still exists.
