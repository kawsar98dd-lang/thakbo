import { z } from "zod";
import { MEDIA_LIMITS } from "../constants";

/** Metadata the browser claims about a file. Re-checked on the server against the real bytes. */
export const imageMetadataSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(MEDIA_LIMITS.allowedMimeTypes),
  size: z.number().int().positive().max(MEDIA_LIMITS.maxImageBytes, "Image is larger than 5 MB."),
});

export type ImageMetadata = z.infer<typeof imageMetadataSchema>;
