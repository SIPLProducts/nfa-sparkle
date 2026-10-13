import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Optional SAP company logo shared by Print Form and its read-only Preview. */
export function usePrintFormLogo(companyCode: string | undefined, open: boolean) {
  const [logoSrc, setLogoSrc] = useState<string | undefined>();
  const [logoLoading, setLogoLoading] = useState(false);

  useEffect(() => {
    if (!open || !companyCode?.trim()) {
      setLogoSrc(undefined);
      setLogoLoading(false);
      return;
    }
    const controller = new AbortController();
    setLogoSrc(undefined);
    setLogoLoading(true);
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token ?? "";
        const response = await fetch("/api/public/sap-logo", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ companyCode }),
          signal: controller.signal,
        });
        const result = await response.json() as { ok?: boolean; dataUrl?: string; message?: string; error?: string };
        if (!response.ok || !result.ok || !result.dataUrl) throw new Error(result.message || result.error || "Company logo is unavailable");
        const image = new Image();
        image.decoding = "async";
        image.src = result.dataUrl;
        await image.decode();
        if (controller.signal.aborted) return;
        if (result.dataUrl.startsWith("data:image/png")) {
          setLogoSrc(result.dataUrl);
        } else {
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("The company logo cannot be prepared");
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = "high";
          context.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight);
          setLogoSrc(canvas.toDataURL("image/png"));
        }
      } catch (error) {
        if (!controller.signal.aborted) console.warn("Optional Print Form logo could not be loaded", error);
      } finally {
        if (!controller.signal.aborted) setLogoLoading(false);
      }
    })();
    return () => controller.abort();
  }, [companyCode, open]);

  return { logoSrc, logoLoading };
}