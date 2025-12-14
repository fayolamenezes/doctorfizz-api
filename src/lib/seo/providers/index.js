// src/lib/seo/providers/index.js

import { renderWordPressDraft } from "./wordpress";
import { renderShopifyDraft } from "./shopify";
import { renderWebflowDraft } from "./webflow";

export async function renderDraft({ provider, payload }) {
  if (provider === "wordpress") return renderWordPressDraft(payload);
  if (provider === "shopify") return renderShopifyDraft(payload);
  if (provider === "webflow") return renderWebflowDraft(payload);

  throw new Error(`Unsupported provider: ${provider}`);
}
