import Image from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { useCallback, useRef } from "react";

function ImageView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const width = node.attrs.width as number | string | null;

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const img = imgRef.current;
      if (!img) return;
      const startX = e.clientX;
      const startWidth = img.getBoundingClientRect().width;

      const onMove = (ev: MouseEvent) => {
        const next = Math.max(60, Math.round(startWidth + (ev.clientX - startX)));
        updateAttributes({ width: next });
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [updateAttributes],
  );

  return (
    <NodeViewWrapper as="span" className={`rt-image-wrap${selected ? " is-selected" : ""}`}>
      <img
        ref={imgRef}
        src={node.attrs.src}
        alt={node.attrs.alt ?? ""}
        title={node.attrs.title ?? undefined}
        width={width ?? undefined}
        style={width ? { width: typeof width === "number" ? `${width}px` : String(width) } : undefined}
        draggable={false}
      />
      {editor.isEditable && selected && (
        <span className="rt-image-handle" onMouseDown={onResizeStart} aria-label="Resize image" />
      )}
    </NodeViewWrapper>
  );
}

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => el.getAttribute("width") ?? (el as HTMLElement).style.width || null,
        renderHTML: (attrs) => {
          if (!attrs.width) return {};
          const w = typeof attrs.width === "number" ? `${attrs.width}px` : String(attrs.width);
          return { width: parseInt(w, 10) || undefined, style: `width:${w}` };
        },
      },
      height: {
        default: null,
        parseHTML: (el) => el.getAttribute("height"),
        renderHTML: (attrs) => (attrs.height ? { height: attrs.height } : {}),
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
}).configure({ inline: true, allowBase64: true });

/** Downscale a pasted/dropped image file into a compact data URL. */
export async function fileToScaledDataUrl(file: File, maxWidth = 1400): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new window.Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });
    if (img.width <= maxWidth) return dataUrl;
    const scale = maxWidth / img.width;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const isPng = file.type === "image/png";
    return canvas.toDataURL(isPng ? "image/png" : "image/jpeg", isPng ? undefined : 0.85);
  } catch {
    return dataUrl;
  }
}
