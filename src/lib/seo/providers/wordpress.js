// src/lib/seo/providers/wordpress.js

/**
 * WordPress draft rendering via WP REST API (requires auth).
 *
 * payload:
 * {
 *   siteUrl: "https://example.com",
 *   postId: 123,
 *   authBasic: "<base64(username:app_password)>"
 * }
 */
export async function renderWordPressDraft({ siteUrl, postId, authBasic }) {
  if (!siteUrl || !postId || !authBasic) {
    throw new Error("WordPress payload requires siteUrl, postId, authBasic");
  }

  const apiUrl = `${siteUrl.replace(/\/$/, "")}/wp-json/wp/v2/posts/${postId}?context=edit`;

  const r = await fetch(apiUrl, {
    headers: {
      Authorization: `Basic ${authBasic}`,
    },
  });

  if (!r.ok) {
    throw new Error(`WP draft fetch failed (${r.status})`);
  }

  const json = await r.json();

  return {
    url: "(draft)",
    title: json?.title?.rendered || "",
    html: json?.content?.rendered || "",
  };
}
