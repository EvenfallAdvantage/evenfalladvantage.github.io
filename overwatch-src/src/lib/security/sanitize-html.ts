import DOMPurify from "dompurify";
import { stripTags } from "./index";

/**
 * Sanitize HTML content using DOMPurify.
 * Allows safe formatting tags while stripping scripts, event handlers,
 * iframes, objects, embeds, and other dangerous constructs.
 *
 * Use this for any user/DB-sourced HTML rendered via dangerouslySetInnerHTML.
 */
export function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") {
    // SSR fallback: strip all tags (DOMPurify requires a DOM)
    return stripTags(html);
  }
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "b", "i", "em", "strong", "u", "s", "p", "br", "hr",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li", "a", "img", "blockquote", "pre", "code",
      "table", "thead", "tbody", "tr", "th", "td",
      "span", "div", "figure", "figcaption", "sup", "sub",
    ],
    ALLOWED_ATTR: [
      "href", "src", "alt", "title", "class", "style",
      "width", "height", "target", "rel", "data-embed-url",
    ],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ["target"],
  });
}
