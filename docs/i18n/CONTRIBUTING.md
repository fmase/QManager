# Translating QManager

Thank you for helping make QManager accessible to more people. This guide walks you through adding a new language or improving an existing one.

## How translations are stored

All translations live as JSON files under `public/locales/`:

```
public/locales/
  en/               ← English is the source of truth
    common.json
    sidebar.json
    ...
  zh-CN/
    common.json
    sidebar.json
    ...
```

Each language has the same set of namespace files. Keys are identical across languages; only the values are translated.

## Adding a new language

1. **Fork the repo** and create a new branch (e.g., `i18n/add-german`).
2. **Copy the English directory**:
   ```bash
   cp -r public/locales/en public/locales/de
   ```
   Use a standard BCP-47 language code for the folder name (`de` for German, `es` for Spanish, `ja` for Japanese, `ar` for Arabic, `zh-CN` for Simplified Chinese, `zh-TW` for Traditional Chinese, etc.).
3. **Edit every JSON file** in your new directory. Translate the **values** on the right of each `":"`. **Never change the keys** on the left. Keys are identifiers the code uses to find your text.
   - Preserve placeholders like `{{cellId}}` exactly as-is.
   - Preserve plural-form siblings like `bands_locked_one` and `bands_locked_other`. Your language may need more forms (`_zero`, `_two`, `_few`, `_many`) — see the pluralization section below.
   - ARIA keys (ending in `_aria`) are for screen readers. They should describe the action, not label it visually.
4. **Register the language** in `lib/i18n/available-languages.ts`:
   ```typescript
   {
     code: "de",
     native_name: "Deutsch",
     english_name: "German",
     rtl: false,    // true only for Arabic, Hebrew, Persian, etc.
     bundled: true, // set false if you expect the pack to ship as a download, not bundled
   }
   ```
   Also add the static imports and resource entries in `lib/i18n/resources.ts` if you're bundling (EN and zh-CN are already wired as examples).
5. **Verify**:
   ```bash
   bun run i18n:check
   ```
   Fix any errors (extra keys, malformed JSON). Warnings about missing keys are OK while you're drafting.
6. **Open a pull request**. The CI runs `bun run i18n:check` and `bun tsc --noEmit`.

## Improving an existing translation

Edit the values in the JSON files directly. If you're only fixing typos, `bun run i18n:check` will pass with zero diffs in the key set.

## Conventions

- **Tone**: friendly, clear, technical but not jargon-heavy.
- **Capitalization**: follow your language's sentence-case norms, not English title-case — unless your language uses title-case for UI labels.
- **Technical terms**: keep product names, protocols, and hardware identifiers literal. These are not translated:
  - AT commands (`AT+CSQ`, `AT+CFUN=1,1`, `AT+QENG="servingcell"`, `AT+GAME`)
  - Unit codes (`dBm`, `MHz`, `ms`, `Mbps`, `Kbps`)
  - Identifiers (`APN`, `IMEI`, `ICCID`, `LTE`, `NR5G`, `B3`, `N78`)
  - IP addresses, phone numbers, MAC addresses, UCI keys
  - Product and brand names (`Tailscale`, `NetBird`, `QManager`, `OpenWRT`)
  - Log level tokens (`DEBUG`, `INFO`, `WARN`, `ERROR`)
- **Punctuation**: use native punctuation (`。` for Chinese, `«…»` for French quotes, non-breaking space before `:` in French).
- **Placeholders**: `{{variable}}` is replaced at runtime. Move it where it fits grammatically — `"Connected to {{apn}}"` might become `"{{apn}} 已连接"`.
- **Pluralization**: plural keys use `_one` / `_other` suffixes (CLDR-aware, handled natively by i18next v25+ — no ICU plugin needed). Both forms must be translated. Languages that need additional forms can add siblings with `_zero`, `_two`, `_few`, `_many` — see the [i18next plural docs](https://www.i18next.com/translation-function/plurals) for the suffix table per locale.

## Getting help

Open an issue labeled `i18n` on GitHub, or start a discussion. Pull requests for partial translations are welcome — gaps fall back to English automatically, so you don't need to translate everything at once.
