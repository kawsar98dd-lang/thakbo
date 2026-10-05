import { z } from "zod";
import { emptyToUndefined, optionalText } from "./common";

const phone = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9\s-]{5,18}[0-9]$/, "Enter a valid phone number (digits, spaces or hyphens).")
    .optional(),
);

/** Fields a user may edit on their own profile. user_id, avatar and roles are NOT part of it. */
export const PROFILE_FIELDS = ["displayName", "phone", "whatsapp", "bio", "preferredCityId"] as const;

export const profileInputSchema = z.object({
  displayName: z.string().trim().min(2, "Enter your name.").max(80, "Name is too long."),
  phone,
  whatsapp: phone,
  bio: optionalText(500),
  preferredCityId: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;
