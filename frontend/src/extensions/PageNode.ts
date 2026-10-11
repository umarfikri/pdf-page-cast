import { Node, mergeAttributes } from "@tiptap/core";
import { Document } from "@tiptap/extension-document";

/**
 * One page of the converted PDF: `<div data-type="page" data-page="1" ...>`.
 *
 * The page look (white sheet, grey gap, page number) comes only from the
 * `.tiptap [data-type="page"]` CSS in index.css, so the HTML from
 * `editor.getHTML()` stays plain wrapper divs with no gap markup.
 */
export const PageNode = Node.create({
  name: "page",
  group: "page",
  content: "block+",
  defining: true,
  // Keeps edits like Backspace at the start of a page from merging two pages
  isolating: true,

  addAttributes() {
    return {
      pageNumber: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-page"),
        renderHTML: (attrs) => (attrs.pageNumber ? { "data-page": attrs.pageNumber } : {}),
      },
      width: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-width"),
        renderHTML: (attrs) => (attrs.width ? { "data-width": attrs.width } : {}),
      },
      height: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-height"),
        renderHTML: (attrs) => (attrs.height ? { "data-height": attrs.height } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="page"]' }];
  },

  // Used by getHTML(): plain data attributes only, so the saved HTML has no page sizing
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "page" }), 0];
  },

  // Used only for display inside the editor: size each sheet like the PDF page
  // (px at 96 dpi; text sizes are in pt, so the scale is 1:1 with the PDF)
  addNodeView() {
    return ({ node, HTMLAttributes }) => {
      const dom = document.createElement("div");
      for (const [key, value] of Object.entries(mergeAttributes(HTMLAttributes, { "data-type": "page" }))) {
        if (value != null) dom.setAttribute(key, String(value));
      }
      if (node.attrs.width) dom.style.width = `${node.attrs.width}px`;
      if (node.attrs.height) dom.style.minHeight = `${node.attrs.height}px`;
      return { dom, contentDOM: dom };
    };
  },
});

// The document is a list of pages; content without page wrappers is wrapped into one page
export const PageDocument = Document.extend({
  content: "page+",
});
