import { useState } from "react";
import { Button } from "~/components/ui/Button";
import { Alert } from "~/components/ui/Alert";
import { checkCoordinates, describeLocationError, parseLocationInput } from "~/lib/coordinates";

interface LocationPickerProps {
  latitude: string;
  longitude: string;
  error?: string;
}

type Message = { tone: "info" | "error" | "success"; text: string };

function geolocationMessage(code: number): string {
  if (code === 1) return "Location permission was denied. Allow location access in your browser settings, or paste a Google Maps link instead.";
  if (code === 2) return "Your device could not find its location. Move to an open area, or paste a Google Maps link instead.";
  if (code === 3) return "Finding your location took too long. Try again, or paste a Google Maps link instead.";
  return "Your location could not be read. Paste a Google Maps link instead.";
}

/**
 * Collects the exact point of the place WITHOUT asking anyone to type latitude/longitude:
 *  1. "Use my current location" (browser geolocation, nothing is sent anywhere until the form is saved), or
 *  2. paste a Google Maps link (read locally in the browser; the server never opens the link).
 * The chosen point travels in two hidden fields. This is the owner's own private data: the public site never shows it.
 */
export function LocationPicker({ latitude, longitude, error }: LocationPickerProps) {
  const [lat, setLat] = useState(latitude);
  const [lng, setLng] = useState(longitude);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const hasPoint = lat !== "" && lng !== "";

  const accept = (nextLat: number, nextLng: number, text: string) => {
    setLat(String(nextLat));
    setLng(String(nextLng));
    setMessage({ tone: "success", text });
  };

  const useCurrentLocation = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setMessage({ tone: "error", text: "This browser cannot share your location. Paste a Google Maps link instead." });
      return;
    }
    setBusy(true);
    setMessage({ tone: "info", text: "Finding your location…" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setBusy(false);
        const checked = checkCoordinates(position.coords.latitude, position.coords.longitude);
        if (!checked.ok) {
          setMessage({ tone: "error", text: checked.error });
          return;
        }
        const meters = Math.round(position.coords.accuracy);
        const note = meters > 300 ? ` The accuracy is only about ${meters} m, so consider moving outside and trying again.` : "";
        accept(checked.latitude, checked.longitude, `Location captured (accuracy about ${meters} m). Check it on the map, then save.${note}`);
      },
      (failure) => {
        setBusy(false);
        setMessage({ tone: "error", text: geolocationMessage(failure.code) });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const useLink = () => {
    const parsed = parseLocationInput(link);
    if (!parsed.ok) {
      setMessage({ tone: "error", text: describeLocationError(parsed.reason) });
      return;
    }
    accept(parsed.latitude, parsed.longitude, "Location read from the link. Check it on the map, then save.");
  };

  return (
    <div className="space-y-3">
      <input type="hidden" name="latitude" value={lat} />
      <input type="hidden" name="longitude" value={lng} />
      <div>
        <p className="text-sm font-medium text-slate-800">সঠিক অবস্থান / Exact location</p>
        <p className="text-xs text-slate-600">Only you and our moderators see the exact point. Visitors never see it.</p>
      </div>

      {hasPoint ? (
        <p className="text-sm text-slate-800">
          Location chosen.{" "}
          <a className="font-medium text-brand-800 underline" href={`https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`} target="_blank" rel="noopener noreferrer">
            Check it on the map
          </a>
        </p>
      ) : (
        <p className="text-sm text-slate-700">No location chosen yet. It is needed before you can submit the listing.</p>
      )}

      <Button type="button" variant="secondary" onClick={useCurrentLocation} loading={busy}>
        {hasPoint ? "Use my current location again" : "Use my current location"}
      </Button>

      <div className="space-y-1.5">
        <label htmlFor="locationLink" className="block text-sm font-medium text-slate-800">
          Or paste a Google Maps link
        </label>
        <div className="flex gap-2">
          <input
            id="locationLink"
            name="locationLink"
            type="text"
            inputMode="url"
            autoComplete="off"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://www.google.com/maps/…"
            className="block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 placeholder:text-slate-400"
          />
          <Button type="button" variant="secondary" onClick={useLink}>
            Use link
          </Button>
        </div>
      </div>

      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
    </div>
  );
}
