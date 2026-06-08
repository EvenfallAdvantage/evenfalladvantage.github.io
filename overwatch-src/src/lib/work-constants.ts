/**
 * Shared Work Constants
 *
 * Centralized status/priority enums used across incidents, tasks, and other work items.
 * This ensures consistency and makes it easier to update options globally.
 */

export const PRIORITY = [
  { value: "critical", label: "Critical", color: "bg-red-600 text-white" },
  { value: "high", label: "High", color: "bg-orange-500 text-white" },
  { value: "medium", label: "Medium", color: "bg-amber-500 text-white" },
  { value: "low", label: "Low", color: "bg-blue-500 text-white" },
];

export const WORK_STATUS = [
  { value: "todo", label: "To Do", color: "bg-muted text-muted-foreground" },
  { value: "in_progress", label: "In Progress", color: "bg-blue-500/15 text-blue-600" },
  { value: "blocked", label: "Blocked", color: "bg-red-500/15 text-red-600" },
  { value: "done", label: "Done", color: "bg-green-500/15 text-green-600" },
  { value: "cancelled", label: "Cancelled", color: "bg-muted text-muted-foreground" },
];

export const byValue = <T extends { value: string }>(arr: T[], value: string): T | undefined => arr.find(item => item.value === value);
