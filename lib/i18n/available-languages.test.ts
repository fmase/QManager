import { describe, it, expect } from "bun:test";
import {
  AVAILABLE_LANGUAGES,
  BUNDLED_CODES,
  DEFAULT_LANGUAGE,
  getLanguage,
  isRtl,
} from "./available-languages";

describe("available-languages", () => {
  it("bundles EN and zh-CN", () => {
    expect(BUNDLED_CODES).toEqual(["en", "zh-CN"]);
  });

  it("has exactly the two bundled entries for now", () => {
    expect(AVAILABLE_LANGUAGES).toHaveLength(2);
    for (const lang of AVAILABLE_LANGUAGES) {
      expect(lang.bundled).toBe(true);
    }
  });

  it("default language is English", () => {
    expect(DEFAULT_LANGUAGE).toBe("en");
  });

  it("every language carries a non-empty native name", () => {
    for (const lang of AVAILABLE_LANGUAGES) {
      expect(lang.native_name.length).toBeGreaterThan(0);
    }
  });

  it("no duplicate codes", () => {
    const codes = AVAILABLE_LANGUAGES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("getLanguage returns entry by code", () => {
    expect(getLanguage("zh-CN")?.english_name).toBe("Simplified Chinese");
    expect(getLanguage("xx")).toBeUndefined();
  });

  it("isRtl returns false for all seeded languages", () => {
    expect(isRtl("en")).toBe(false);
    expect(isRtl("zh-CN")).toBe(false);
  });
});
