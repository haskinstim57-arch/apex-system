import { Router } from "express";
import { getDb } from "../db";
import { accounts, landingPages } from "../../drizzle/schema";
import { and, eq, sql } from "drizzle-orm";

export const publicPagesRouter = Router();

/**
 * Public page serving endpoint: GET /p/:accountSlug/:pageSlug
 * Serves published landing pages to the public.
 */
publicPagesRouter.get("/p/:accountSlug/:pageSlug", async (req, res) => {
  try {
    const { accountSlug, pageSlug } = req.params;
    const db = await getDb();

    // Look up the account by slug
    const [account] = await db!
      .select({ id: accounts.id, name: accounts.name })
      .from(accounts)
      .where(eq(accounts.slug, accountSlug));

    if (!account) {
      return res.status(404).send(buildErrorPage("Page Not Found", "The page you're looking for doesn't exist."));
    }

    // Look up the published page
    const [page] = await db!
      .select()
      .from(landingPages)
      .where(
        and(
          eq(landingPages.accountId, account.id),
          eq(landingPages.slug, pageSlug),
          eq(landingPages.status, "published")
        )
      );

    if (!page) {
      return res.status(404).send(buildErrorPage("Page Not Found", "This page is not published or doesn't exist."));
    }

    // Increment view count (fire and forget)
    db!
      .update(landingPages)
      .set({ viewCount: sql`${landingPages.viewCount} + 1` })
      .where(eq(landingPages.id, page.id))
      .then(() => {})
      .catch(() => {});

    // Build and serve the full HTML page
    const html = buildPublicPage(page);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err: any) {
    console.error("[PublicPages] Error serving page:", err.message);
    res.status(500).send(buildErrorPage("Server Error", "Something went wrong. Please try again later."));
  }
});

function buildPublicPage(page: {
  title: string;
  metaDescription: string | null;
  htmlContent: string | null;
  cssContent: string | null;
  headerCode: string | null;
  footerCode: string | null;
  faviconUrl: string | null;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(page.title)}</title>
  ${page.metaDescription ? `<meta name="description" content="${escapeHtml(page.metaDescription)}" />` : ""}
  ${page.faviconUrl ? `<link rel="icon" href="${escapeHtml(page.faviconUrl)}" />` : ""}
  <style>
    /* Reset */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; }
    img { max-width: 100%; height: auto; }
    /* Page styles */
    ${page.cssContent || ""}
  </style>
  ${page.headerCode || ""}
</head>
<body>
  ${page.htmlContent || ""}
  ${page.footerCode || ""}
</body>
</html>`;
}

function buildErrorPage(title: string, message: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa; color: #333; }
    .container { text-align: center; padding: 2rem; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    p { color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
