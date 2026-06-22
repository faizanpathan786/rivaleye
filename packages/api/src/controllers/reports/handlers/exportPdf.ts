import { Elysia, t } from "elysia";
import { authPlugin } from "@/plugins/auth";
import puppeteer from "puppeteer";

export const exportPdfHandler = new Elysia()
  .use(authPlugin)
  .get("/:id/export-pdf", async ({ params, set, headers, query }) => {
    try {
      const { id } = params;
      const lens = query.lens;
      const cookieHeader = headers["cookie"] || "";

      // Forward the caller's session cookies into Puppeteer's jar so the export
      // page can authenticate its API calls (web client uses withCredentials).
      const cookies = cookieHeader
        .split(";")
        .map((c) => c.trim())
        .filter(Boolean)
        .map((c) => {
          const eq = c.indexOf("=");
          return { name: c.slice(0, eq), value: c.slice(eq + 1), domain: "localhost", path: "/" };
        })
        .filter((c) => c.name);

      let browser;
      try {
        browser = await puppeteer.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1240, height: 1600 });
        if (cookies.length > 0) await page.setCookie(...cookies);

        const baseUrl = process.env.WEB_URL || "http://localhost:4004";
        const pdfUrl = `${baseUrl}/scan-report/${id}/export-pdf${lens ? `?lens=${encodeURIComponent(lens)}` : ""}`;

        await page.goto(pdfUrl, { waitUntil: "networkidle0", timeout: 60000 });

        // Wait until the expected lenses have rendered (1 for a single dashboard,
        // 5 for the full report) instead of a loading placeholder.
        const expected = lens ? 1 : 5;
        await page
          .waitForFunction(
            (n: number) => document.querySelectorAll(".scan-export-page").length >= n,
            { timeout: 30000 },
            expected
          )
          .catch(() => {});
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const pdfBuffer = await page.pdf({
          format: "A4",
          printBackground: true,
          margin: { top: "8mm", right: "8mm", bottom: "8mm", left: "8mm" },
          displayHeaderFooter: false,
          preferCSSPageSize: false,
        });

        set.headers["Content-Type"] = "application/pdf";
        set.headers["Content-Disposition"] = `attachment; filename="report-${lens || "full"}-${id}.pdf"`;
        return pdfBuffer;
      } finally {
        if (browser) await browser.close();
      }
    } catch (error) {
      console.error("PDF export error:", error);
      set.status = 500;
      return { error: "Failed to generate PDF", details: String(error) };
    }
  }, {
    params: t.Object({ id: t.String() }),
    query: t.Object({ lens: t.Optional(t.String()) }),
    auth: { permissions: ["REPORTS_VIEW"] },
  });
