import { Node, mergeAttributes } from "@tiptap/core";
import { Document } from "@tiptap/extension-document";

// Keep an element's inline style exactly as the converter wrote it (position, size, font)
const rawStyle = {
  default: null,
  parseHTML: (el: HTMLElement) => el.getAttribute("style"),
  renderHTML: (attrs: Record<string, unknown>) => (attrs.style ? { style: attrs.style } : {}),
};

/**
 * One PDF page: `<div data-type="page" data-page="1" style="position: relative; width: …; height: …">`.
 * Its size and the document's base font are inline styles, so the saved HTML
 * lays out the same way anywhere. The grey gap and shadow between pages are
 * editor-only CSS (index.css).
 */
export const PageNode = Node.create({
  name: "page",
  group: "page",
  content: "frame*",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      pageNumber: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-page"),
        renderHTML: (attrs) => (attrs.pageNumber ? { "data-page": attrs.pageNumber } : {}),
      },
      style: rawStyle,
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="page"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "page" }), 0];
  },
});

/**
 * One block placed at its exact spot on the page:
 * `<div data-type="frame" style="position: absolute; left: …; top: …; width: …">`.
 * It holds normal editable content (a heading, a paragraph, an image).
 */
export const FrameNode = Node.create({
  name: "frame",
  group: "frame",
  content: "block+",
  defining: true,
  // Keeps Backspace/Delete at a frame's edge from merging it into the next frame
  isolating: true,

  addAttributes() {
    return { style: rawStyle };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="frame"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "frame" }), 0];
  },
});

// The document is a list of pages; content without page/frame wrappers is wrapped automatically
export const PageDocument = Document.extend({
  content: "page+",
});
