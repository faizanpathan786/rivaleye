import puppeteer from "puppeteer";

const WEB_URL = process.env.WEB_URL || "http://localhost:4004";
const AUTH_URL = process.env.BETTER_AUTH_URL || "http://localhost:4000";

// The session cookie is owned by the auth/API origin, while the export page
// loads from the web origin — so scope the forwarded cookies to BOTH via `url`
// (never a hardcoded domain) so it works across split web/api deployments.
function parseCookies(cookieHeader: string) {
  const pairs = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const eq = c.indexOf("=");
      return { name: c.slice(0, eq), value: c.slice(eq + 1) };
    })
    .filter((c) => c.name);
  return [WEB_URL, AUTH_URL].flatMap((url) => pairs.map((p) => ({ ...p, url })));
}

/** Render the multi-lens scan report to a PDF via headless Chrome. */
export async function renderReportPdf({
  reportId,
  lens,
  sessionCookie,
}: {
  reportId: string;
  lens?: string | null;
  sessionCookie: string;
}): Promise<Buffer> {
  const cookies = parseCookies(sessionCookie);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1240, height: 1600 });
    if (cookies.length > 0) await page.setCookie(...cookies);

    const url = `${WEB_URL}/scan-report/${reportId}/export-pdf${lens ? `?lens=${encodeURIComponent(lens)}` : ""}`;
    await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 });

    // Fail loudly if the lenses never render (e.g. auth failed) instead of
    // producing a blank PDF. 1 page for a single lens, 5 for the full report.
    const expected = lens ? 1 : 5;
    await page.waitForFunction(
      (n: number) => document.querySelectorAll(".scan-export-page").length >= n,
      { timeout: 30_000 },
      expected,
    );
    await new Promise((resolve) => setTimeout(resolve, 800));

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", right: "10mm", bottom: "16mm", left: "10mm" },
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="width:100%;font-size:8px;color:#9c958a;font-family:-apple-system,system-ui,sans-serif;padding:0 10mm;display:flex;justify-content:space-between;align-items:center;">' +
        "<span>RivalEye · Competitor perception report</span>" +
        '<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>' +
        "</div>",
      preferCSSPageSize: false,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
