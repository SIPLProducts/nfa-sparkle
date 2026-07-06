import { useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "enfa_install_dismissed_at";
const DISMISS_DAYS = 7;

function recentlyDismissed() {
  try {
    const v = localStorage.getItem(DISMISS_KEY);
    if (!v) return false;
    const t = Number(v);
    if (!Number.isFinite(t)) return false;
    return Date.now() - t < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  const mm = window.matchMedia?.("(display-mode: standalone)").matches;
  // iOS Safari uses navigator.standalone
  const ios = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return Boolean(mm || ios);
}

function isIos() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
  // iPadOS 13+ reports as Mac; detect touch
  const iPadOS = ua.includes("Macintosh") && "ontouchend" in document;
  return iOS || iPadOS;
}

function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 820px)").matches;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone() || recentlyDismissed() || !isMobileViewport()) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    // iOS has no beforeinstallprompt — show manual instructions after a short delay
    const iosDevice = isIos();
    setIos(iosDevice);
    let t: number | undefined;
    if (iosDevice) {
      t = window.setTimeout(() => setShow(true), 1500);
    }

    const onInstalled = () => {
      setShow(false);
      setDeferred(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
      if (t) window.clearTimeout(t);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      setShow(false);
      setDeferred(null);
    } else {
      dismiss();
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] md:hidden">
      <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-3 shadow-lg ring-1 ring-black/5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-600 to-blue-600 text-white">
            <Download className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Install eNFA</div>
            {ios ? (
              <div className="mt-0.5 text-xs text-muted-foreground">
                Tap <Share className="inline h-3.5 w-3.5 -mt-0.5" aria-label="Share" /> then
                <span className="mx-1 inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">
                  <Plus className="h-3 w-3" /> Add to Home Screen
                </span>
                to install on iPhone.
              </div>
            ) : (
              <div className="mt-0.5 text-xs text-muted-foreground">
                Add eNFA to your home screen for a full-screen app experience.
              </div>
            )}
            {!ios && deferred && (
              <div className="mt-2 flex gap-2">
                <Button size="sm" className="h-8" onClick={install}>Install</Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={dismiss}>Not now</Button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss install prompt"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}