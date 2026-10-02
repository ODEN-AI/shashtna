/**
 * Writes the Console deep-link table for the native shells from the single
 * source of truth, src/lib/console-links.ts (Phase 10B). The Android shell
 * reads the generated file; it never keeps its own copy of the routes.
 *
 *   node --experimental-strip-types --import ./tests/register-alias.mjs scripts/console-routes.ts <out-file>
 *
 * Format (one entry per line): "route <pattern>" and "query <key>".
 */
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { CONSOLE_ORIGIN, CONSOLE_URL_SCHEME } from "@/src/lib/console-api";
import { CONSOLE_QUERY_KEYS, CONSOLE_ROUTES } from "@/src/lib/console-links";

export function consoleRoutesFile() {
  return [
    "# Generated from src/lib/console-links.ts by scripts/console-routes.ts — do not edit.",
    `origin ${CONSOLE_ORIGIN}`,
    `scheme ${CONSOLE_URL_SCHEME}`,
    ...CONSOLE_ROUTES.map((route) => `route ${route.pattern}`),
    ...CONSOLE_QUERY_KEYS.map((key) => `query ${key}`),
    "",
  ].join("\n");
}

const out = process.argv[2];
if (out && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(out, consoleRoutesFile());
  console.log(`wrote ${out}`);
}
