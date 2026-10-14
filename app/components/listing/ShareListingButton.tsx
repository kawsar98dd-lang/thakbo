import { useState } from "react";
import { Button } from "~/components/ui/Button";

interface ShareListingButtonProps {
  title: string;
}

/** Share the public listing URL without exposing private address or owner-only information. */
export function ShareListingButton({ title }: ShareListingButtonProps) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const share = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    setMessage("");

    if (typeof navigator.share === "function") {
      setBusy(true);
      try {
        await navigator.share({ title: `${title} | THAKBO`, text: `Found this place on THAKBO: ${title}`, url });
        setMessage("Share sheet opened.");
      } catch (error) {
        // A user closing the native share sheet is not an application error.
        if (error instanceof Error && error.name === "AbortError") return;
        setMessage("Could not open the share menu. You can copy the page address from your browser.");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(url);
        setMessage("Listing link copied. You can paste it into a message.");
      } catch {
        setMessage("Copy was blocked by your browser. Copy the page address from the address bar instead.");
      }
      return;
    }

    setMessage("Copy the page address from your browser to share this listing.");
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="secondary" onClick={share} loading={busy} aria-label={`Share ${title}`}>
        Share listing
      </Button>
      {message ? <p className="max-w-56 text-xs text-slate-600" role="status">{message}</p> : null}
    </div>
  );
}
