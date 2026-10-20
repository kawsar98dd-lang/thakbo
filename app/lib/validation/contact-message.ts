import { z } from "zod";

/** Public contact form fields only. Database IDs, status and moderation fields are never accepted here. */
export const contactMessageSchema = z.object({
  name: z.string().trim().min(2, "Name must be between 2 and 100 characters.").max(100, "Name must be between 2 and 100 characters."),
  email: z.string().trim().toLowerCase().max(254, "Enter a valid email address.").email("Enter a valid email address."),
  subject: z.string().trim().min(3, "Subject must be between 3 and 160 characters.").max(160, "Subject must be between 3 and 160 characters."),
  message: z.string().trim().min(10, "Message must be between 10 and 3,000 characters.").max(3000, "Message must be between 10 and 3,000 characters."),
}).strict();

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;

/** Safely parse untrusted form values while preserving the first user-facing validation message. */
export function validateContactMessage(input: unknown): { success: true; data: ContactMessageInput } | { success: false; message: string } {
  const result = contactMessageSchema.safeParse(input);
  if (result.success) return { success: true, data: result.data };
  return { success: false, message: result.error.issues[0]?.message ?? "Check the contact form and try again." };
}
