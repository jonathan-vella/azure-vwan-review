# WAF VWAN Cheat-sheet

One-page compression of the
[Microsoft WAF Virtual WAN service guide](https://learn.microsoft.com/en-us/azure/well-architected/service-guides/azure-virtual-wan)
, grouped by Well-Architected Framework pillar. Each line back-links to the matching control ID in
[`01-vwan-review-checklist.md`](01-vwan-review-checklist.md). **This file introduces no new controls** — it is
reference-only. Use the checklist for review actions; use the addendum
([`02-vwan-review-addendum.md`](02-vwan-review-addendum.md)) for full procedures.

Back to [`README.md`](README.md).

## Reliability

- Standard SKU only for production — Basic lacks zone redundancy and routing intent. → [REL-01](01-vwan-review-checklist.md#reliability)
- Deploy hubs in ≥ 2 regions, prefer Azure paired regions. → [REL-02](01-vwan-review-checklist.md#reliability)
- Size hub address space `/23` or larger; no overlap with spokes or on-prem. → [REL-03](01-vwan-review-checklist.md#reliability)
- VPN Gateway zone-redundant SKU; verify AZ flag at create. → [REL-04](01-vwan-review-checklist.md#reliability)
- S2S tunnels active-active with BGP on both. → [REL-05](01-vwan-review-checklist.md#reliability)
- Deploy VPN behind ER for failover; BGP prefers ER. → [REL-06](01-vwan-review-checklist.md#reliability)
- Routing infra units sized above baseline; hub router scales in up to 25 min. → [REL-07](01-vwan-review-checklist.md#reliability)
- P2S global VPN profile; pool sized 2× concurrent users. → [REL-08](01-vwan-review-checklist.md#reliability)
- FMA documented for region, ER, VPN, BGP, hub-router scale events. → [REL-09](01-vwan-review-checklist.md#reliability)
- Composite SLA calculated end-to-end (hub + gateway + firewall). → [REL-10](01-vwan-review-checklist.md#reliability)
- Annual DR / business-continuity test executed. → [REL-11](01-vwan-review-checklist.md#reliability)

## Security

- Apply Azure security baseline for Virtual WAN. → [SEC-01](01-vwan-review-checklist.md#security)
- Secured virtual hub with routing intent (Azure Firewall or Cloud NGFW). → [SEC-02](01-vwan-review-checklist.md#security)
- P2S = Microsoft Entra ID + Conditional Access + MFA. → [SEC-03](01-vwan-review-checklist.md#security)
- NSGs on every spoke subnet; default-deny inbound. → [SEC-04](01-vwan-review-checklist.md#security)
- Private endpoints for PaaS; no public exposure for prod data services. → [SEC-05](01-vwan-review-checklist.md#security)
- DDoS Network/IP Protection on spoke PIPs (hub PIPs not supported). → [SEC-06](01-vwan-review-checklist.md#security)
- Custom IPsec policy: AES-256-GCM + SHA-256/384; no DES/3DES/MD5. → [SEC-07](01-vwan-review-checklist.md#security)
- ExpressRoute encryption (MACsec or VPN-over-ER) for regulated data. → [SEC-08](01-vwan-review-checklist.md#security)
- Hub-to-hub encryption considered; review GA caveats and regions. → [SEC-09](01-vwan-review-checklist.md#security)
- RBAC least-privilege; custom roles where built-ins are too broad. → [SEC-10](01-vwan-review-checklist.md#security)
- Forced tunneling for P2S internet when policy requires inspection. → [SEC-11](01-vwan-review-checklist.md#security)
- Key Vault for VPN PSKs + certificates; rotation policy in place. → [SEC-12](01-vwan-review-checklist.md#security)
- Microsoft Sentinel with VWAN + Firewall data connectors. → [SEC-13](01-vwan-review-checklist.md#security)

## Cost Optimization

- Cost model built in Pricing Calculator before deployment. → [COST-01](01-vwan-review-checklist.md#cost-optimization)
- Tags enforced via Azure Policy on hubs, gateways, connections. → [COST-02](01-vwan-review-checklist.md#cost-optimization)
- Rightsize routing infra units and gateway scale units. → [COST-03](01-vwan-review-checklist.md#cost-optimization)
- Direct VNet peering for high-volume spoke-to-spoke flows. → [COST-04](01-vwan-review-checklist.md#cost-optimization)
- Review inter-region hub-to-hub egress charges. → [COST-05](01-vwan-review-checklist.md#cost-optimization)
- Budgets with 90 / 100 / 110 % alert thresholds. → [COST-06](01-vwan-review-checklist.md#cost-optimization)
- Match connection type (VPN vs ER) to workload criticality. → [COST-07](01-vwan-review-checklist.md#cost-optimization)
- Track Cloud NGFW PAYG (no VWAN NVA-IU when Cloud NGFW deployed). → [COST-08](01-vwan-review-checklist.md#cost-optimization)

## Operational Excellence

- IaC (Bicep or Terraform) for all VWAN resources; modular templates. → [OPS-01](01-vwan-review-checklist.md#operational-excellence)
- CI/CD with validation + approval gates; rollback playbook. → [OPS-02](01-vwan-review-checklist.md#operational-excellence)
- Azure Monitor Insights for VWAN enabled. → [OPS-03](01-vwan-review-checklist.md#operational-excellence)
- Diagnostic settings on hubs, gateways, firewalls → Log Analytics. → [OPS-04](01-vwan-review-checklist.md#operational-excellence)
- Connection Monitor covers hub-to-hub, hub-to-spoke, hub-to-on-prem. → [OPS-05](01-vwan-review-checklist.md#operational-excellence)
- NSG flow logs + Traffic Analytics on spoke subnets. → [OPS-06](01-vwan-review-checklist.md#operational-excellence)
- Alerts on TunnelEgressPacketDrop, BGP peer, RoutingState. → [OPS-07](01-vwan-review-checklist.md#operational-excellence)
- Gateway maintenance windows configured and staggered. → [OPS-08](01-vwan-review-checklist.md#operational-excellence)
- Azure Policy for VWAN (Basic SKU deny, P2S Entra audit, FW present). → [OPS-09](01-vwan-review-checklist.md#operational-excellence)

## Performance Efficiency

- Hubs placed close to dominant traffic origin. → [PERF-01](01-vwan-review-checklist.md#performance-efficiency)
- VPN gateway scale units sized for peak aggregate throughput. → [PERF-02](01-vwan-review-checklist.md#performance-efficiency)
- ER gateway scale units sized; FastPath evaluated where applicable. → [PERF-03](01-vwan-review-checklist.md#performance-efficiency)
- Respect hub-to-hub aggregate ~50 Gbps ceiling. → [PERF-04](01-vwan-review-checklist.md#performance-efficiency)
- GCMAES256 in custom IPsec policy to reduce gateway CPU. → [PERF-05](01-vwan-review-checklist.md#performance-efficiency)
- Hub routing preference (ER / VPN / AS Path) matches primary model. → [PERF-06](01-vwan-review-checklist.md#performance-efficiency)
- Capacity alerts at 70 % gateway utilization; resize plan at 80 %. → [PERF-07](01-vwan-review-checklist.md#performance-efficiency)
