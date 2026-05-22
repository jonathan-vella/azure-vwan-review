# Azure Virtual WAN Customer Review Pack

A Well-Architected Framework + Cloud Adoption Framework checklist for reviewing customer Azure Virtual WAN (VWAN)
deployments, with Palo Alto Networks Cloud NGFW integration and a routing options decision matrix.

## Disclaimer

> **AI-generated content with human review.** The content in this pack
> (`README.md`, `01-vwan-review-checklist.md`, `02-vwan-review-addendum.md`,
> `03-vwan-waf-cheatsheet.md`) was generated with the assistance of AI and
> reviewed by a human. It may contain inaccuracies, omissions, outdated
> references, or errors — including in cited Microsoft Learn URLs, Azure
> Resource Graph / `az` CLI snippets, Palo Alto Networks Cloud NGFW behaviour,
> and Virtual WAN service limits. Always validate against current Microsoft
> and Palo Alto Networks documentation before acting on any control. This pack
> is provided **as-is, without warranty of any kind**. The author and the
> author's employer accept **no responsibility or liability** for any
> decisions, deployments, costs, outages, or security incidents arising from
> use of this material. Use at your own risk.

## How to use this pack

1. Walk the checklist in [`01-vwan-review-checklist.md`](01-vwan-review-checklist.md) pillar by pillar. For every row,
   set a **Status** and capture evidence under `evidence/`.
2. When a control needs more depth (full ARG query, `az` CLI, REST call, Portal blade), follow the `→ A-{ID}`
   back-link into [`02-vwan-review-addendum.md`](02-vwan-review-addendum.md).
3. Use [`03-vwan-waf-cheatsheet.md`](03-vwan-waf-cheatsheet.md) as a one-page reference of Microsoft's WAF VWAN
   service guide. The cheat-sheet only back-links to the checklist; it introduces no new controls.
4. Roll the gaps into the **Findings & remediation backlog** at the bottom of the checklist.

## Index

- [`01-vwan-review-checklist.md`](01-vwan-review-checklist.md) — pillar checklists (Reliability, Security, Cost, OpEx,
  Performance), CAF topology alignment, Palo Alto Cloud NGFW section, routing options matrix, findings backlog.
- [`02-vwan-review-addendum.md`](02-vwan-review-addendum.md) — per-control deep-dive: Microsoft Learn citation,
  rationale, common misconfigs, full suggested check (ARG / `az` / REST / Portal).
- [`03-vwan-waf-cheatsheet.md`](03-vwan-waf-cheatsheet.md) — WAF VWAN service guide compressed by pillar, back-linked
  to checklist IDs.
- `evidence/` — drop screenshots, `az ... -o json` exports, ARG query outputs, and customer responses here. One
  sub-folder per control ID is suggested (e.g. `evidence/REL-03/`).

## Status legend

| Status      | Meaning                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| **Pass**    | Control implemented; evidence collected.                                                                |
| **Partial** | Control partially implemented; documented exception or in-progress remediation.                         |
| **Gap**     | Control not implemented; remediation required.                                                          |
| **N/A**     | Control does not apply (e.g. ExpressRoute controls when only VPN is in use). Justification in evidence. |

## Risk rubric

Risk is **what happens if this control is missing**, independent of how mandatory the control is.

| Risk  | Definition                                                                                                                    |
| ----- | ----------------------------------------------------------------------------------------------------------------------------- |
| **H** | Data exposure, single-region outage path, hard-to-reverse design lock-in (e.g. routing intent), unrecoverable secret leakage. |
| **M** | Degraded resilience, predictable cost overrun, partial visibility loss, manual workaround required for routine ops.           |
| **L** | Hygiene, tagging, documentation, naming, non-critical monitoring gaps.                                                        |

## Priority rubric

Priority is **how mandatory** the control is for this customer's stated requirements.

| Priority        | Definition                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| **Required**    | Must comply. Failure blocks production sign-off (security baseline, compliance, multi-region SLA targets). |
| **Recommended** | Should comply. Industry best practice; exceptions must be documented.                                      |
| **Optional**    | Nice-to-have or context-dependent (e.g. P2S VPN if no remote users).                                       |

**Priority and Risk are independent.** A Recommended control can still be High risk if missing (e.g. `OPS-04`
diagnostic logs — recommended for greenfield, but missing them is an H risk for incident response). Always report
both.

## Evidence convention

- Path: `evidence/{ID}/{short-name}.{ext}` (e.g. `evidence/SEC-03/p2s-aad-config.json`).
- Prefer raw `az ... -o json` over screenshots. Screenshots only when the data is not API-addressable (e.g.
  Portal-only routing intent UI state in early previews).
- Reference the file from the checklist `Evidence (path)` column relative to this repository root (e.g.
  `evidence/SEC-03/p2s-aad-config.json`).

## Reality tags in the addendum

Some controls have no Azure Resource Graph (ARG) coverage today. Those addendum entries are tagged **"ARG: not
available — use `az` CLI / REST / Portal"** so reviewers do not waste time hunting for a query that does not exist.

## Reference diagram

The checklist embeds a **logical Mermaid view** of a Secured VWAN hub with Cloud NGFW. It is explicitly labeled
"logical view — not a topology diagram"; it omits address spaces, AZ placement, and physical paths intentionally.

## Source authority

Every control's `→ A-{ID}` entry cites a specific Microsoft Learn page section (or the linked Palo Alto Networks Cloud
NGFW deployment docs). The four anchor pages:

1. WAF VWAN service guide — <https://learn.microsoft.com/en-us/azure/well-architected/service-guides/azure-virtual-wan>
2. CAF VWAN landing-zone topology —
   <https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/azure-best-practices/virtual-wan-network-topology>
3. Secure Virtual WAN — <https://learn.microsoft.com/en-us/azure/virtual-wan/secure-virtual-wan>
4. Configure Palo Alto Networks Cloud NGFW in Virtual WAN —
   <https://learn.microsoft.com/en-us/azure/virtual-wan/how-to-palo-alto-cloud-ngfw>

First-hop sub-pages enumerated during source harvesting (in-scope where cited): About virtual hub routing, How to
configure routing intent and routing policies, About NVA in a VWAN hub, Disaster recovery design for VWAN, VWAN
limits, Encryption in transit (VPN over ExpressRoute), Migrate to Azure Virtual WAN, Hub-virtual-network vs
secured-virtual-hub comparison, Palo Alto Networks Cloud NGFW for Azure deployment architectures.

## Conversion to Word/Excel

All tables are pure Markdown — no code fences inside cells — so they paste cleanly into Word and Excel without row
inflation. Multi-line commands and long ARG queries live in the addendum entries, not in the checklist cells.

## Scope and exclusions

- **In scope**: VWAN Standard hub, VPN/ExpressRoute/P2S gateways, secured virtual hub with Azure Firewall or Cloud
  NGFW, routing intent and policies, custom route tables, CAF connectivity-subscription placement.
- **Out of scope**: Palo Alto VM-Series NVA in the VWAN hub (excluded per project scope — Cloud NGFW SaaS only);
  SD-WAN partner appliances in the hub (covered only at the CAF-topology level); on-premises device hardening.
