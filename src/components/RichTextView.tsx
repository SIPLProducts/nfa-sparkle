import DOMPurify from "dompurify";
import { useMemo } from "react";
import { toEditorHtml } from "@/components/RichTextEditor";
import { cn } from "@/lib/utils";

const ALLOWED_TAGS = [
  "p","br","strong","b","em","i","u","s","span","h1","h2","h3","h4","ul","ol","li",
  "blockquote","hr","a","code","pre",
  "table","thead","tbody","tfoot","tr","th","td","colgroup","col","img","figure","figcaption",
];

export function RichTextView({ html, className }: { html: string; className?: string }) {
  const clean = useMemo(
    () =>
      DOMPurify.sanitize(toEditorHtml(html ?? ""), {
        ALLOWED_TAGS,
        ALLOWED_ATTR: ["href", "target", "rel", "style", "class"],
        ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#|\/)/i,
      }),
    [html],
  );
  return <div className={cn("rich-content", className)} dangerouslySetInnerHTML={{ __html: clean }} />;
}
