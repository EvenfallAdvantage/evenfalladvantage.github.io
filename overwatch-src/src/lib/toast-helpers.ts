/**
 * Toast helpers — consistent messaging voice across the app.
 *
 * Usage:
 *   import { toastSuccess, toastError, toastInfo } from "@/lib/toast-helpers";
 *   toastSuccess("Timesheet approved");
 *   toastError("Failed to save", err);
 *   toastInfo("No new applicants found");
 */

import { toast } from "sonner";

/** Show a success toast with consistent formatting */
export function toastSuccess(message: string, description?: string) {
  toast.success(message, { description, duration: 3000 });
}

/** Show an error toast with optional error object for the description */
export function toastError(message: string, error?: unknown) {
  const desc = error instanceof Error
    ? error.message
    : error != null
      ? String(error)
      : "Please try again.";
  toast.error(message, { description: desc, duration: 5000 });
}

/** Show an info toast */
export function toastInfo(message: string, description?: string) {
  toast.info(message, { description, duration: 4000 });
}

/** Show a warning toast */
export function toastWarning(message: string, description?: string) {
  toast.warning(message, { description, duration: 4000 });
}
