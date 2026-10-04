import { data } from "react-router";

/** Throw these from loaders/actions/middleware; route error boundaries turn them into friendly pages. */
export const notFound = () => data("Not Found", { status: 404 });
export const forbidden = () => data("Forbidden", { status: 403 });

/** Raised by the data layer. The original error is kept in `cause` for logs and never shown to users. */
export class DatabaseError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DatabaseError";
  }
}
