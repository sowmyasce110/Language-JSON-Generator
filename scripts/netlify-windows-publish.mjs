/**
 * Windows workaround for @netlify/plugin-nextjs onPostBuild.
 *
 * The plugin does: rename(.next -> .netlify/.next) then rename(.netlify/static -> .next).
 * On Windows this often fails with EPERM when the IDE/antivirus locks `.next`.
 * This script does the same swap with copy+delete instead of rename.
 *
 * Usage:
 *   1. Close any editor tabs under `.next/`
 *   2. npx netlify build   (OK if it fails only on "Failed publishing static content")
 *   3. node scripts/netlify-windows-publish.mjs
 *   4. npx netlify deploy --prod
 */
import { cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const publishDir = join(root, ".next");
const staticDir = join(root, ".netlify", "static");
const tempDir = join(root, ".netlify", ".next");

function fail(msg) {
  console.error(`\n[netlify-windows-publish] ${msg}\n`);
  process.exit(1);
}

if (!existsSync(staticDir)) {
  fail(
    "Missing .netlify/static. Run `npx netlify build` first (ignore publish EPERM if functions bundling succeeded)."
  );
}

if (!existsSync(publishDir)) {
  fail("Missing .next. Run `npm run build` or `npx netlify build` first.");
}

console.log("[netlify-windows-publish] Stashing .next -> .netlify/.next (copy)…");
rmSync(tempDir, { recursive: true, force: true });
cpSync(publishDir, tempDir, { recursive: true });

console.log("[netlify-windows-publish] Replacing .next with .netlify/static…");
rmSync(publishDir, { recursive: true, force: true });
cpSync(staticDir, publishDir, { recursive: true });

console.log(`
[netlify-windows-publish] Done.
Next step:
  npx netlify deploy --prod
`);
