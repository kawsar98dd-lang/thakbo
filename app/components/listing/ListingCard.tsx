import { Link } from "react-router";
import { Badge } from "~/components/ui/Badge";
import { Card } from "~/components/ui/Card";
import { AVAILABILITY_LABELS, PROPERTY_TYPE_LABELS } from "~/lib/constants";
import { estimateMonthlyCost, formatTaka } from "~/lib/cost";
import { listingImagePath, listingPath } from "~/lib/routes";
import type { ListingCard as ListingCardData } from "~/server/db/repositories/listings";

/** Presentational only: receives plain data, performs no fetching. */
export function ListingCard({ listing }: { listing: ListingCardData }) {
  const monthly = estimateMonthlyCost({
    rentAmount: listing.rentAmount,
    mealCost: listing.mealCost,
    electricityCost: listing.electricityCost,
    wifiCost: listing.wifiCost,
    otherMonthlyCost: listing.otherMonthlyCost,
  });
  return (
    <Card className="p-0 sm:p-0">
      <Link to={listingPath(listing.slug)} className="block space-y-2 p-0 hover:bg-slate-50">
        {listing.coverImageId ? <img src={listingImagePath(listing.coverImageId)} alt={`Photo of ${listing.title}`} loading="lazy" decoding="async" className="aspect-[16/10] w-full rounded-t-xl bg-slate-100 object-cover" /> : <div className="flex aspect-[16/10] items-center justify-center rounded-t-xl bg-slate-100 text-sm text-slate-500">No photo</div>}
        <div className="space-y-2 p-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone="brand">{PROPERTY_TYPE_LABELS[listing.propertyType]}</Badge>
          <Badge tone={listing.availabilityStatus === "available" ? "neutral" : "warning"}>
            {AVAILABILITY_LABELS[listing.availabilityStatus]}
          </Badge>
        </div>
        <h3 className="text-base font-semibold">{listing.title}</h3>
        <p className="text-sm text-slate-600">
          {listing.areaName}, {listing.cityName}
        </p>
        {typeof listing.approximateDistanceKm === "number" ? (
          <p className="text-xs text-slate-600" aria-label="Approximate distance from your search point">
            {listing.approximateDistanceKm < 1
              ? "Approx. under 1 km from your search point"
              : `Approx. ${Math.round(listing.approximateDistanceKm)} km from your search point`}
          </p>
        ) : null}
        <p className="text-lg font-bold text-brand-800">
          {formatTaka(listing.rentAmount)}
          <span className="text-sm font-normal text-slate-600"> / month</span>
        </p>
        {monthly !== null && monthly !== listing.rentAmount ? (
          <p className="text-xs text-slate-600">Estimated total: {formatTaka(monthly)} / month</p>
        ) : null}
        </div>
      </Link>
    </Card>
  );
}
