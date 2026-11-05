import { NextResponse } from "next/server";

// Route Handlers must stay dynamic — never statically collected at build time.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const libreUrl =
    process.env.LIBRETRANSLATE_URL?.replace(/\/+$/, "") ||
    "http://localhost:5000";

  // Skip probing localhost from Netlify (always unreachable there).
  const skipProbe =
    process.env.NETLIFY === "true" ||
    /localhost|127\.0\.0\.1/i.test(libreUrl);

  let libreOk = false;
  if (!skipProbe) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${libreUrl}/languages`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      clearTimeout(timer);
      libreOk = res.ok;
    } catch {
      libreOk = false;
    }
  }

  return NextResponse.json({
    ok: true,
    platform: process.env.NETLIFY === "true" ? "netlify" : "local",
    libretranslate: {
      url: libreUrl,
      reachable: libreOk,
      skippedProbe: skipProbe,
      demoModeEnv: process.env.TRANSLATE_DEMO_MODE === "1",
    },
  });
}
