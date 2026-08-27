import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle, FontSize } from "@tiptap/extension-text-style";
import { TableKit } from "@tiptap/extension-table";
import { ResizableImage, fileToScaledDataUrl } from "@/components/rich-text/ResizableImage";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Quote, Minus, Link2, Undo2, Redo2, Heading1, Heading2, RemoveFormatting,
  Table as TableIcon, ImagePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "30px"];

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

/** Legacy rows were stored as plain text — wrap them so TipTap keeps line breaks. */
export function toEditorHtml(value: string) {
  if (!value) return "";
  if (/<[a-z][\s\S]*>/i.test(value)) return value;
  return value
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br />").replace(/</g, "&lt;")}</p>`)
    .join("");
}

export function htmlToPlainText(html: string) {
  if (!html) return "";
  return html
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<\/(td|th)>\s*(?=<(td|th)\b)/gi, "\t")
    .replace(/<\/(tr|table)>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|blockquote|td|th)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

export function RichTextEditor({ value, onChange, placeholder, className, minHeight = "240px" }: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
      TextStyle,
      FontSize,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TableKit.configure({ table: { resizable: true, allowTableNodeSelection: true } }),
      ResizableImage,
    ],
    content: toEditorHtml(value),
    editorProps: {
      attributes: {
        class: "rich-content focus:outline-none px-3 py-2",
        style: `min-height:${minHeight}`,
        "data-placeholder": placeholder ?? "",
      },
      handlePaste: (view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (!files.length) return false;
        event.preventDefault();
        void insertImageFiles(files);
        return true;
      },
      handleDrop: (view, event) => {
        const dt = (event as DragEvent).dataTransfer;
        const files = Array.from(dt?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (!files.length) return false;
        event.preventDefault();
        void insertImageFiles(files);
        return true;
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  async function insertImageFiles(files: File[]) {
    if (!editor) return;
    for (const file of files) {
      const src = await fileToScaledDataUrl(file);
      editor.chain().focus().setImage({ src }).run();
    }
  }

  useEffect(() => {
    if (!editor) return;
    const incoming = toEditorHtml(value);
    if (incoming !== editor.getHTML()) editor.commands.setContent(incoming, { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) {
    return <div className={cn("rounded-md border border-input bg-background", className)} style={{ minHeight }} />;
  }

  const Tool = ({
    active, onClick, label, children, disabled,
  }: { active?: boolean; onClick: () => void; label: string; children: React.ReactNode; disabled?: boolean }) => (
    <Button
      type="button" variant="ghost" size="icon" title={label} aria-label={label} disabled={disabled}
      onClick={onClick}
      className={cn("h-8 w-8 rounded-sm", active && "bg-secondary text-secondary-foreground")}
    >
      {children}
    </Button>
  );

  const currentSize = (editor.getAttributes("textStyle").fontSize as string | undefined) ?? "default";

  return (
    <div className={cn("overflow-hidden rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring", className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 px-1.5 py-1">
        <Tool label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></Tool>
        <Tool label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></Tool>
        <Tool label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></Tool>
        <Tool label="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></Tool>
        <Divider />
        <Select
          value={currentSize}
          onValueChange={(v) => (v === "default" ? editor.chain().focus().unsetFontSize().run() : editor.chain().focus().setFontSize(v).run())}
        >
          <SelectTrigger className="h-8 w-[92px] text-xs"><SelectValue placeholder="Size" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default</SelectItem>
            {FONT_SIZES.map((s) => <SelectItem key={s} value={s}>{s.replace("px", "")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Tool label="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="h-4 w-4" /></Tool>
        <Tool label="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></Tool>
        <Divider />
        <Tool label="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft className="h-4 w-4" /></Tool>
        <Tool label="Align center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter className="h-4 w-4" /></Tool>
        <Tool label="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight className="h-4 w-4" /></Tool>
        <Tool label="Justify" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()}><AlignJustify className="h-4 w-4" /></Tool>
        <Divider />
        <Tool label="Bulleted list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></Tool>
        <Tool label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></Tool>
        <Tool label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></Tool>
        <Tool label="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="h-4 w-4" /></Tool>
        <Tool
          label="Insert link"
          active={editor.isActive("link")}
          onClick={() => {
            const prev = (editor.getAttributes("link").href as string) ?? "";
            const url = window.prompt("Link URL", prev);
            if (url === null) return;
            if (!url.trim()) { editor.chain().focus().unsetLink().run(); return; }
            editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
          }}
        ><Link2 className="h-4 w-4" /></Tool>
        <Divider />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button" variant="ghost" size="icon" title="Table" aria-label="Table"
              className={cn("h-8 w-8 rounded-sm", editor.isActive("table") && "bg-secondary text-secondary-foreground")}
            >
              <TableIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onSelect={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
              Insert table (3 × 3)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!editor.can().addRowBefore()} onSelect={() => editor.chain().focus().addRowBefore().run()}>Add row above</DropdownMenuItem>
            <DropdownMenuItem disabled={!editor.can().addRowAfter()} onSelect={() => editor.chain().focus().addRowAfter().run()}>Add row below</DropdownMenuItem>
            <DropdownMenuItem disabled={!editor.can().deleteRow()} onSelect={() => editor.chain().focus().deleteRow().run()}>Delete row</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!editor.can().addColumnBefore()} onSelect={() => editor.chain().focus().addColumnBefore().run()}>Add column left</DropdownMenuItem>
            <DropdownMenuItem disabled={!editor.can().addColumnAfter()} onSelect={() => editor.chain().focus().addColumnAfter().run()}>Add column right</DropdownMenuItem>
            <DropdownMenuItem disabled={!editor.can().deleteColumn()} onSelect={() => editor.chain().focus().deleteColumn().run()}>Delete column</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!editor.can().mergeOrSplit()} onSelect={() => editor.chain().focus().mergeOrSplit().run()}>Merge / split cells</DropdownMenuItem>
            <DropdownMenuItem disabled={!editor.can().toggleHeaderRow()} onSelect={() => editor.chain().focus().toggleHeaderRow().run()}>Toggle header row</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!editor.can().deleteTable()} onSelect={() => editor.chain().focus().deleteTable().run()}>Delete table</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Tool label="Insert image" onClick={() => fileInputRef.current?.click()}><ImagePlus className="h-4 w-4" /></Tool>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
            if (files.length) void insertImageFiles(files);
            e.target.value = "";
          }}
        />
        <Divider />
        <Tool label="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><RemoveFormatting className="h-4 w-4" /></Tool>
        <Tool label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 className="h-4 w-4" /></Tool>
        <Tool label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 className="h-4 w-4" /></Tool>
      </div>
      <div className="relative">
        {placeholder && editor.isEmpty && (
          <p className="pointer-events-none absolute left-3 top-2 text-sm text-muted-foreground">{placeholder}</p>
        )}
        <EditorContent editor={editor} className="max-h-[60vh] overflow-y-auto text-sm" />
      </div>
    </div>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />;
}
