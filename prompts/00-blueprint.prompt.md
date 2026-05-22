# Blueprint: how this pack was built

> **Purpose**: historical reference. This is the construction plan used to
> build the Azure VWAN Review Pack. Read it before making structural
> changes so you understand the original scope decisions, gating phases,
> and locked confirmations.
>
> For ongoing maintenance, prefer the topic-specific prompts:
> [`refresh-sources.prompt.md`](refresh-sources.prompt.md),
> [`add-or-update-control.prompt.md`](add-or-update-control.prompt.md),
> [`verify-pack.prompt.md`](verify-pack.prompt.md).

## Output location

Repository root (this repo is the pack). Concretely:

- `README.md` — index, legend, risk / priority rubric, evidence convention.
- `01-vwan-review-checklist.md` — pillar checklists + decision matrices.
- `02-vwan-review-addendum.md` — per-control deep-dives.
- `03-vwan-waf-cheatsheet.md` — WAF VWAN service-guide cheat-sheet
  (back-links only — introduces no new controls).
- `evidence/` — customer artifact dropbox, one sub-folder per Finding-ID.

## Phase 1: source harvesting

Fetch the four anchor Microsoft Learn pages and enumerate first-hop
sub-pages worth citing. Decide in / out per page; record decisions here,
not in the published pack.

Anchor pages:

1. WAF VWAN service guide —
   <https://learn.microsoft.com/en-us/azure/well-architected/service-guides/azure-virtual-wan>
2. CAF VWAN landing-zone topology —
   <https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/azure-best-practices/virtual-wan-network-topology>
3. Secure Virtual WAN —
   <https://learn.microsoft.com/en-us/azure/virtual-wan/secure-virtual-wan>
4. Configure Palo Alto Networks Cloud NGFW in Virtual WAN —
   <https://learn.microsoft.com/en-us/azure/virtual-wan/how-to-palo-alto-cloud-ngfw>

In-scope first-hop sub-pages: About virtual hub routing, Routing intent
and routing policies, About NVA in a VWAN hub, Disaster recovery design,
VWAN limits, VPN over ExpressRoute, Migrate to Azure Virtual WAN,
Hub-virtual-network vs secured-virtual-hub comparison, Palo Alto Networks
Cloud NGFW for Azure deployment architectures.

## Phase 2 — Control inventory (gating)

Produce a flat control inventory before authoring any table.
ID prefixes (immutable once assigned):

| Prefix    | Section                |
| --------- | ---------------------- |
| `REL-NN`  | Reliability            |
| `SEC-NN`  | Security               |
| `COST-NN` | Cost Optimization      |
| `OPS-NN`  | Operational Excellence |
| `PERF-NN` | Performance Efficiency |
| `CAF-NN`  | CAF topology alignment |
| `PA-NN`   | Palo Alto Cloud NGFW   |
| `RT-NN`   | Routing scenarios      |

Review for duplicates / overlaps (Security ↔ CAF, Reliability ↔
Performance). IDs are immutable; anchors depend on them. Adding a new
control = next available number in the prefix; **never renumber**.

## Phase 3 — Doc skeleton

Create the four Markdown files. README owns status legend, risk rubric,
priority rubric, evidence convention, source authority. Checklist owns
the eight-column control table (`ID | Control | Why it matters | Priority
| Risk if gap | Evidence (path) | Suggested check | Status | Reference
→`). Addendum owns per-control deep-dives keyed by `## A-{ID}`.

**No code fences inside table cells** — they cause Word / Excel row
inflation when pasted. Multi-line `az` / ARG queries live in the
addendum.

## Phase 4 — Control content

Populate each pillar from the inventory. The pack must explicitly cover:

- Hub `/23` address-space sizing + non-overlap with all spoke and on-prem
  CIDRs.
- Default route propagation from FW / NVA to spokes (UDR-free validation).
- Network Watcher / Connection Monitor / NSG flow log coverage from spokes.
- Azure Monitor Network Insights for VWAN.
- Hub-to-hub bandwidth ceiling (~50 Gbps) and inter-region egress cost.
- ER FastPath and ER Global Reach vs VWAN transit comparison.
- Hub-to-hub encryption (GA caveats and supported regions).
- S2S VPN gateway AZ-zone deployment flag.

## Phase 5 — Palo Alto + routing

Palo Alto section: decision matrix is **Cloud NGFW SaaS vs Azure
Firewall** (when to choose which) — not VM-Series NVA. This is locked
scope. Drop NVA-IU control from inventory; Cloud NGFW is SaaS.

Routing options matrix — columns `Scenario | Recommended construct |
How to configure | Trade-offs | When NOT to use | Reference →`. Required
rows:

1. Any-to-any (default).
2. Internet egress via Azure Firewall.
3. Internet egress via Palo Alto Cloud NGFW.
4. Private inspection — single region.
5. Private inspection — inter-hub.
6. Routing intent + policies (one-way door callout).
7. ER → VNet transit (with / without Global Reach).
8. Branch-to-branch (VPN ↔ VPN, VPN ↔ ER).
9. Non-RFC1918 / overlapping private prefixes.
10. Custom route tables / labels (alternative — mutually exclusive with
    routing intent in the same hub).

## Phase 6 — Wrap and verification

1. Automated anchor-resolution check across all four Markdown files. Blocker.
2. `markdownlint-cli2` clean.
3. `mkdocs build --strict` clean (no broken internal links, no nav drift).
4. Every control row carries a Priority **and** Risk value consistent
   with the README rubric.
5. Routing matrix has 10 rows with at least one trade-off each.
6. Excel paste sanity on one pillar table — no fence-induced row
   inflation.

All gates are automated by [`scripts/verify.mjs`](https://github.com/jonathan-vella/azure-vwan-review/blob/main/scripts/verify.mjs)
and the docs CI workflow.

## Locked confirmations

- **Output path**: repo root (was originally `docs/vwan-review/` inside
  the source workspace — flattened on publish).
- **Palo Alto scope**: Cloud NGFW SaaS only. No VM-Series NVA.
- **Reference diagram**: Mermaid only, labeled "logical view — not a
  topology diagram".
- **Audience**: customer architect; Priority (Required / Recommended /
  Optional) and Risk (H / M / L) coexist.
- **Status legend**: Pass / Partial / Gap / N/A.
- **No customer specifics pre-filled** — `<TBD>` placeholders throughout.
- **No hardcoded-counts rule does not apply** here — concrete sizing
  numbers (scale units, throughput, `/23`) are explicitly encouraged.

## Decisions log (append-only)

| Date       | Change                                                  | Rationale                                             |
| ---------- | ------------------------------------------------------- | ----------------------------------------------------- |
| 2026-05-22 | Initial publish to standalone repo `azure-vwan-review`  | Public distribution separate from internal toolchain. |
| 2026-05-22 | Added MkDocs Material, prompts/, verify.mjs, docs CI    | Make the pack maintainable and browseable online.     |
