# Azure Virtual WAN Architecture FAQ

> **Audience**: Architect / SME. Deep technical detail with route-table semantics,
> BGP behaviour, and NVA / SaaS deployment trade-offs.
>
> **Scope**: Follow-up questions from the
> [`jonathan-vella/azure-vwan-review`](https://github.com/jonathan-vella/azure-vwan-review)
> review checklist. Each answer cites the controlling Microsoft Learn page and,
> where relevant, the matching checklist control / addendum ID
> (`→ A-{ID}` placeholders use the upstream pack's convention; replace with the
> actual ID once the reviewer maps them).
>
> **Disclaimer**: Compiled from Microsoft Learn documentation current as of the
> publish date in the references. Always re-validate against current Learn pages
> and Palo Alto Networks documentation before committing to a design.

---

## TL;DR — Architect's decision sheet

| # | Question                                      | Short answer                                                                                                                                                                                  |
| - | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | How does vWAN default-route propagation work? | Every connection associates **and** propagates to `defaultRouteTable` by default, via the built-in `Default` label. `0.0.0.0/0` never crosses hubs.                                           |
| 2 | Should you use the vWAN default route table?  | **Yes** — and combine it with **Routing Intent**. Custom route tables are an opt-in for isolation segments, not the default.                                                                  |
| 3 | How to define routes on a VNet-link?          | Associate + propagate via labels; use `Static routes` + `Propagate static route` only for **spoke-NVA** next hops; avoid manual static routes elsewhere.                                      |
| 4 | UDR vs default RT (AWS comparison)?           | Let vWAN program routes; **add UDRs only for documented exceptions** (Private Endpoint symmetry, service-tag bypass, forced /32). Routing Intent obviates per-VNet UDRs.                       |
| 5 | VNet structure — public/private subnets?      | Azure has no "public subnet" construct. Use a **flat VNet** with subnets sized per workload; control egress via **NAT Gateway or UDR-to-firewall**; set `defaultOutboundAccess=false`.        |
| 6 | Azure Firewall + IPsec for FIX/Cisco CSR?     | **Azure Firewall does NOT terminate IPsec tunnels.** Terminate IPsec on vWAN S2S VPN GW, on **Cisco Catalyst 8000V deployed in the vWAN hub** as the supported NVA, or on a CSR in a spoke.   |
| 7 | Private LB + DNAT-at-firewall in vWAN?        | **Yes.** Azure Firewall (all SKUs) and Palo Alto Cloud NGFW both support DNAT to an internal/private LB in a spoke. Routing Intent guarantees return-path symmetry.                           |
| 8 | Single entry/exit — SaaS only, or NVA-in-VNet?| Three patterns are supported. **Preferred for vWAN: Secured Hub** (Azure Firewall, supported NVA, or SaaS NGFW). **NVA-in-spoke** works but loses Routing-Intent benefits and adds UDR sprawl. |

---

## 1. How does Azure Virtual WAN default-route propagation work?

### Mechanics

Every Virtual WAN Standard hub has **two built-in route tables**:

- **`defaultRouteTable`** — system-created, **cannot be deleted**. Every new
  connection is automatically **associated** and **propagated** to it.
- **`noneRouteTable`** — used when a connection should not propagate any routes.

When a connection is created (VPN, ExpressRoute, P2S, or Hub-to-VNet), three
things happen by default:

1. The connection's **association** is set to `defaultRouteTable` — i.e. the
   traffic *out of* that connection follows the routes in this table.
2. The connection's **propagation** targets the `Default` **label** (a logical
   group). The `Default` label includes the `defaultRouteTable` of **every hub**
   in the Virtual WAN.
3. Routes learned from the connection (CIDRs from a VNet's address space,
   BGP-learned prefixes from on-prem) are advertised into every hub's
   `defaultRouteTable`, achieving any-to-any transit.

