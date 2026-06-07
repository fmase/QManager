// =============================================================================
// wan-profiles.ts — QManager APN (WAN) Profile Management Types  (v2: 5-slot)
// =============================================================================
// TypeScript interfaces for the AT-only APN profile system on OpenWRT
// RM520N/RM551E-class modems.
//
// v2 model — "5 stored data-profile slots + mutually-exclusive activate":
//   • `profiles` is FIVE app-owned slots persisted to
//     /usrdata/qmanager/apn_profiles.json (NOT a mirror of modem CIDs).
//   • Exactly one slot is `active` at a time (radio semantics). Activating a
//     slot writes its APN to its target CID and runs an AT+COPS detach/attach
//     cycle so the carrier negotiates the new APN.
//   • `cids` is a SEPARATE list of the modem's live PDP contexts (1-6), each
//     tagged Internet / IMS / SOS — it drives the editor's CID picker. IMS/SOS
//     contexts are tagged here (not hidden) so the picker can badge + confirm.
//
// Backend contract:
//   CGI endpoint: /cgi-bin/quecmanager/cellular/apn.sh
//   Config file:  /usrdata/qmanager/apn_profiles.json  (v2: {version,active,profiles[5]})
//
//   GET  AT+CGDCONT?;+CGACT?;+CGPADDR;+QMAP="WWAN"  (one round-trip)
//   POST save:     persist a slot; re-apply to modem only if it is the active slot
//   POST activate: AT+COPS=2 → AT+CGDCONT=<cid>,"<pdp>","<apn>" → AT+COPS=0; set active
//   POST clear:    empty a slot (refused on the active slot)
// =============================================================================

// --- Profile Data Model ------------------------------------------------------

/** Carrier classification of a modem PDP context. */
export type ApnType = "" | "ims" | "emergency";

/** A single data-profile slot (one of five). */
export interface WanProfile {
  /** Slot id, 1-5. Stable row key and the POST target. */
  id: number;
  /** User-defined profile name (may be empty). */
  name: string;
  /** Access Point Name (empty = unconfigured slot). */
  apn: string;
  /** PDP context type: ipv4, ipv6, ipv4v6. */
  pdp_type: string;
  /** Target modem PDP context the slot writes to when activated (1-6). */
  cid: number;
  /** Whether this slot is the live data profile (id === active_profile). */
  is_active: boolean;
}

/** A live modem PDP context — drives the editor's CID picker (badges/confirm). */
export interface CidContext {
  /** PDP context id (1-6). */
  cid: number;
  /** Live APN string on this context ("" if undefined on the modem). */
  apn: string;
  /** Carrier classification: "" data, "ims" VoLTE, "emergency" SOS. */
  apn_type: ApnType;
  /** Whether this CID currently bears the WAN (the live Internet context). */
  is_internet: boolean;
}

// --- API Response Types ------------------------------------------------------

/** Response from GET /cgi-bin/quecmanager/cellular/apn.sh */
export interface WanProfilesResponse {
  success: boolean;
  /** Number of data-profile slots (5). */
  max_profiles: number;
  /** Id of the active slot, or 0 if none. */
  active_profile: number;
  /** The live WAN-bearing CID, detected via QMAP/CGPADDR. */
  active_cid: number;
  /** The CID the ISP uses for data (== active_cid). */
  internet_cid: number;
  /** The five data-profile slots. */
  profiles: WanProfile[];
  /** The modem's live PDP contexts (1-6), each tagged for the CID picker. */
  cids: CidContext[];
  error?: string;
}

/** Response from POST save/activate/clear operations. */
export interface WanProfileSaveResponse {
  success: boolean;
  active?: number;
  error?: string;
}

// --- API Request Types -------------------------------------------------------

/** Request body for saving a profile slot's configuration. */
export interface WanProfileSaveRequest {
  name: string;
  apn: string;
  pdp_type: string;
  /** Target modem PDP context (1-6). */
  cid: number;
}

// --- Display Helpers ---------------------------------------------------------

/** PDP type display labels */
export const PDP_TYPE_OPTIONS = [
  { value: "ipv4", label: "IPv4" },
  { value: "ipv6", label: "IPv6" },
  { value: "ipv4v6", label: "IPv4v6" },
] as const;
