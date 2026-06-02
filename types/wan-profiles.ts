// =============================================================================
// wan-profiles.ts — QManager APN (WAN) Profile Management Types
// =============================================================================
// TypeScript interfaces for the AT-only APN profile system on OpenWRT
// RM520N-class modems. Profiles are persisted to a config file
// (/usrdata/qmanager/apn_profiles.json) and the displayed list is the set of
// the modem's *data* PDP contexts (IMS / SOS / other carrier contexts are
// excluded). The live WAN-bearing CID is detected per request and surfaced as
// `is_active` (the "In Use" / Internet APN) plus the top-level `internet_cid`.
//
// The legacy Casa RDB / wmmd path (auth, MTU, VLAN mapping, default route,
// IP passthrough) has been removed — those controls only ever worked on the
// RG520N Casa firmware, never on OpenWRT.
//
// Backend contract:
//   CGI endpoint: /cgi-bin/quecmanager/cellular/apn.sh
//   Config file:  /usrdata/qmanager/apn_profiles.json  (keyed by CID)
//
//   GET  AT+CGDCONT?;+CGACT?;+CGPADDR;+QMAP="WWAN"  (one round-trip)
//   POST save:   AT+COPS=2 → AT+CGDCONT=<cid>,"<pdp>","<apn>" → AT+COPS=0
//   POST toggle: AT+CGACT=<0|1>,<cid>
// =============================================================================

// --- Profile Data Model ------------------------------------------------------

/** A single APN (WAN) profile — one per data PDP context CID. */
export interface WanProfile {
  /** Profile slot index (== CID). Kept as `index` for stable row keys. */
  index: number;
  /** PDP context ID (1-6). */
  cid: number;
  /** User-defined profile name (from the config sidecar). */
  name: string;
  /** Access Point Name. */
  apn: string;
  /** PDP context type: ipv4, ipv6, ipv4v6. */
  pdp_type: string;
  /** Whether this PDP context is activated (AT+CGACT state). */
  enabled: boolean;
  /** Whether this CID is the live WAN-bearing context (the Internet APN). */
  is_active: boolean;
  /** Carrier classification — always "" here (carrier contexts are excluded). */
  apn_type: string;
}

// --- API Response Types ------------------------------------------------------

/** Response from GET /cgi-bin/quecmanager/cellular/apn.sh */
export interface WanProfilesResponse {
  success: boolean;
  max_profiles: number;
  /** The live WAN-bearing CID (== internet_cid), detected via QMAP/CGPADDR. */
  active_cid: number;
  /** The CID the ISP uses for the data connection (== active_cid). */
  internet_cid: number;
  profiles: WanProfile[];
  error?: string;
}

/** Response from POST save/toggle operations */
export interface WanProfileSaveResponse {
  success: boolean;
  error?: string;
}

// --- API Request Types -------------------------------------------------------

/** Request body for saving an APN profile (the chosen CID is sent as `index`). */
export interface WanProfileSaveRequest {
  name: string;
  apn: string;
  pdp_type: string;
}

/** Request body for toggling a profile's enabled state */
export interface WanProfileToggleRequest {
  index: number;
  enabled: boolean;
}

// --- Display Helpers ---------------------------------------------------------

/** PDP type display labels */
export const PDP_TYPE_OPTIONS = [
  { value: "ipv4", label: "IPv4" },
  { value: "ipv6", label: "IPv6" },
  { value: "ipv4v6", label: "IPv4v6" },
] as const;