> *Source*: [About virtual hub routing — Connections, Association, Propagation, Labels](https://learn.microsoft.com/en-us/azure/virtual-wan/about-virtual-hub-routing#concepts).

### BGP underneath

The hub router is a managed BGP speaker (per-hub `Asn=65515`). VPN/ER/P2S
gateways and BGP-peered NVAs exchange routes with the hub router; the hub then
re-advertises learned prefixes per label/route-table policy. **Static routes you
add to a route table always take precedence over dynamically learned routes for
the same prefix.**

### Key behaviour to remember

- **`0.0.0.0/0` is hub-local**. The default route is **never** propagated
  between hubs. If you need Internet egress through a security solution in each
  hub, you must enable an Internet Routing Policy **per hub**.
  *Source*: [About virtual hub routing — Additional considerations](https://learn.microsoft.com/en-us/azure/virtual-wan/about-virtual-hub-routing#additional-considerations).
- **You cannot inject a route equal to or more-specific than the spoke VNet's
  own address space.** vWAN cannot attract traffic between two subnets in the
  same VNet.
- **All branch connections (S2S, ER, P2S) must associate to the same route
  table.** Mixing — e.g. some spokes through the firewall, others bypassing — is
  not supported in a single hub. Use multiple hubs or routing-intent
  configurations for this.

> **Checklist mapping**: see upstream control rows tagged routing / `Default
> route table` / `→ A-{ID}` in [`02-vwan-review-addendum.md`](https://github.com/jonathan-vella/azure-vwan-review/blob/main/02-vwan-review-addendum.md).

---

## 2. Is it recommended to use the vWAN default route table, or is custom always better?

### Recommendation

**Use `defaultRouteTable` as the primary route table** for every connection,
and layer **Routing Intent + Routing Policies** on top of it to enforce
inspection through Azure Firewall / NVA / SaaS NGFW.

### Why `defaultRouteTable` is the right default

- It is the **only route table compatible with Routing Intent** —
  Routing Intent **requires** there to be no custom route tables and no
  Virtual-Network-Connection static routes in the `defaultRouteTable`.
  *Source*: [Routing intent — Considerations / Prerequisites](https://learn.microsoft.com/en-us/azure/virtual-wan/how-to-routing-policies#considerations).
- When Routing Intent is enabled, vWAN automatically writes
  `_policy_PrivateTraffic` (10/8, 172.16/12, 192.168/16) and
  `_policy_PublicTraffic` (0.0.0.0/0) into the `defaultRouteTable` with next-hop
  = your security solution.
- Inter-hub inspection is **only** available with Routing Intent enabled on every
  hub. Without it, branch-to-branch traffic between hubs cannot be inspected.

### When custom route tables ARE warranted

- **Strict isolation segments** that must never see other tenants' prefixes
  (e.g. PCI / regulated zones, M&A integration networks). You associate the
  isolated spokes to a custom route table that does not propagate to others.
- **Shared-services**-pattern designs where one group of spokes must reach a
  services VNet but not each other — implementable via custom route tables +
  selective propagation labels.
- **Hub-spoke vWAN migrations** retaining isolation parity from legacy designs.

> ⚠️ **One-way door**: enabling Routing Intent **irreversibly rewrites** the
> `defaultRouteTable`. Save a snapshot of route tables, connections, and
> gateways before enabling. There is no automatic rollback.
> *Source*: [Routing intent — Rollback strategy](https://learn.microsoft.com/en-us/azure/virtual-wan/how-to-routing-policies#considerations).

> **Checklist mapping**: upstream pack flags Routing Intent as a *High-risk
> one-way door* in the routing decision matrix.

---

## 3. How should we define routes on a VNet-link (Hub-to-VNet) connection?

A VNet-link connection has five routing-related controls. The architect-level
guidance for each:

| Setting                          | Recommended value                                  | Notes                                                                                                                                                                                                       |
| -------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Associate route table**        | `defaultRouteTable` (default)                      | Required for Routing Intent compatibility. Change only for opt-in isolation segments.                                                                                                                       |
| **Propagate to none**            | `No` (default)                                     | Set `Yes` only for "stub" spokes that must not advertise their prefixes to siblings (e.g. landing-zone sandbox).                                                                                            |
| **Propagate to labels**          | `Default` label                                    | Auto-applied when "Propagate to none" is No. Use custom labels only when you have multi-tenant labels (e.g. `prod`, `dev`) corresponding to custom route tables.                                            |
| **Static routes** (next-hop IP)  | **Avoid** unless you have an **NVA in this spoke** | Single next-hop IP per static route. Use for the "NVA-in-spoke" pattern where vWAN must steer hub traffic to a spoke-resident appliance.                                                                    |
| **Propagate static route**       | `Yes` *only if* the static route should advertise inter-hub | Without this, static routes are local to the hub. Required if the spoke NVA terminates a regional egress that other regions must reach. **Note**: `0.0.0.0/0` static routes never propagate across hubs.    |
| **Bypass next-hop IP** for VNet  | `Yes` (recommended) when NVA and workload share a VNet | Prevents flow loops where workloads in the same VNet are forced through their own NVA. Configurable only at connection creation — delete and re-create to change. |

> *Source*: [How to configure virtual hub routing — Configure routing for a virtual network connection](https://learn.microsoft.com/en-us/azure/virtual-wan/how-to-virtual-hub-routing#configure-routing-for-a-virtual-network-connection)
> and [bypass next-hop IP](https://learn.microsoft.com/en-us/azure/virtual-wan/howto-connect-vnet-hub#bypassexplained).

### Edge cases the addendum should call out

- **Routing Intent + static routes**: With Routing Intent + Private policy
  enabled and `Propagate static route = Yes` on the connection, the bypass-next-hop
  flag is **ignored** and treated as `bypass/equals`. Traffic destined to the
  static-route prefix is inspected by the hub firewall and then forwarded to the
  spoke directly — bypassing the static next-hop IP. Verify any spoke-NVA
  routing assumption against this behaviour.
- **BGP-peered NVAs in spokes**: System routes for spoke-VNet prefixes always
  beat BGP-learned routes — you cannot override them via the BGP peering, only
  via explicit static routes on the connection.

---

## 4. UDRs in vWAN spokes vs. default route table (and the AWS comparison)

### The 1-line answer

**Let vWAN program routes; add UDRs only for documented exceptions.** In a
Routing-Intent-enabled vWAN, the platform pushes effective routes into every
spoke's subnet route table automatically — you do not need per-VNet route tables
the way you do in AWS.

### Why this differs from AWS

| Concept              | AWS                                              | Azure Virtual WAN                                                                                |
| -------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Per-VPC route tables | **Mandatory** — every subnet has one             | Optional — Azure auto-programs subnet routes from the hub                                        |
| Default route        | Static `0.0.0.0/0 → IGW/NAT/TGW` per subnet      | Programmed by vWAN when Routing Intent (Internet policy) is enabled — **no per-subnet UDR needed** |
| Transit              | Transit Gateway with explicit route propagation  | Hub router with BGP + labels; propagation is implicit via `Default` label                         |
| Inspection           | TGW + GWLB + appliance, requires custom routes   | Routing Intent declares intent; routes are managed by the platform                               |

### When UDRs ARE still required in vWAN spokes

UDRs (User Defined Routes) on spoke subnets are an **exception** mechanism.
Document each one in the design:

1. **Private Endpoint symmetry** — when Private Endpoints are deployed in a
   spoke and the hub has private Routing Intent enabled, traffic from on-prem to
   the Private Endpoint bypasses the firewall by default. Enable **Network
   Policy for route tables on the PE subnet** to ensure symmetric inspection.
   `/32` routes in "Private Traffic Prefixes" do **not** restore symmetry.
   *Source*: [Routing intent — Troubleshooting data path](https://learn.microsoft.com/en-us/azure/virtual-wan/how-to-routing-policies#troubleshooting).
2. **Service-tag bypass** — UDRs with destination = Service Tag and next-hop
   `Internet` to bypass the firewall for Azure-managed PaaS dependencies
   (e.g. `AzureMonitor`, `Storage.<region>`). Note this breaks if the subnet is
   set to **private** (no default outbound) — you must use Service Endpoints or
   Private Endpoints instead.
3. **Forced /32 to a local NVA** for east-west microsegmentation inside the
   spoke (rare in vWAN — usually handled in the hub).
4. **"Propagate gateway routes" must be ON** on any user-defined spoke route
   table; otherwise vWAN-programmed routes are blocked.
   *Source*: [Routing intent — user-defined route tables](https://learn.microsoft.com/en-us/azure/virtual-wan/how-to-routing-policies#troubleshooting).

### Goal: minimize static-route sprawl

If your team is consciously trying to reduce static-route usage (the customer's
stated requirement), the design pattern that delivers the lowest static-route
footprint is:

> **Routing Intent (Private + Internet) on every hub + Default Route Table only +
> Bypass-Next-Hop set per VNet-connection + NO custom route tables + NO subnet
> UDRs except the documented exceptions above.**

This matches the upstream pack's "Centralized routing intent" pillar.

---

## 5. How should we structure the spoke VNet — subnets, "public" vs "private"?

### Azure does not have AWS-style "public" / "private" subnets

There is no Azure subnet attribute that makes a subnet "Internet-facing" or
"isolated" by routing. Internet reachability is determined by:

- **Outbound** — presence of NAT Gateway / standard LB outbound rules / instance
  public IP / **default outbound access** (deprecated by Microsoft).
- **Inbound** — presence of a Public IP on a NIC, Application Gateway with public
  frontend, or Azure Firewall DNAT pointing at a private IP.

### Recommended subnet structure for a vWAN spoke

A spoke VNet attached to a vWAN hub should typically have:

| Subnet                       | Purpose                                                   | Notes                                                                                                                          |
| ---------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `snet-app-tier`              | Application workloads (VMs, VMSS, AKS nodes, App Service VNet-injection) | `defaultOutboundAccess = false`. NSG enforces tier policy. Outbound via firewall DNAT/SNAT in hub.                            |
| `snet-data-tier`             | Databases, internal caches                                | No public IP. Private Endpoints for Azure PaaS only. NSG denies all but app-tier source.                                       |
| `snet-pe`                    | Dedicated subnet for Private Endpoints                    | Disable network policies if you need NSG/route-table on PE. Enable **route-table network policies** when hub Routing Intent is on. |
| `snet-ingress-appgw` (opt.)  | Application Gateway / WAF or internal LB                  | Only if ingress is direct to this VNet (rare — most ingress flows via hub DNAT).                                               |
| `AzureBastionSubnet` (opt.)  | Bastion Host                                              | Per-spoke Bastion is rarely needed; centralized in a management spoke.                                                         |

### Make subnets `private` (default outbound = false)

For new VNets created via APIs released after **March 31, 2026**, subnets are
**private by default**. Treat that as the target state today:

```bicep
resource subnet 'Microsoft.Network/virtualNetworks/subnets@2024-05-01' = {
  // ...
  properties: {
    addressPrefix: '10.10.1.0/24'
    defaultOutboundAccess: false  // disable platform default outbound IP
    // route tables, NSG, etc.
  }
}
```

This forces an **explicit egress** path (NAT GW, hub firewall via Routing Intent,
or service endpoint), which is what you want for centralized inspection.

> *Source*: [Default outbound access in Azure — Private subnets overview](https://learn.microsoft.com/en-us/azure/virtual-network/ip-services/default-outbound-access).

### What NOT to do

- **Don't** put NVAs in every spoke. East-west inspection belongs in the hub.
- **Don't** add `0.0.0.0/0 → Internet` UDRs to "open" a subnet — instead let the
  hub firewall + Routing Intent advertise the default route.
- **Don't** assume sizing parity with AWS subnets. Azure subnets reserve 5 IPs
  per subnet (first 4 + broadcast); a `/29` is the practical minimum.

---

## 6. Azure Firewall + IPsec for FIX clients connected via Cisco CSR (single-armed SaaS scenario)

### The hard constraint

**Azure Firewall does not terminate IPsec tunnels** — none of the Basic /
Standard / Premium SKUs include IPsec VPN gateway functionality. The Azure
Firewall feature matrix lists DNAT, SNAT, FQDN filtering, IDPS, TLS inspection
(Premium) — **no IPsec termination**.

> *Source*: [Azure Firewall features by SKU](https://learn.microsoft.com/en-us/azure/firewall/features-by-sku) (review the comparison table — no IPsec row exists).

Likewise, **Palo Alto Cloud NGFW (SaaS) in vWAN does not terminate IPsec**.
It is a bump-in-the-wire inspector for traffic already on the Azure fabric.

### What CAN terminate the FIX-client IPsec tunnels in vWAN

You have three architecturally valid options:

#### Option A — vWAN Site-to-Site VPN Gateway (Microsoft-managed)

- Native vWAN component; runs in the hub; supports IKEv2 + IPsec.
- Scales via *VPN Scale Units*; pricing is per scale unit.
- Best fit when FIX endpoints are on standard VPN-capable devices and policies
  align with what vWAN S2S supports.
- Routing Intent + Private Policy then inspects all FIX traffic via the hub
  firewall.

#### Option B — Cisco Catalyst 8000V (or other supported NVA) **inside the vWAN hub**

- Cisco SD-WAN (`ciscosdwan` / `cisco-tdv-vwan-nva`) is **a supported
  Marketplace NVA** for Virtual WAN hub deployment. This replaces the older
  CSR-1000V in single-armed designs.
- Deployed via Managed Application; integrates with hub routing; Routing Intent
  can use a Next-Generation Firewall or dual-role NVA as next-hop.
- This is the cleanest "single-armed in a SaaS-like managed model" pattern that
  still terminates IPsec for FIX clients.
- *Source*: [About NVAs in a Virtual WAN hub — Partners](https://learn.microsoft.com/en-us/azure/virtual-wan/about-nva-hub#partners).

#### Option C — Cisco CSR / Catalyst 8000V in a spoke VNet (your current single-armed pattern)

- Deploy CSR in a dedicated spoke VNet with one NIC (single-armed); FIX clients
  IPsec to the CSR's public IP.
- Spoke connects to the vWAN hub; hub's Routing Intent / Firewall does
  east-west inspection of decrypted traffic.
- **Important caveat**: with Routing Intent on the hub, the spoke-NVA pattern
  requires either BGP peering from the CSR to the hub, or static routes on the
  VNet-connection with `Propagate static route = Yes`. Plan carefully — and
  remember the static-route + bypass-next-hop edge case from FAQ #3.

### How they compare for "single-armed SaaS" intent

| Option                       | Single-armed? | SaaS-managed? | Terminates IPsec? | Integrates with Routing Intent?           |
| ---------------------------- | ------------- | ------------- | ----------------- | ----------------------------------------- |
| Azure Firewall (any SKU)     | n/a           | Yes           | **No**            | Yes                                       |
| Palo Alto Cloud NGFW (SaaS)  | n/a           | Yes           | **No**            | Yes                                       |
| vWAN S2S VPN Gateway         | Yes           | Yes (managed) | **Yes**           | Yes                                       |
| Cisco Catalyst 8000V in hub  | Yes           | Yes (managed app) | **Yes**       | Yes (as `cisco-tdv-vwan-nva` next-hop)    |
| Cisco CSR in spoke VNet      | Yes           | No (self-managed) | **Yes**       | Partial — needs static routes / BGP peer  |

### Recommended path for FIX/IPsec in a vWAN SaaS-style design

1. **Prefer vWAN S2S VPN Gateway** if FIX endpoints support route-based IPsec
   with the offered parameters.
2. If FIX clients require Cisco-specific IPsec features (e.g. GET-VPN, custom
   crypto sets), use **Cisco Catalyst 8000V deployed in the vWAN hub** as the
   IPsec terminator + SD-WAN dual-role NVA.
3. Use **Option C** (CSR in spoke) only if you must reuse an existing CSR config
   image and cannot deploy via the Marketplace managed application.

> **Checklist mapping**: upstream pack's "IPsec termination" controls in the
> connectivity pillar; addendum likely tags this as `ARG: not available — use az
> CLI / REST / Portal` for verification.

---

## 7. Can we fully deploy private application + network load balancers in a vWAN environment with DNAT at the firewall?

**Yes — this is the standard secured-hub ingress pattern.** Both Azure Firewall
and Palo Alto Cloud NGFW support DNAT in a vWAN secured hub.

### Pattern (DNAT to internal LB in a spoke)

```text
Internet client
    │  443
    ▼
Azure Firewall / Cloud NGFW (public IP, in vWAN hub)
    │  DNAT  pub:443  →  10.20.1.10:443
    ▼
Internal Load Balancer  (private IP, in spoke VNet)
    │  rule  10.20.1.10:443  →  backend pool
    ▼
App workloads (no public IP)
```

### Supporting facts

- **Azure Firewall DNAT**: present in **all SKUs (Basic/Standard/Premium)**.
  Translates `firewall_public_ip:port` → private IP. Up to **250 public IPs**
  in the Secured Virtual Hub deployment (80 by default; BYOPIP preview raises
  to 250).
  *Source*: [Azure Firewall features by SKU — NAT](https://learn.microsoft.com/en-us/azure/firewall/features-by-sku#network-address-translation-nat)
  and [What is a secured virtual hub? — public IP limits](https://learn.microsoft.com/en-us/azure/firewall-manager/secured-virtual-hub).
- **Palo Alto Cloud NGFW DNAT**: supported as the "Internet ingress (DNAT)" use
  case. Cloud NGFW translates traffic from its public IP to a private IP in a
  local Virtual Network or on-premises.
  *Source*: [Configure Palo Alto Networks Cloud NGFW in Virtual WAN — Internet ingress (DNAT)](https://learn.microsoft.com/en-us/azure/virtual-wan/how-to-palo-alto-cloud-ngfw#internet-ingress-dnat).
- **Return path symmetry**: Routing Intent guarantees the response path from the
  LB-backed workload returns through the same firewall instance. Without
  Routing Intent, you must enable SNAT on the DNAT rule (firewall SNATs the
  client IP) so that the LB backend replies to the firewall instead of trying
  to route directly to the Internet — otherwise asymmetric drops occur.

### Design checklist

- [ ] DNAT rule lists each `pub_ip:port → private_ip:port` pair explicitly.
- [ ] SNAT enabled on the rule (or Routing Intent enabled hub-wide) for symmetry.
- [ ] Internal LB (Standard SKU) sits in a spoke VNet with a private frontend.
- [ ] Backend pool members do **not** have public IPs.
- [ ] NSG on the LB-backend subnet allows the firewall's `AzureFirewallSubnet`
      / `cloudngfw-subnet` private range.
- [ ] Spoke VNet connection's "Bypass next-hop IP" is set correctly so workloads
      in the LB-backed subnet do not loop through the firewall on east-west
      same-VNet traffic.
- [ ] **DNAT cross-hub limitation**: DNAT inbound traffic is **hub-local** —
      the firewall can only forward to local VNets / branches. Each region's
      hub needs its own DNAT entry-point.

> **Checklist mapping**: routing matrix row "Inbound DNAT via hub firewall" in
> the upstream pack.

---

## 8. Can a single entry/exit centralized-firewall design only be achieved with SaaS, or also with an NVA in a separate VNet?

**Both work. Three patterns are supported; the SaaS / in-hub NVA patterns are
strongly preferred for vWAN.**

### The three patterns

| #     | Pattern                                    | Description                                                                                                              | Routing Intent compatible? | Operational model            |
| ----- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | -------------------------- | ---------------------------- |
| **A** | **Secured vHub — Azure Firewall**          | Azure Firewall deployed directly into the vWAN hub via Azure Firewall Manager.                                            | ✅ (native)                | Fully managed (Microsoft)    |
| **B** | **Secured vHub — NVA in hub**              | Supported partner NVA (Check Point, Fortinet NGFW, Cisco TDV, Palo Alto Cloud NGFW SaaS, etc.) deployed into the vWAN hub. | ✅ (with eligible NVAs)    | Hybrid (Marketplace managed) |
| **C** | **NVA in spoke VNet** (legacy hub-spoke)   | Customer-managed NVA in a dedicated security VNet; spokes use UDRs / BGP via the NVA.                                     | Partial (workarounds)      | Self-managed                  |

### Why patterns A and B are preferred in vWAN

- **Routing Intent + Routing Policies** is the only sanctioned mechanism for
  inter-hub and branch-to-branch inspection. It requires the security solution
  to be **in the hub** (Azure FW, supported NVA, or SaaS NGFW).
- Routing Intent currently accepts only these NVAs as next-hop:
  `checkpoint`, `fortinet-ngfw`, `fortinet-ngfw-and-sdwan`, `cisco-tdv-vwan-nva`,
  and Palo Alto Cloud NGFW (as SaaS).
  *Source*: [Routing intent — Known limitations](https://learn.microsoft.com/en-us/azure/virtual-wan/how-to-routing-policies#knownlimitations).
- Automated UDR management — no need to maintain spoke route tables.
- Symmetric, AZ-aware deployment by Microsoft.

### When pattern C (NVA in spoke) is legitimate

- You require a firewall vendor / model **not on the in-hub-NVA list** (e.g.
  Cisco Firepower in an unsupported pattern, custom Linux iptables, legacy
  CSR-1000V image with custom IOS-XE config).
- You're migrating from a traditional hub-spoke topology to vWAN and need to
  keep the NVA in place for a transition window.
- You need IPsec termination for legacy clients on a CSR variant that isn't
  available as `cisco-tdv-vwan-nva` (see FAQ #6).

### Trade-offs of pattern C

| Aspect                     | Pattern A/B (in-hub)                          | Pattern C (NVA in spoke)                                       |
| -------------------------- | --------------------------------------------- | -------------------------------------------------------------- |
| UDR sprawl                 | Minimal — vWAN programs routes                | Significant — per-spoke UDRs to send traffic to NVA            |
| Branch-to-branch inspection| Native via Routing Intent                     | Manual hub routing rules + spoke BGP/static routes             |
| HA / scale                 | Microsoft-managed AZ-aware                    | Customer designs (VMSS, active-active, FlowVNet, etc.)         |
| Inter-hub transit          | Native                                        | Difficult — typically need NVA in each region's spoke          |
| Cost model                 | Per-scale-unit + per-GB                       | VM compute + license + custom HA infra                         |
| Vendor lock-in             | Limited NVA list                              | Full vendor choice                                             |
| Encryption-in-transit GW   | Encrypted ER + Routing Intent path supported  | Manual — must design symmetric routing carefully               |

### "Single entry/exit point" can be achieved by either

- **Pattern A or B** — naturally a single chokepoint per region because all
  traffic is forced through the hub firewall by Routing Intent.
- **Pattern C** — requires deliberate routing design: a 0/0 UDR on every spoke
  pointing at the NVA's load balancer in the security spoke, BGP peering from
  the NVA to the hub for east-west symmetry, and matching return-path UDRs.

> **Architect's recommendation**: choose Pattern A or B unless you have a
> specific vendor / config requirement that forces Pattern C. Document the
> reason for Pattern C in an ADR so future operators understand the deviation.

---

## Appendix — Topics commonly paired with the above questions

### A. Routing Intent / Routing Policies — quick reference

- **What it is**: a hub-level policy declaring "send all private traffic / all
  internet-bound traffic via this next-hop security resource".
- **Two policy types**: `Internet Traffic` (advertises 0/0) and
  `Private Traffic` (forces RFC1918 + any custom private prefixes through the
  security solution).
- **Prefixes managed automatically**:
  `_policy_PrivateTraffic = {10/8, 172.16/12, 192.168/16}` and
  `_policy_PublicTraffic = {0.0.0.0/0}`.
- **Address-space limit**: ≤ 600 VNet address spaces per hub (locally connected).
  Plan additional hubs at 90% (540) utilization.
- **Multiple security solutions**: separate next-hops allowed — e.g. Azure FW
  for private + NVA/SaaS for internet — but cohabiting NVA + SaaS in the same
  hub limits SaaS scale-out (shared subnet).

> *Source*: [Routing intent — Considerations](https://learn.microsoft.com/en-us/azure/virtual-wan/how-to-routing-policies#considerations).

### B. Secured vHub vs. standard hub + NVA-in-spoke

| Capability                          | Secured vHub (A/B)                              | Standard hub + NVA-in-spoke (C)        |
| ----------------------------------- | ----------------------------------------------- | -------------------------------------- |
| UDR management                      | Automatic                                        | Manual (per spoke)                     |
| Inter-hub inspection                | Routing Intent — supported                       | Custom design required                 |
| Internet egress inspection          | Built-in via Internet Traffic Policy             | Per-spoke 0/0 UDR to NVA               |
| DNAT inbound                        | Azure FW / Cloud NGFW DNAT (per-hub, local-only) | NVA-vendor DNAT (cross-region tricky)  |
| Vendor flexibility                  | Limited (supported partners only)                | Any                                    |
| HA model                            | Managed AZ-aware (Microsoft)                     | Customer-designed                      |
| Routing Intent eligible             | Yes                                              | No (workarounds with static routes)    |
| Recommended for new vWAN designs    | **Yes**                                          | Only with documented exception          |

### C. BGP behaviour and `0.0.0.0/0` propagation

- The hub router uses **BGP** internally to exchange routes with on-prem
  (S2S/ER/P2S) and any NVAs/SaaS. ASN per hub is `65515`.
- **`0.0.0.0/0` does NOT propagate between hubs.** It must be enabled per hub
  via Internet Routing Policy. Per-connection `Propagate default route`
  (sometimes shown as `Enable internet security`) controls which spokes /
  branches learn the default route.
- For **BGP-peered NVAs** in spoke VNets advertising 0/0 into the hub: the route
  is treated as a per-hub default for forced-tunnel scenarios (Internet traffic
  egresses through on-prem instead of the hub firewall). Use this only when
  compliance demands on-prem egress inspection.
- **Static routes** in `defaultRouteTable` for 0/0 always win over BGP-learned
  0/0 — but never propagate across hubs.

> *Source*: [Routing intent — Internet routing policy / Prefix advertisement](https://learn.microsoft.com/en-us/azure/virtual-wan/how-to-routing-policies#prefix-advertisement-to-on-premises).

### D. Encrypted ExpressRoute (IPsec over ER) with Routing Intent

- Supported when **Azure Firewall is the Private-Traffic next-hop** and a
  firewall rule explicitly **allows traffic between the VPN tunnel endpoints**
  (vWAN S2S VPN GW private IPs ↔ on-prem device private IPs over the ER
  Microsoft peering).
- **Performance ceiling**: ~1 Gbps per Encrypted ER VPN tunnel — because ESP
  traffic must pass through the hub firewall.
- **Optimizations**:
  - Use Azure Firewall **Premium** for higher PPS.
  - Make the tunnel-IP rule the **highest priority** in the policy.
  - **Exclude tunnel-endpoint traffic from IDPS / deep-packet inspection.**
  - Use **GCMAES256** for both IPsec encryption and integrity.
  - Configure **multiple tunnels** between the same on-prem site and the vWAN
    S2S VPN GW for aggregate throughput.

> *Source*: [Routing intent — Encrypted ExpressRoute](https://learn.microsoft.com/en-us/azure/virtual-wan/how-to-routing-policies#encrypted-expressroute).

---

## References

Primary Microsoft Learn sources used in this FAQ. Always re-validate the
specific section anchors — Microsoft refactors Learn pages frequently.

| # | Topic                                       | URL                                                                                                                                                                  |
| - | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | About virtual hub routing                   | <https://learn.microsoft.com/en-us/azure/virtual-wan/about-virtual-hub-routing>                                                                                      |
| 2 | How to configure virtual hub routing        | <https://learn.microsoft.com/en-us/azure/virtual-wan/how-to-virtual-hub-routing>                                                                                     |
| 3 | Connect VNet to hub — Bypass next-hop IP    | <https://learn.microsoft.com/en-us/azure/virtual-wan/howto-connect-vnet-hub#bypassexplained>                                                                         |
| 4 | Routing Intent and Routing Policies         | <https://learn.microsoft.com/en-us/azure/virtual-wan/how-to-routing-policies>                                                                                        |
| 5 | What is a secured virtual hub?              | <https://learn.microsoft.com/en-us/azure/firewall-manager/secured-virtual-hub>                                                                                       |
| 6 | Tutorial: Secure your virtual hub           | <https://learn.microsoft.com/en-us/azure/firewall-manager/secure-cloud-network>                                                                                      |
| 7 | About NVAs in a Virtual WAN hub             | <https://learn.microsoft.com/en-us/azure/virtual-wan/about-nva-hub>                                                                                                  |
| 8 | Palo Alto Networks Cloud NGFW in vWAN       | <https://learn.microsoft.com/en-us/azure/virtual-wan/how-to-palo-alto-cloud-ngfw>                                                                                    |
| 9 | Azure Firewall features by SKU              | <https://learn.microsoft.com/en-us/azure/firewall/features-by-sku>                                                                                                   |
| 10 | Default outbound access in Azure (subnets) | <https://learn.microsoft.com/en-us/azure/virtual-network/ip-services/default-outbound-access>                                                                        |
| 11 | CAF — Define Azure network topology        | <https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/azure-best-practices/define-an-azure-network-topology>                                       |
| 12 | CAF — Virtual WAN network topology         | <https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/azure-best-practices/virtual-wan-network-topology>                                           |
| 13 | WAF — Virtual WAN service guide            | <https://learn.microsoft.com/en-us/azure/well-architected/service-guides/azure-virtual-wan>                                                                          |
| 14 | Secure Virtual WAN landing zone            | <https://learn.microsoft.com/en-us/azure/virtual-wan/secure-virtual-wan>                                                                                             |
| 15 | Upstream review pack (checklist + addendum)| <https://github.com/jonathan-vella/azure-vwan-review>                                                                                                                |
