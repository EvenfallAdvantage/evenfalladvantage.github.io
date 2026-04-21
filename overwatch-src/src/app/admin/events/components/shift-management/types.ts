import type { OperationAvailability } from "@/lib/supabase/db-availability";
import type { ConflictWarningData } from "../conflict-warning-modal";
import type { Shift, Member } from "../shared";

/* ── Types ── */

export interface ShiftManagementProps {
  eventId: string;
  companyId: string;
  startDate: string;
  endDate: string;
  shifts: Shift[];
  members: Member[];
  availability: OperationAvailability[];
  onShiftsChange: (shifts: Shift[]) => void;
  onConflictWarning: (data: ConflictWarningData) => void;
  /** IANA timezone for the event (e.g. "America/Los_Angeles") */
  eventTimezone?: string;
}
