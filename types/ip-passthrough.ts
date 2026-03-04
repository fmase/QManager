// =============================================================================
// ip-passthrough.ts — QManager IP Passthrough (IPPT) Settings Types
// =============================================================================
// TypeScript interfaces for the IP Passthrough feature.
//
// Backend contract:
//   GET/POST /cgi-bin/quecmanager/network/ip_passthrough.sh
// =============================================================================

/** Passthrough bridge mode */
export type PassthroughMode = "disabled" | "eth" | "usb";

/** USB modem protocol: 0=rmnet, 1=ecm, 2=mbim, 3=rndis */
export type UsbMode = "0" | "1" | "2" | "3";

/** DNS offloading via DHCPV4DNS */
export type DnsProxy = "enabled" | "disabled";

// --- API Responses -----------------------------------------------------------

/** Response from GET /cgi-bin/quecmanager/network/ip_passthrough.sh */
export interface IpPassthroughSettingsResponse {
  success: boolean;
  /** Current passthrough mode */
  passthrough_mode: PassthroughMode;
  /** Target device MAC — empty string when mode is disabled */
  target_mac: string;
  /** Current USB modem protocol index */
  usb_mode: UsbMode;
  /** DNS offloading status */
  dns_proxy: DnsProxy;
  /** MAC address of the browser's device (from ARP lookup, may be empty) */
  client_mac: string;
  error?: string;
}

// --- API Requests ------------------------------------------------------------

/** POST body for /cgi-bin/quecmanager/network/ip_passthrough.sh */
export interface IpPassthroughSaveRequest {
  /** "apply" to write settings, "reboot" to restart the device */
  action: "apply" | "reboot";
  /** Required when action is "apply" */
  passthrough_mode?: PassthroughMode;
  /** Required when passthrough_mode is "eth" or "usb" */
  target_mac?: string;
  /** Required when action is "apply" */
  usb_mode?: UsbMode;
  /** Required when action is "apply" */
  dns_proxy?: DnsProxy;
}

/** Response from POST /cgi-bin/quecmanager/network/ip_passthrough.sh */
export interface IpPassthroughSaveResponse {
  success: boolean;
  error?: string;
  detail?: string;
  /** True after action="apply" — signals frontend to show reboot dialog */
  reboot_required?: boolean;
}
