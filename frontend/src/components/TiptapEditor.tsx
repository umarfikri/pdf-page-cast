import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { Link } from "@tiptap/extension-link";
import { Highlight } from "@tiptap/extension-highlight";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { Image } from "@tiptap/extension-image";
import type { BaseStyle } from "../types/document";
import { PageDocument, PageNode } from "../extensions/PageNode";

interface TiptapEditorProps {
  content: string;
  onChange: (newHtml: string) => void;
  onResetOriginal?: () => void;
  originalFileName?: string;
  baseStyle?: BaseStyle;
  // false = read-only view: no toolbar, no editing
  editable?: boolean;
}

// The converter leaves the document's body font/size/colour off each span,
// so apply them to the editor (and exported page) as the default style
function toCss(baseStyle?: BaseStyle): string {
  if (!baseStyle) return "";
  return [
    baseStyle.fontFamily && `font-family: ${baseStyle.fontFamily}`,
    baseStyle.fontSize && `font-size: ${baseStyle.fontSize}`,
    baseStyle.color && `color: ${baseStyle.color}`,
  ]
    .filter(Boolean)
    .join("; ");
}

export function TiptapEditor({
  content,
  onChange,
  onResetOriginal,
  originalFileName = "document.html",
  baseStyle,
  editable = true,
}: TiptapEditorProps) {
  const lastEmittedContentRef = useRef<string>(content);
  const baseCss = toCss(baseStyle);

  const editor = useEditor({
    editable,
    extensions: [
      StarterKit.configure({
        // Replaced by PageDocument, whose content is a list of pages
        document: false,
        heading: {
          levels: [1, 2, 3],
        },
      }),
      PageDocument,
      PageNode,
      Underline,
      Highlight.configure({
        multicolor: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-sky-600 underline cursor-pointer",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      // TextStyle + Color + FontFamily + FontSize + LineHeight + BackgroundColor
      TextStyleKit,
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
    ],
    content: content || "<p>No content available.</p>",
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastEmittedContentRef.current = html;
      onChange(html);
    },
    editorProps: {
      attributes: {
        class:
          "tiptap focus:outline-none min-h-[460px] px-4 py-6 text-slate-800 leading-relaxed font-sans text-sm sm:text-base",
        style: baseCss,
      },
    },
  });

  // Update content only when changed externally (not from onUpdate)
  useEffect(() => {
    if (editor && content && content !== lastEmittedContentRef.current) {
      lastEmittedContentRef.current = content;
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  if (!editor) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 text-sm">
          <svg className="animate-spin w-4 h-4 text-sky-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
          Loading editor...
        </div>
      </div>
    );
  }

  const text = editor.getText().trim();
  const wordCount = text ? text.split(/\s+/).length : 0;
  const charCount = editor.getText().length;

  const handleDownload = () => {
    // Figure images are served by the backend; make their URLs absolute so the file works on its own
    const htmlData = editor.getHTML().replaceAll('src="/api/', `src="${window.location.origin}/api/`);
    const fullHtmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${originalFileName.replace(/\.pdf$/i, "")}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1e293b; }
    h1 { font-size: 2rem; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
    h2 { font-size: 1.5rem; color: #1e293b; margin-top: 24px; }
    h3 { font-size: 1.25rem; color: #334155; }
    p { margin-bottom: 16px; }
    ul, ol { padding-left: 24px; margin-bottom: 16px; }
    li { margin-bottom: 6px; }
    blockquote { border-left: 4px solid #0284c7; padding-left: 16px; color: #475569; background: #f8fafc; margin: 16px 0; }
    pre { background: #0f172a; color: #f8fafc; padding: 16px; border-radius: 6px; overflow-x: auto; }
    code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
    img { display: block; max-width: 100%; height: auto; margin: 16px auto; }
    @media print { [data-type="page"] { break-after: page; } }
  </style>
</head>
<body${baseCss ? ` style="${baseCss.replace(/"/g, "&quot;")}"` : ""}>
${htmlData}
</body>
</html>`;

    const blob = new Blob([fullHtmlDocument], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = originalFileName.replace(/\.pdf$/i, "") + "_edited.html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
      {/* Toolbar */}
      {editable && (
      <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50/95 border-b border-slate-200 text-xs select-none">
        {/* Undo / Redo */}
        <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs mr-1">
          <button
            type="button"
            title="Undo (Ctrl+Z)"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-700 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 0 1 5 5v2M3 10l6-6M3 10l6 6" />
            </svg>
          </button>
          <button
            type="button"
            title="Redo (Ctrl+Y)"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-700 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11a5 5 0 0 0-5 5v2M21 10l-6-6M21 10l-6 6" />
            </svg>
          </button>
        </div>

        {/* Headings */}
        <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs mr-1">
          <button
            type="button"
            title="Normal text"
            onClick={() => editor.chain().focus().setParagraph().run()}
            className={`px-2 py-1 rounded font-medium cursor-pointer transition-colors ${
              editor.isActive("paragraph")
                ? "bg-sky-100 text-sky-800 font-semibold"
                : "hover:bg-slate-100 text-slate-700"
            }`}
          >
            P
          </button>
          <button
            type="button"
            title="Heading 1"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`px-2 py-1 rounded font-bold cursor-pointer transition-colors ${
              editor.isActive("heading", { level: 1 })
                ? "bg-sky-100 text-sky-800"
                : "hover:bg-slate-100 text-slate-700"
            }`}
          >
            H1
          </button>
          <button
            type="button"
            title="Heading 2"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`px-2 py-1 rounded font-bold cursor-pointer transition-colors ${
              editor.isActive("heading", { level: 2 })
                ? "bg-sky-100 text-sky-800"
                : "hover:bg-slate-100 text-slate-700"
            }`}
          >
            H2
          </button>
          <button
            type="button"
            title="Heading 3"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`px-2 py-1 rounded font-bold cursor-pointer transition-colors ${
              editor.isActive("heading", { level: 3 })
                ? "bg-sky-100 text-sky-800"
                : "hover:bg-slate-100 text-slate-700"
            }`}
          >
            H3
          </button>
        </div>

        {/* Basic Text Formatting */}
        <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs mr-1">
          <button
            type="button"
            title="Bold (Ctrl+B)"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`px-2 py-1 rounded font-bold cursor-pointer transition-colors ${
              editor.isActive("bold")
                ? "bg-sky-100 text-sky-800"
                : "hover:bg-slate-100 text-slate-700"
            }`}
          >
            B
          </button>
          <button
            type="button"
            title="Italic (Ctrl+I)"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`px-2 py-1 rounded italic font-serif cursor-pointer transition-colors ${
              editor.isActive("italic")
                ? "bg-sky-100 text-sky-800"
                : "hover:bg-slate-100 text-slate-700"
            }`}
          >
            I
          </button>
          <button
            type="button"
            title="Underline (Ctrl+U)"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`px-2 py-1 rounded underline cursor-pointer transition-colors ${
              editor.isActive("underline")
                ? "bg-sky-100 text-sky-800"
                : "hover:bg-slate-100 text-slate-700"
            }`}
          >
            U
          </button>
          <button
            type="button"
            title="Strikethrough"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`px-2 py-1 rounded line-through cursor-pointer transition-colors ${
              editor.isActive("strike")
                ? "bg-sky-100 text-sky-800"
                : "hover:bg-slate-100 text-slate-700"
            }`}
          >
            S
          </button>
          <button
            type="button"
            title="Highlight"
            onClick={() => editor.chain().focus().toggleHighlight({ color: "#fef08a" }).run()}
            className={`px-2 py-1 rounded cursor-pointer transition-colors ${
              editor.isActive("highlight")
                ? "bg-amber-200 text-amber-900 font-medium"
                : "hover:bg-slate-100 text-slate-700"
            }`}
          >
            <span className="bg-amber-200 px-1 py-0.5 rounded text-[11px]">HL</span>
          </button>
          <button
            type="button"
            title="Inline Code"
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`px-2 py-1 rounded font-mono text-[11px] cursor-pointer transition-colors ${
              editor.isActive("code")
                ? "bg-sky-100 text-sky-800 font-bold"
                : "hover:bg-slate-100 text-slate-700"
            }`}
          >
            &lt;/&gt;
          </button>
        </div>

        {/* Alignment */}
        <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs mr-1">
          <button
            type="button"
            title="Align Left"
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            className={`p-1.5 rounded cursor-pointer transition-colors ${
              editor.isActive({ textAlign: "left" })
                ? "bg-sky-100 text-sky-800"
                : "hover:bg-slate-100 text-slate-700"
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h12M3 18h18" />
            </svg>
          </button>
          <button
            type="button"
            title="Align Center"
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            className={`p-1.5 rounded cursor-pointer transition-colors ${
              editor.isActive({ textAlign: "center" })
                ? "bg-sky-100 text-sky-800"
                : "hover:bg-slate-100 text-slate-700"
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M6 12h12M3 18h18" />
            </svg>
          </button>
          <button
            type="button"
            title="Align Right"
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            className={`p-1.5 rounded cursor-pointer transition-colors ${
              editor.isActive({ textAlign: "right" })
                ? "bg-sky-100 text-sky-800"
                : "hover:bg-slate-100 text-slate-700"
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M9 12h12M3 18h18" />
            </svg>
          </button>
        </div>

        {/* Lists and Blocks */}
        <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs mr-1">
          <button
            type="button"
            title="Bullet List"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded cursor-pointer transition-colors ${
              editor.isActive("bulletList")
                ? "bg-sky-100 text-sky-800"
                : "hover:bg-slate-100 text-slate-700"
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
            </svg>
          </button>
          <button
            type="button"
            title="Numbered List"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded cursor-pointer transition-colors ${
              editor.isActive("orderedList")
                ? "bg-sky-100 text-sky-800"
                : "hover:bg-slate-100 text-slate-700"
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M4 14h2l-2 2h2M4 18h2v2H4" />
            </svg>
          </button>
          <button
            type="button"
            title="Blockquote"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-1.5 rounded cursor-pointer transition-colors ${
              editor.isActive("blockquote")
                ? "bg-sky-100 text-sky-800"
                : "hover:bg-slate-100 text-slate-700"
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h4a3 3 0 0 1-3 3v2a5 5 0 0 0 5-5V6H3v4zm10 0h4a3 3 0 0 1-3 3v2a5 5 0 0 0 5-5V6h-6v4z" />
            </svg>
          </button>
          <button
            type="button"
            title="Horizontal Line"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-700 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
            </svg>
          </button>
        </div>

        {/* Clear formatting & Actions */}
        <div className="flex items-center ml-auto gap-1">
          <button
            type="button"
            title="Clear formatting"
            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
            className="px-2 py-1 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Clear Format
          </button>

          {onResetOriginal && (
            <button
              type="button"
              title="Reset content"
              onClick={onResetOriginal}
              className="px-2 py-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer"
            >
              Reset Content
            </button>
          )}

          <button
            type="button"
            title="Export edited document as standalone HTML file"
            onClick={handleDownload}
            className="px-2 py-1 text-[11px] font-medium text-sky-700 bg-sky-50 border border-sky-200 rounded-lg hover:bg-sky-100 transition-colors cursor-pointer flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export .html
          </button>
        </div>
      </div>
      )}

      {/* Editor Content Area: grey canvas so each page shows as a white sheet */}
      <div className="bg-slate-100 min-h-[460px] max-h-[700px] overflow-auto">
        <EditorContent editor={editor} />
      </div>

      {/* Footer / Status bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 font-mono">
        <div className="flex items-center gap-3">
          <span>{wordCount} words</span>
          <span>•</span>
          <span>{charCount} characters</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${editable ? "bg-emerald-500" : "bg-slate-400"}`}></span>
          <span className="text-slate-600 font-sans">
            {editable ? "TipTap Visual Editor" : "Read-only · Original conversion"}
          </span>
        </div>
      </div>
    </div>
  );
}
