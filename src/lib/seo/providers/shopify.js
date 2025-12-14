// src/lib/seo/providers/shopify.js

/**
 * Shopify draft rendering depends on your data model.
 * This is a placeholder that you will adapt.
 *
 * payload:
 * {
 *   shopDomain: "your-shop.myshopify.com",
 *   accessToken: "...",
 *   articleId: "...",
 *   blogId: "..."
 * }
 */
export async function renderShopifyDraft({ shopDomain, accessToken, blogId, articleId }) {
  if (!shopDomain || !accessToken || !blogId || !articleId) {
    throw new Error("Shopify payload requires shopDomain, accessToken, blogId, articleId");
  }

  const url = `https://${shopDomain}/admin/api/2023-01/blogs/${blogId}/articles/${articleId}.json`;

  const r = await fetch(url, {
    headers: { "X-Shopify-Access-Token": accessToken },
  });

  if (!r.ok) {
    throw new Error(`Shopify fetch failed (${r.status})`);
  }

  const json = await r.json();
  const html = json?.article?.body_html || "";

  return { url: "(draft)", title: json?.article?.title || "", html };
}
