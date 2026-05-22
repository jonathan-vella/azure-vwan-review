# Virtual WAN Review Addendum

Per-control deep-dive for every checklist row in [`01-vwan-review-checklist.md`](01-vwan-review-checklist.md). Each
entry covers Microsoft Learn citation, rationale, common misconfigurations, and the full suggested check (Azure
Resource Graph (ARG), `az` CLI, REST, or Portal). Entries are tagged **"ARG: not available — use `az` CLI / REST /
Portal"** where ARG does not expose the relevant property today.

Back to the [project README](https://github.com/jonathan-vella/azure-vwan-review/blob/main/README.md) ·
[`01-vwan-review-checklist.md`](01-vwan-review-checklist.md) ·
[`03-vwan-waf-cheatsheet.md`](03-vwan-waf-cheatsheet.md).

## Reliability

### A-REL-01

**Control**: VWAN Standard SKU on all production hubs.
**Source**: WAF VWAN — Reliability Configuration recommendations —
<https://learn.microsoft.com/en-us/azure/well-architected/service-guides/azure-virtual-wan#reliability>.
**Rationale**: Basic SKU lacks zone-redundant gateways, advanced routing, hub-to-hub transit, and routing intent. It
cannot meet production SLA targets.
**Common misconfigs**: Customer pilot deployed Basic for cost reasons and never migrated. Migration is **not**
in-place — requires new hub creation.
**Suggested check (ARG)**:

```kusto
resources
| where type =~ 'microsoft.network/virtualwans'
| project name, sku = tostring(properties.type), location, resourceGroup, subscriptionId
```

Expected: `sku == "Standard"` for all production VWANs.

### A-REL-02

**Control**: Multi-region hubs (≥ 2 regions; Azure paired regions preferred).
**Source**: WAF VWAN — Reliability — "Plan multiregion redundancy" — and CAF VWAN topology —
<https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/azure-best-practices/virtual-wan-network-topology>.
**Rationale**: A single-region hub is a single region failure away from total outage. Paired regions simplify DR.
**Common misconfigs**: Both hubs in non-paired regions; or second hub deployed but no on-prem failover path tested.
**Suggested check (ARG)**:

```kusto
resources
| where type =~ 'microsoft.network/virtualhubs'
| summarize hubs = make_set(name), regions = make_set(location) by tostring(properties.virtualWan.id)
```

Expected: ≥ 2 distinct regions per VWAN for production.

### A-REL-03

**Control**: Hub address space `/23` minimum; no overlap with spokes or on-prem.
**Source**: VWAN FAQ — Hub address space sizing — <https://learn.microsoft.com/en-us/azure/virtual-wan/virtual-wan-faq>.
**Rationale**: VWAN hub consumes IPs for managed gateways, route servers, and future feature additions. `/24` works
for small hubs but leaves no headroom; `/23` is the safe production floor.
**Common misconfigs**: `/26` allocations from CIDR-poor enterprises — blocks future feature enablement. Overlapping
ranges with on-prem cause silent black-holes after BGP convergence.
**Suggested check (`az` CLI)** — ARG: address prefix is exposed in `properties.addressPrefix`, but overlap analysis is
offline math:

```bash
az network vhub list -o table --query "[].{name:name, location:location, prefix:addressPrefix}"
```

Cross-check against the customer IPAM document. Tag: **automate overlap math offline**.

### A-REL-04

**Control**: VPN Gateway zone-redundant SKU.
**Source**: WAF VWAN — Reliability Configuration recommendations.
**Rationale**: Without AZ flag, gateway is pinned to a single AZ — datacenter failure = tunnel loss.
**Common misconfigs**: Created via legacy ARM template that pre-dates AZ support.
**Suggested check (`az` CLI)** — ARG: AZ deployment not directly exposed in a stable property; use control plane:

```bash
az network vpn-gateway show -n <gw> -g <rg> --query "{name:name, sku:vpnGatewayScaleUnit, ipConfigs:ipConfigurations[].publicIpAddress.id}"
```

Then check each Public IP for `zones` array. **Tag: ARG partial — use `az` for authoritative zone state.**

### A-REL-05

**Control**: S2S active-active tunnels with BGP on both.
**Source**: WAF VWAN — Reliability — "Set up site-to-site VPN tunnels in active-active configuration".
**Rationale**: Active-passive convergence adds seconds-to-minutes to failover.
**Common misconfigs**: Single tunnel deployed; or two tunnels but BGP enabled on only one.
**Suggested check (`az` CLI)**:

```bash
az network vpn-gateway connection list --gateway-name <gw> -g <rg> \
  --query "[].{name:name, conns:vpnLinkConnections[].{name:name, bgp:enableBgp, conn:connectionStatus}}"
```

Expected: two link connections per VPN site, both `enableBgp = true`.

### A-REL-06

**Control**: VPN gateway as ER backup with BGP preference.
**Source**: WAF VWAN — Reliability — "Set up VPN backup for failover".
**Rationale**: ER outages do happen (cable cuts, provider maintenance). VPN-over-internet keeps L3 alive.
**Common misconfigs**: VPN gateway deployed but no S2S configured; or BGP preference left at default and VPN wins when
both are up.
**Suggested check**: Confirm both `vpnGateway` and `expressRouteGateway` resources exist on the same hub via ARG:

```kusto
resources
| where type =~ 'microsoft.network/virtualhubs'
| project name, vpn=properties.vpnGateway.id, er=properties.expressRouteGateway.id
```

Then via `az` confirm `hubRoutingPreference` (ExpressRoute / VpnGateway / ASPath) reflects intent.

### A-REL-07

**Control**: Routing infrastructure units sized for growth.
**Source**: WAF VWAN — Reliability Configuration recommendations — "Set virtual hub routing infrastructure units".
**Rationale**: Hub router auto-scales but takes up to **25 minutes**. Sizing at baseline means traffic spikes hit
ceilings.
**Suggested check (`az` CLI)**:

```bash
az network vhub show -n <hub> -g <rg> --query "{name:name, units:virtualRouterAutoScaleConfiguration.minCapacity, sku:sku}"
```

Then compare against actual `RouterPeakUtilizationCpu` over last 30 days in Azure Monitor.

### A-REL-08

**Control**: P2S global VPN profile + 2× user-pool sizing.
**Source**: WAF VWAN — Reliability — "Design resilience for point-to-site VPN".
**Rationale**: Global profile = automatic hub selection on failover. Address pool exhaustion blocks user reconnect
during gateway redistribution.
**Suggested check**: Portal → User VPN configurations → confirm Global profile downloaded; check `addressPrefixes`
size relative to expected concurrent users.

### A-REL-09

**Control**: FMA documented for all major failure scenarios.
**Source**: WAF VWAN — Reliability — "Anticipate potential failures through failure mode analysis (FMA)".
**Rationale**: FMA documents expected blast radius and recovery action per scenario.
**Suggested check**: Customer deliverable. Required scenarios: regional outage, ER circuit failure, VPN device
failure, hub router scaling event, BGP flap. **ARG: not available — documentation artifact.**

### A-REL-10

**Control**: Composite SLA calculated.
**Source**: WAF VWAN — Reliability — "Understand SLA and composite reliability targets".
**Rationale**: 99.95 % hub routing SLA is **not** end-to-end. Add gateway + firewall + ExpressRoute provider SLAs
multiplicatively.
**Suggested check**: Customer-supplied SLA worksheet. **ARG: not available.**

### A-REL-11

**Control**: Annual DR test executed.
**Source**: WAF VWAN — Reliability — "Incorporate business continuity testing"; DR design —
<https://learn.microsoft.com/en-us/azure/virtual-wan/disaster-recovery-design>.
**Rationale**: Untested DR runbooks routinely fail under load.
**Suggested check**: Test report in `evidence/REL-11/`. **ARG: not available.**

## Security

### A-SEC-01

**Control**: Azure security baseline for Virtual WAN applied.
**Source**: Azure security baseline for VWAN —
<https://learn.microsoft.com/en-us/security/benchmark/azure/baselines/virtual-wan-security-baseline>.
**Suggested check**: Defender for Cloud → Regulatory compliance → Azure Security Benchmark → Network controls. Filter
on VWAN resource type.

### A-SEC-02

**Control**: Secured virtual hub with routing intent.
**Source**: Secure Virtual WAN — Network security —
<https://learn.microsoft.com/en-us/azure/virtual-wan/secure-virtual-wan#network-security>; routing intent —
<https://learn.microsoft.com/en-us/azure/virtual-wan/how-to-routing-policies>.
**Rationale**: Without routing intent, hub-mediated inspection requires brittle UDRs and is easy to bypass.
**Suggested check (`az` CLI)** — routing intent state is not in ARG yet:

```bash
az network vhub route-intent list --vhub-name <hub> -g <rg> -o json
```

Expected: at least one of `InternetTraffic` or `PrivateTraffic` mapped to a Next Hop of Azure Firewall or SaaS solution.

### A-SEC-03

**Control**: P2S uses Microsoft Entra ID auth + Conditional Access + MFA.
**Source**: VWAN — Configure P2S User VPN gateway for Microsoft Entra ID authentication —
<https://learn.microsoft.com/en-us/azure/virtual-wan/virtual-wan-point-to-site-azure-ad>.
**Suggested check (`az` CLI)**:

```bash
az network p2s-vpn-gateway show -n <gw> -g <rg> \
  --query "vpnServerConfiguration.vpnAuthenticationTypes"
```

Expected: `["AAD"]`. Then verify CA policy targets the Azure VPN application in Entra portal → Conditional Access.

### A-SEC-04

**Control**: NSGs on all spoke subnets with default-deny inbound.
**Source**: Secure VWAN — Network security; WAF Security configuration recommendations.
**Suggested check (ARG)**:

```kusto
resources
| where type =~ 'microsoft.network/virtualnetworks'
| mv-expand subnet = properties.subnets
| project vnet = name, subnetName = tostring(subnet.name), nsg = tostring(subnet.properties.networkSecurityGroup.id)
| where isempty(nsg)
```

Expected: empty result for production VNets. Document GatewaySubnet / AzureBastionSubnet exceptions.

### A-SEC-05

**Control**: Private endpoints for PaaS in spokes.
**Source**: WAF VWAN Security — "Establish private connectivity and protect public endpoints".
**Suggested check (ARG)**: List PaaS resources with `publicNetworkAccess` enabled:

```kusto
resources
| where type in~ ('microsoft.sql/servers','microsoft.storage/storageaccounts','microsoft.documentdb/databaseaccounts','microsoft.keyvault/vaults')
| extend pna = coalesce(tostring(properties.publicNetworkAccess), tostring(properties.publicNetworkAccessEnabled))
| where pna in~ ('Enabled','true')
| project type, name, resourceGroup, pna
```

### A-SEC-06

**Control**: DDoS Network/IP Protection on spoke public IPs.
**Source**: WAF VWAN Security — "Protect public endpoints"; note that hub PIPs do **not** support DDoS Protection.
**Suggested check (ARG)**:

```kusto
resources
| where type =~ 'microsoft.network/publicipaddresses'
| extend ddosPlan = tostring(properties.ddosSettings.ddosProtectionPlan.id), proto = tostring(properties.ddosSettings.protectionMode)
| where isempty(ddosPlan) and proto != 'Enabled'
```

Filter to spoke resource groups; ignore hub-owned PIPs.

### A-SEC-07

**Control**: Strong IPsec/IKE policy (AES-256-GCM, SHA-256/384).
**Source**: WAF VWAN Security — "Ensure encrypted connectivity"; VWAN default IPsec policies —
<https://learn.microsoft.com/en-us/azure/virtual-wan/virtual-wan-ipsec>.
**Suggested check (`az` CLI)** — custom policy lives inside the connection object:

```bash
az network vpn-gateway connection list --gateway-name <gw> -g <rg> \
  --query "[].{name:name, ipsec:vpnLinkConnections[].ipsecPolicies}"
```

Expected: `ipsecEncryption = GCMAES256`, `integrity = SHA256` or `SHA384`. **No DES, 3DES, MD5.**

### A-SEC-08

**Control**: ExpressRoute encryption for regulated workloads.
**Source**: Encryption in transit (VPN-over-ER) —
<https://learn.microsoft.com/en-us/azure/virtual-wan/vpn-over-expressroute>.
**Rationale**: ER private peering is L3 over the MS backbone but is **not** encrypted by default.
**Suggested check**: Portal → ER circuit → confirm MACsec at port or VPN-over-ER tunnel via VWAN VPN gateway.

### A-SEC-09

**Control**: Hub-to-hub encryption (where required, considering GA caveats).
**Source**: VWAN encryption announcements; review What's New for current region support.
**Suggested check**: Portal — VWAN → Hubs → Encryption tab. Confirm regional support before enabling.

### A-SEC-10

**Control**: RBAC least-privilege; custom roles where Network Contributor is too broad.
**Source**: WAF VWAN Security — "Apply RBAC".
**Suggested check (ARG)** — find broad role assignments on connectivity RG:

```kusto
authorizationresources
| where type =~ 'microsoft.authorization/roleassignments'
| where properties.scope contains '/resourceGroups/<connectivity-rg>'
| project principalId = properties.principalId, roleDefId = properties.roleDefinitionId, scope = properties.scope
```

Cross-reference role definition IDs to ensure no Owner / Contributor at hub scope.

### A-SEC-11

**Control**: Forced tunneling for P2S where required.
**Source**: <https://learn.microsoft.com/en-us/azure/virtual-wan/how-to-forced-tunnel>.
**Suggested check (`az` CLI)**:

```bash
az network p2s-vpn-gateway show -n <gw> -g <rg> --query "isRoutingPreferenceInternet, customRoutes"
```

Check that `0.0.0.0/0` is advertised to clients.

### A-SEC-12

**Control**: Key Vault for VPN PSKs and certs.
**Source**: Secure VWAN — Identity management.
**Suggested check (`az` CLI)**:

```bash
az keyvault secret list --vault-name <kv> -o table
```

Confirm secrets exist for each VPN site PSK. **ARG: not available — secrets are not surfaced by design.** Verify in
customer's secrets-handling runbook.

### A-SEC-13

**Control**: Microsoft Sentinel onboarded.
**Source**: WAF VWAN Security — "Implement security monitoring and threat detection".
**Suggested check (ARG)**:

```kusto
resources
| where type =~ 'microsoft.operationsmanagement/solutions'
| where name startswith 'SecurityInsights'
| project name, workspace = properties.workspaceResourceId
```

Then verify Azure Firewall and VWAN data connectors are enabled in Sentinel.

## Cost Optimization

### A-COST-01

**Control**: Cost model built in Pricing Calculator pre-deployment.
**Source**: WAF VWAN Cost — "Understand pricing structures".
**Suggested check**: Customer deliverable — cost-model spreadsheet. **ARG: not available.**

### A-COST-02

**Control**: Tags on VWAN resources; Policy enforces tag presence.
**Suggested check (ARG)**:

```kusto
resources
| where type in~ ('microsoft.network/virtualwans','microsoft.network/virtualhubs','microsoft.network/vpngateways','microsoft.network/expressroutegateways','microsoft.network/p2svpngateways')
| extend tagKeys = bag_keys(tags)
| where array_length(tagKeys) < 3 or not(tagKeys has 'CostCenter')
```

Adjust required tag list per customer tag contract.

### A-COST-03

**Control**: Scale-unit rightsizing.
**Suggested check**: Azure Monitor → VWAN insights → Gateway utilization workbook → review last 30/90 days. Resize
where sustained utilization is < 30 % of capacity.

### A-COST-04

**Control**: Direct VNet peering for high-volume spoke-to-spoke flows.
**Source**: WAF VWAN Cost — "Optimize routing to minimize data transfer costs".
**Suggested check (ARG)** — find peerings vs hub-mediated paths:

```kusto
resources
| where type =~ 'microsoft.network/virtualnetworks'
| mv-expand peering = properties.virtualNetworkPeerings
| project vnet = name, peer = tostring(peering.properties.remoteVirtualNetwork.id), state = tostring(peering.properties.peeringState)
```

### A-COST-05

**Control**: Inter-region hub-to-hub egress cost reviewed.
**Suggested check**: Azure Cost Management → group by `MeterSubCategory = Bandwidth` → filter on connectivity
subscription. **ARG: not available — cost data is in Cost Management.**

### A-COST-06

**Control**: Budgets at 90 / 100 / 110 %.
**Suggested check (`az` CLI)**:

```bash
az consumption budget list -o table
```

### A-COST-07

**Control**: Connection-type vs criticality alignment.
**Suggested check**: Customer-supplied connection inventory annotated with workload tier. **ARG: not available.**

### A-COST-08

**Control**: Cloud NGFW PAYG consumption tracked.
**Source**: Palo Alto Networks Cloud NGFW pricing —
<https://docs.paloaltonetworks.com/cloud-ngfw/azure/cloud-ngfw-for-azure/getting-started-with-cngfw-for-azure/pricing>.
**Suggested check**: Marketplace + Cost Management → filter on `PaloAltoNetworks.Cloudngfw` resource provider. Confirm
no VWAN NVA-IU charge present when Cloud NGFW is deployed.

## Operational Excellence

### A-OPS-01

**Control**: IaC for all VWAN resources.
**Source**: WAF VWAN OpEx — "Implement infrastructure as code (IaC) for consistent deployments".
**Suggested check**: Repository review. Confirm Bicep / Terraform modules cover hub, gateways, connections, routing
intent. **ARG: not available.**

### A-OPS-02

**Control**: CI/CD with approval gates + rollback playbook.
**Suggested check**: Pipeline definition review (Azure Pipelines `azure-pipelines.yml` or GitHub Actions). Confirm
prod stage has manual approval.

### A-OPS-03

**Control**: Azure Monitor Insights for VWAN.
**Source**: <https://learn.microsoft.com/en-us/azure/virtual-wan/azure-monitor-insights>.
**Suggested check**: Portal → Monitor → Insights hub → Virtual WAN → confirm topology renders.

### A-OPS-04

**Control**: Diagnostic settings on all VWAN resources.
**Suggested check (ARG)**:

```kusto
resources
| where type in~ ('microsoft.network/virtualhubs','microsoft.network/vpngateways','microsoft.network/expressroutegateways','microsoft.network/p2svpngateways','microsoft.network/azurefirewalls')
| join kind=leftouter (
    insightsresources
    | where type =~ 'microsoft.insights/diagnosticsettings'
    | project diagId = id, targetId = tostring(properties.targetResourceId)
) on $left.id == $right.targetId
| where isempty(diagId)
```

Expected: empty.

### A-OPS-05

**Control**: Connection Monitor coverage.
**Source**: <https://learn.microsoft.com/en-us/azure/network-watcher/connection-monitor-overview>.
**Suggested check (`az` CLI)**:

```bash
az network watcher connection-monitor list --location <region> -o table
```

Confirm test groups cover hub-to-hub, hub-to-spoke, hub-to-on-prem.

### A-OPS-06

**Control**: NSG flow logs + Traffic Analytics on spokes.
**Suggested check (ARG)**:

```kusto
resources
| where type =~ 'microsoft.network/networksecuritygroups'
| join kind=leftouter (
    resources | where type =~ 'microsoft.network/networkwatchers/flowlogs'
    | project flowLogId = id, nsgId = tostring(properties.targetResourceId)
) on $left.id == $right.nsgId
| where isempty(flowLogId)
```

### A-OPS-07

**Control**: Alerts on critical VWAN metrics.
**Suggested check (`az` CLI)**:

```bash
az monitor metrics alert list -o table --query "[?contains(scopes[0],'virtualHubs') || contains(scopes[0],'vpnGateways')]"
```

Confirm at least: `TunnelEgressPacketDropCount`, `BgpPeerStatus`, `RoutingState`.

### A-OPS-08

**Control**: Maintenance windows configured.
**Source**: WAF VWAN OpEx — "Define customer-controlled maintenance windows".
**Suggested check**: Portal → Gateway → Maintenance configurations.

### A-OPS-09

**Control**: Azure Policy applied to VWAN.
**Source**: WAF VWAN — Azure Policy section; built-in network policies —
<https://learn.microsoft.com/en-us/azure/governance/policy/samples/built-in-policies#network>.
**Suggested check (ARG)**:

```kusto
policyresources
| where type =~ 'microsoft.authorization/policyassignments'
| where properties.displayName has_any ('Virtual WAN','VPN','ExpressRoute','Firewall')
| project name, scope = properties.scope, policy = tostring(properties.policyDefinitionId)
```

## Performance Efficiency

### A-PERF-01

**Control**: Hub placement near dominant traffic.
**Source**: WAF VWAN Performance — "Optimize hub placement for minimal latency".
**Suggested check**: User-population map + branch location list cross-referenced against hub regions. **ARG: not
available — design artifact.**

### A-PERF-02

**Control**: VPN gateway scale unit sized for peak.
**Suggested check**: Azure Monitor → VPN Gateway → `TunnelBandwidth` p95 over 30 days. Scale unit × 500 Mbps must
exceed p95.

### A-PERF-03

**Control**: ER gateway scale unit sized; FastPath evaluated.
**Source**: ER FastPath — <https://learn.microsoft.com/en-us/azure/expressroute/about-fastpath>.
**Suggested check**: `BitsInPerSecond` / `BitsOutPerSecond` p95 vs gateway capacity (2 Gbps per scale unit).

### A-PERF-04

**Control**: Hub-to-hub bandwidth ceiling respected.
**Source**: VWAN limits —
<https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits#azure-virtual-wan-limits>.
**Suggested check**: Sum inter-hub bandwidth observations vs ~50 Gbps aggregate ceiling.

### A-PERF-05

**Control**: GCMAES256 IPsec to reduce CPU.
**Suggested check**: Same as A-SEC-07 — confirm `ipsecEncryption = GCMAES256` in connection custom policies.

### A-PERF-06

**Control**: Hub routing preference set.
**Source**: <https://learn.microsoft.com/en-us/azure/virtual-wan/about-virtual-hub-routing-preference>.
**Suggested check (`az` CLI)**:

```bash
az network vhub show -n <hub> -g <rg> --query hubRoutingPreference
```

Expected: `ExpressRoute` for ER-first customers; `VpnGateway` for VPN-first; `ASPath` for transit decisions.

### A-PERF-07

**Control**: Capacity alerts at 70 % / 80 %.
**Suggested check (`az` CLI)**: Same as A-OPS-07; confirm thresholds.

## CAF topology alignment

### A-CAF-01

**Control**: Connectivity-subscription placement.
**Source**: CAF VWAN topology — "Use the connectivity subscription".
**Suggested check**: Resource inventory shows VWAN, hubs, gateways, firewalls all in the same connectivity
subscription per ALZ.

### A-CAF-02

**Control**: Single resource group for all VWAN resources.
**Suggested check (ARG)**:

```kusto
resources
| where type in~ ('microsoft.network/virtualwans','microsoft.network/virtualhubs','microsoft.network/vpngateways','microsoft.network/expressroutegateways','microsoft.network/p2svpngateways','microsoft.network/azurefirewalls')
| summarize resourceGroups = make_set(resourceGroup), names = make_list(name) by subscriptionId
```

Expected: single RG per subscription.

### A-CAF-03

**Control**: Shared DDoS Network Protection plan.
**Suggested check (ARG)**:

```kusto
resources
| where type =~ 'microsoft.network/ddosprotectionplans'
| project name, resourceGroup, vnets = array_length(properties.virtualNetworks)
```

Expected: one plan per tenant; multiple VNets attached.

### A-CAF-04

**Control**: Shared services in dedicated spoke VNet (not in hub).
**Suggested check**: Topology review. **ARG: not available — design artifact.**

### A-CAF-05

**Control**: One hub per region; scale by additional in-region hubs at limits.
**Source**: VWAN limits.
**Suggested check (ARG)**:

```kusto
resources
| where type =~ 'microsoft.network/virtualhubs'
| summarize hubs = count() by location, virtualWanId = tostring(properties.virtualWan.id)
```

Expected: one hub per region unless documented scale-out justification.

### A-CAF-06

**Control**: ER Global Reach evaluated.
**Source**: <https://learn.microsoft.com/en-us/azure/expressroute/expressroute-global-reach>.
**Suggested check**: ER circuit configuration → Global Reach tab. Document decision in `evidence/CAF-06/`.

### A-CAF-07

**Control**: Brownfield migration plan documented.
**Source**: Migrate to Azure Virtual WAN —
<https://learn.microsoft.com/en-us/azure/virtual-wan/migrate-from-hub-spoke-topology>.
**Suggested check**: Customer-supplied migration runbook in `evidence/CAF-07/`.

### A-CAF-08

**Control**: Partner SD-WAN integration follows vendor guidance.
**Source**: NVAs in VWAN hub — <https://learn.microsoft.com/en-us/azure/virtual-wan/about-nva-hub>.
**Suggested check**: Vendor-supplied design doc; routing intent compatibility verified.

## Palo Alto Networks Cloud NGFW

### A-PA-01

**Control**: Resource provider registered.
**Source**:
<https://learn.microsoft.com/en-us/azure/virtual-wan/how-to-palo-alto-cloud-ngfw#register-resource-provider>.
**Suggested check (`az` CLI)**:

```bash
az provider show -n PaloAltoNetworks.Cloudngfw --query registrationState
```

Expected: `Registered`.

### A-PA-02

**Control**: Hub region in supported list; routing status Provisioned first.
**Source**:
<https://docs.paloaltonetworks.com/cloud-ngfw/azure/cloud-ngfw-for-azure/getting-started-with-cngfw-for-azure/supported-regions-and-zones>.
**Suggested check**: Portal — Virtual hub → confirm `Routing status = Provisioned` before SaaS create. Cross-check
region against PA docs.

### A-PA-03

**Control**: Routing intent uses SaaS solution as Next Hop.
**Suggested check (`az` CLI)**:

```bash
az network vhub route-intent list --vhub-name <hub> -g <rg> -o json
```

Expected: at least one policy with `destinations` covering `Internet` and/or `PrivateTraffic`, `nextHop` resolves to
the Cloud NGFW SaaS solution resource.

### A-PA-04

**Control**: Non-RFC1918 prefixes listed in Private Traffic prefixes.
**Source**: VWAN Cloud NGFW troubleshooting — Routing intent.
**Suggested check**: Portal — Routing intent and policies → Private traffic → Additional prefixes textbox. Compare
against on-prem prefix list. **Common footgun**: forget legacy `100.64.0.0/10` CGN or RFC6598 ranges.

### A-PA-05

**Control**: Policy management plane locked.
**Suggested check**: Customer architecture decision record. Options: Azure-native (rulestacks), Panorama, Strata Cloud
Manager. **ARG: not available — governance artifact.**

### A-PA-06

**Control**: Logs forwarded for SIEM correlation.
**Source**: Strata Logging Service docs.
**Suggested check**: PA console → log forwarding profile. Optional: Sentinel data connector for PAN-OS.

### A-PA-07

**Control**: DNAT ingress paths documented; default route does not propagate cross-hub.
**Source**: VWAN Cloud NGFW — "Known limitations" note.
**Suggested check**: Architecture diagram + Cloud NGFW DNAT rule export. Confirm ingress only to local VNets and
on-prem (no cross-hub assumption).

### A-PA-08

**Control**: Deletion order documented.
**Source**: VWAN Cloud NGFW — "Delete Palo Alto Networks Cloud NGFW".
**Order**: Routing intent → Cloud NGFW resource → SaaS solution → Hub. Customer runbook in `evidence/PA-08/`.

## Routing options

### A-RT-01

**Scenario**: Any-to-any default.
**Source**: About virtual hub routing — <https://learn.microsoft.com/en-us/azure/virtual-wan/about-virtual-hub-routing>.
**Notes**: Default route table is `defaultRouteTable`. All connections associate and propagate to it. No inspection.

### A-RT-02

**Scenario**: Internet egress via Azure Firewall.
**Source**: Routing intent and policies — <https://learn.microsoft.com/en-us/azure/virtual-wan/how-to-routing-policies>.
**Notes**: Azure Firewall must exist in the hub before routing intent for internet can be applied.

### A-RT-03

**Scenario**: Internet egress via Cloud NGFW.
**Source**: <https://learn.microsoft.com/en-us/azure/virtual-wan/how-to-palo-alto-cloud-ngfw#configure-routing>.
**Notes**: Per-hub Cloud NGFW required — default route does not propagate across hubs.

### A-RT-04

**Scenario**: Private inspection single region.
**Source**: Routing intent and policies.
**Notes**: Private traffic policy steers all VNet↔VNet and VNet↔on-prem to the security solution.

### A-RT-05

**Scenario**: Private inspection inter-hub.
**Notes**: Apply routing intent in both source and destination hubs. Expect ~50 Gbps aggregate hub-to-hub ceiling and
cross-region egress.

### A-RT-06

**Scenario**: Routing intent + policies (general).
**Notes**: **One-way door**: enabling routing intent in a hub disables custom route tables for that hub. Plan rollback
carefully — reverting requires reconstruction of the routing topology.

### A-RT-07

**Scenario**: ExpressRoute → VNet transit.
**Source**: VWAN ER documentation; ER FastPath; ER Global Reach.
**Notes**: ER-to-ER via VWAN transit requires Standard/Premium SKU and Global Reach-supported peering location. Local
SKU cannot use VWAN transit.

### A-RT-08

**Scenario**: Branch-to-branch (VPN↔VPN, VPN↔ER).
**Source**: VWAN global transit network architecture.
**Suggested check (`az` CLI)**:

```bash
az network vwan show -n <vwan> -g <rg> --query allowBranchToBranchTraffic
```

Expected: `true` when branch transit required.

### A-RT-09

**Scenario**: Non-RFC1918 / overlapping private prefixes.
**Source**: VWAN Cloud NGFW Troubleshooting — Routing intent.
**Notes**: Add explicit non-RFC1918 prefixes; otherwise routing intent treats them as Internet and either egresses
incorrectly or drops.

### A-RT-10

**Scenario**: Custom route tables / labels (alternative).
**Source**: About virtual hub routing.
**Notes**: Mutually exclusive with routing intent in the same hub. Choose one per hub. Routing intent is simpler;
custom RTs are more flexible.
