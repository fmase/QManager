// lib/config-backup/sections.test.ts
import { describe, it, expect } from "bun:test";
import { BACKUP_SECTIONS, computeDisabledKeys } from "./sections";

describe("sections", () => {
  it("profiles checked disables overlap group", () => {
    const d = computeDisabledKeys({
      profiles: true,
      network_mode_apn: false,
      ttl_hl: false,
      imei: false,
      sms_alerts: false,
      watchdog: false,
      bands: false,
      tower_lock: false,
    });
    expect(d.has("network_mode_apn")).toBe(true);
    expect(d.has("ttl_hl")).toBe(true);
    expect(d.has("imei")).toBe(true);
    expect(d.has("bands")).toBe(false);
  });

  it("overlap member checked disables profiles", () => {
    const d = computeDisabledKeys({
      profiles: false,
      network_mode_apn: true,
      ttl_hl: false,
      imei: false,
      sms_alerts: false,
      watchdog: false,
      bands: false,
      tower_lock: false,
    });
    expect(d.has("profiles")).toBe(true);
    expect(d.has("network_mode_apn")).toBe(false);
  });

  it("BACKUP_SECTIONS has exactly 8 entries", () => {
    expect(BACKUP_SECTIONS.length).toBe(8);
  });
});
