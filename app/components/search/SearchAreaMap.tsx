import { useMemo, useState } from "react";
import { Button } from "~/components/ui/Button";

interface SearchAreaMapProps {
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
}

const BANGLADESH = { minLat: 20.5, maxLat: 26.7, minLng: 88, maxLng: 92.8 };

/**
 * A privacy-preserving map preview of the SEARCH CENTRE, not property locations.
 * Public listing coordinates are deliberately never sent to this component.
 */
export function SearchAreaMap({ latitude, longitude, radiusKm = 3 }: SearchAreaMapProps) {
  const [open, setOpen] = useState(false);
  const mapUrl = useMemo(() => {
    if (latitude === undefined || longitude === undefined || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (latitude < BANGLADESH.minLat || latitude > BANGLADESH.maxLat || longitude < BANGLADESH.minLng || longitude > BANGLADESH.maxLng) return null;
    const radius = Math.min(30, Math.max(0.5, radiusKm));
    const latDelta = Math.max(0.006, radius / 111.32);
    const lngDelta = Math.max(0.006, radius / (111.32 * Math.max(0.2, Math.cos(latitude * Math.PI / 180))));
    const left = Math.max(BANGLADESH.minLng, longitude - lngDelta);
    const right = Math.min(BANGLADESH.maxLng, longitude + lngDelta);
    const bottom = Math.max(BANGLADESH.minLat, latitude - latDelta);
    const top = Math.min(BANGLADESH.maxLat, latitude + latDelta);
    const params = new URLSearchParams({
      bbox: `${left},${bottom},${right},${top}`,
      layer: "mapnik",
      marker: `${latitude},${longitude}`,
    });
    return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
  }, [latitude, longitude, radiusKm]);

  if (!mapUrl) return null;

  return (
    <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">Map of your search area</h2>
          <p className="mt-1 text-sm text-slate-600">This map marks the point you searched around—not the exact locations of rental properties.</p>
        </div>
        <Button type="button" variant="secondary" aria-expanded={open} aria-controls="search-area-map" onClick={() => setOpen((value) => !value)}>
          {open ? "Hide map" : "Show map"}
        </Button>
      </div>
      {open ? (
        <div id="search-area-map" className="mt-3">
          <iframe
            title="OpenStreetMap showing the selected search centre"
            src={mapUrl}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-72 w-full rounded-lg border border-slate-200 sm:h-96"
          />
          <p className="mt-2 text-xs text-slate-500">Map tiles are provided by OpenStreetMap. The rental properties’ exact pins remain private.</p>
          <a className="mt-2 inline-flex min-h-11 items-center font-semibold text-brand-800 underline" href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=14/${latitude}/${longitude}`} target="_blank" rel="noopener noreferrer">Open larger map ↗</a>
        </div>
      ) : null}
    </div>
  );
}
