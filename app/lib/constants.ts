/** Single source of truth for domain enums and site-wide constants. Mirrors the SQL CHECK constraints. */

export const SITE = {
  name: "THAKBO",
  nameBn: "থাকবো",
  tagline: "Find Where You Belong.",
  description:
    "THAKBO helps you discover mess, rooms, flats, houses and sublets around the place you want to live in Bangladesh.",
} as const;

export const PROPERTY_TYPES = ["mess", "mess_seat", "room", "house", "flat", "sublet"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const LISTING_STATUSES = ["draft", "pending", "published", "paused", "rejected", "deleted"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const AVAILABILITY_STATUSES = ["available", "available_from", "unavailable", "rented", "occupied"] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

export const AUDIENCES = ["student", "bachelor", "family", "male", "female", "mixed", "anyone"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const REPORT_REASONS = [
  "fake_listing",
  "wrong_information",
  "already_rented",
  "inappropriate_content",
  "spam",
  "duplicate",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ["pending", "reviewed", "resolved", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const ADMIN_ROLES = ["admin", "moderator"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const SEARCH_SORTS = ["newest", "price_asc", "price_desc", "updated"] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  mess: "Mess",
  mess_seat: "Mess seat",
  room: "Room",
  house: "House",
  flat: "Flat",
  sublet: "Sublet",
};

export const AUDIENCE_LABELS: Record<Audience, string> = {
  student: "Student",
  bachelor: "Bachelor",
  family: "Family",
  male: "Male",
  female: "Female",
  mixed: "Mixed",
  anyone: "Anyone",
};

export const AUDIENCE_LABELS_BN: Record<Audience, string> = {
  student: "ছাত্র/ছাত্রী",
  bachelor: "ব্যাচেলর",
  family: "ফ্যামিলি",
  male: "পুরুষ",
  female: "মহিলা",
  mixed: "মিশ্র",
  anyone: "যে কেউ",
};

export const PROPERTY_TYPE_LABELS_BN: Record<PropertyType, string> = {
  mess: "মেস",
  mess_seat: "মেসের সিট",
  room: "রুম",
  house: "বাড়ি",
  flat: "ফ্ল্যাট",
  sublet: "সাবলেট",
};

/** Kinds of local place. "Sub-area" is not a type: a sub-area is any area that has a parent_area_id. */
export const AREA_TYPES = [
  "neighborhood",
  "para",
  "residential_area",
  "market_area",
  "commercial_area",
  "campus_area",
  "landmark_area",
  "road_area",
  "other",
] as const;
export type AreaType = (typeof AREA_TYPES)[number];

export const ALIAS_LANGUAGES = ["en", "bn", "mixed"] as const;
export type AliasLanguage = (typeof ALIAS_LANGUAGES)[number];

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  draft: "Draft",
  pending: "Pending review",
  published: "Published",
  paused: "Paused",
  rejected: "Rejected",
  deleted: "Deleted",
};

/**
 * Status changes an OWNER may make on their own listing (checked on the server).
 * Publishing/submitting for review (draft → pending) arrives with Milestone 3; moderation (pending → published/rejected)
 * with Milestone 7. "rented" is an availability status, and "removed" is the soft-deleted status `deleted`.
 */
export const OWNER_STATUS_TRANSITIONS: Record<ListingStatus, readonly ListingStatus[]> = {
  draft: ["deleted"],
  pending: ["draft", "deleted"],
  published: ["paused", "deleted"],
  paused: ["published", "deleted"],
  rejected: ["draft", "deleted"],
  deleted: [],
};

export function canOwnerTransition(from: ListingStatus, to: ListingStatus): boolean {
  return OWNER_STATUS_TRANSITIONS[from].includes(to);
}

export const AREA_SEARCH_LIMITS = { defaultResults: 12, maxResults: 25, minQueryLength: 2, maxQueryLength: 80 } as const;

export const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  available: "Available now",
  available_from: "Available from a date",
  unavailable: "Unavailable",
  rented: "Rented",
  occupied: "Occupied",
};

export const SEARCH_SORT_LABELS: Record<SearchSort, string> = {
  newest: "Newest",
  price_asc: "Lowest price",
  price_desc: "Highest price",
  updated: "Recently updated",
};

export const SEARCH_LIMITS = { defaultPageSize: 20, maxPageSize: 50, maxPage: 100, maxRadiusKm: 25 } as const;

export const MEDIA_LIMITS = {
  maxImageBytes: 5 * 1024 * 1024,
  maxImagesPerListing: 12,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
} as const;
