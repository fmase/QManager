import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // QManager is a static export (`output: "export"`) served by the modem's
      // own web server over LAN. `next/image` requires the Next.js image
      // optimization server, which does not exist in this deployment model, and
      // with `images.unoptimized` it degrades to a plain <img> anyway. Every
      // image we serve is a small local asset from /public — there is no remote
      // provider, bandwidth cost, or LCP penalty for the rule to guard against.
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
