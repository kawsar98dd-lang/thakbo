/** Single source of truth for domain enums and site-wide constants. Mirrors the SQL CHECK constraints. */

export const SITE = {
  name: "THAKBO",
  nameBn: "থাকবো",
  tagline: "Find Where You Belong.",
  /** Canonical production origin; update this single value if THAKBO moves to a custom domain. */
  canonicalOrigin: "https://thakbo.eu.cc",
  description:
    "বাংলাদেশে বাসা ভাড়া, রুম ভাড়া ও মেস খুঁজুন THAKBO-তে। শহর ও এলাকার ভিত্তিতে প্রকাশিত লিস্টিং দেখুন। Find rooms, flats, houses and mess accommodation across Bangladesh.",
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

export const SEARCH_SORTS = ["newest", "price_asc", "price_desc", "updated", "distance"] as const;
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
 * Status changes an OWNER may make through the generic status function (checked on the server, compare-and-set in SQL).
 * NOT in this table on purpose:
 *  - anything INTO `pending`: that is a submission and goes through submitListing(), which validates readiness;
 *  - anything INTO `published` or `rejected`: only a moderator may do that (see MODERATOR_STATUS_TRANSITIONS).
 * There is no owner path from `paused` (or anything else) back to `published`: going live always needs a moderator.
 * Migration 0008 enforces the complete transition graph again inside the database (trigger).
 */
export const OWNER_STATUS_TRANSITIONS: Record<ListingStatus, readonly ListingStatus[]> = {
  draft: ["deleted"],
  pending: ["draft", "deleted"],
  published: ["paused", "draft", "deleted"],
  paused: ["draft", "deleted"],
  rejected: ["draft", "deleted"],
  deleted: [],
};

export function canOwnerTransition(from: ListingStatus, to: ListingStatus): boolean {
  return OWNER_STATUS_TRANSITIONS[from].includes(to);
}

/** The only decisions a moderator/admin may take, and only on a listing that is waiting for review. */
export const MODERATOR_STATUS_TRANSITIONS: Partial<Record<ListingStatus, readonly ListingStatus[]>> = {
  pending: ["published", "rejected"],
};

/** Statuses from which an owner may submit the listing for review. */
export const SUBMITTABLE_STATUSES: readonly ListingStatus[] = ["draft", "rejected", "paused"];

/**
 * Statuses in which the owner may change the listing's text fields.
 * Saving a `published` or `paused` listing takes it offline and puts it back into `pending` (moderation again).
 * A `pending` listing is locked while a moderator may be looking at it: withdraw it first.
 */
export const EDITABLE_STATUSES: readonly ListingStatus[] = ["draft", "rejected", "published", "paused"];

/** Statuses in which photos may be added or removed (never while a listing is live or under review). */
export const IMAGE_EDITABLE_STATUSES: readonly ListingStatus[] = ["draft", "rejected"];

/** Statuses a moderator may open (drafts are private to their owner, deleted listings are gone). */
export const REVIEWABLE_STATUSES: readonly ListingStatus[] = ["pending", "published", "paused", "rejected"];

export const MODERATION_ACTIONS = ["submit", "approve", "reject", "unpublish", "withdraw", "pause", "delete"] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export const MODERATION_ACTION_LABELS: Record<ModerationAction, string> = {
  submit: "Submitted for review",
  approve: "Approved",
  reject: "Rejected",
  unpublish: "Taken offline",
  withdraw: "Moved back to draft",
  pause: "Paused",
  delete: "Deleted",
};

export const REJECTION_REASON_LIMITS = { min: 10, max: 500 } as const;

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
  distance: "Nearest to me",
};

export const SEARCH_LIMITS = { defaultPageSize: 20, maxPageSize: 50, maxPage: 100, maxRadiusKm: 25 } as const;

export const MEDIA_LIMITS = {
  maxImageBytes: 5 * 1024 * 1024,
  maxImagesPerListing: 12,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
} as const;
