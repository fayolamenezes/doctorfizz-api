// src/lib/seo/providers/webflow.js

/**
 * Webflow draft rendering depends on your collection fields.
 * This is a placeholder.
 *
 * payload:
 * {
 *   collectionId: "...",
 *   itemId: "...",
 *   token: "..."
 * }
 */
export async function renderWebflowDraft({ collectionId, itemId, token }) {
  if (!collectionId || !itemId || !token) {
    throw new Error("Webflow payload requires collectionId, itemId, token");
  }

  const r = await fetch(`https://api.webflow.com/v2/collections/${collectionId}/items/${itemId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "accept-version": "2.0.0",
    },
  });

  if (!r.ok) {
    throw new Error(`Webflow fetch failed (${r.status})`);
  }

  const json = await r.json();

  // You MUST adapt this to your field name.
  const html = json?.fieldData?.body || json?.fieldData?.content || "";

  return { url: "(draft)", title: json?.fieldData?.name || "", html };
}
