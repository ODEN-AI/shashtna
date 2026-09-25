// Minimal resolver so `node --test` can load TypeScript sources that use the
// `@/` path alias from tsconfig.json.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const base = root + specifier.slice(2);

    for (const candidate of [base, `${base}.ts`, `${base}.tsx`]) {
      if (existsSync(candidate)) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
  }

  // Next.js subpaths (e.g. "next/server") have no ESM exports map.
  if (/^next\/[\w/-]+$/.test(specifier)) {
    return nextResolve(`${specifier}.js`, context);
  }

  return nextResolve(specifier, context);
}
