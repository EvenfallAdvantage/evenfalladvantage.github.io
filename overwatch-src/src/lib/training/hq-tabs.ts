import { canManageLegacyCourses, hasMinRole, type CompanyRole } from "@/lib/permissions";

/**
 * Training HQ = former Training Admin (modules, question bank, staff progress)
 * + former Instructor HQ (courses, classes, students, assessments).
 */
export const TRAINING_ADMIN_TABS = ["modules", "questions", "progress"] as const;
export const INSTRUCTOR_TABS = ["courses", "classes", "students", "assessments"] as const;
export type TrainingHqTab = (typeof TRAINING_ADMIN_TABS)[number] | (typeof INSTRUCTOR_TABS)[number];

export const TRAINING_HQ_PATH = "/admin/training";

export function canUseTrainingAdmin(role: CompanyRole): boolean {
  return hasMinRole(role, "manager");
}

export function canUseInstructorTools(role: CompanyRole, isTrainingProvider: boolean): boolean {
  return isTrainingProvider && canManageLegacyCourses(role);
}

export function visibleTrainingTabs(role: CompanyRole, isTrainingProvider: boolean): TrainingHqTab[] {
  return [
    ...(canUseTrainingAdmin(role) ? TRAINING_ADMIN_TABS : []),
    ...(canUseInstructorTools(role, isTrainingProvider) ? INSTRUCTOR_TABS : []),
  ];
}

export function resolveTrainingTab(tab: string | null | undefined, visible: TrainingHqTab[]): TrainingHqTab | null {
  if (tab && (visible as string[]).includes(tab)) return tab as TrainingHqTab;
  return visible[0] ?? null;
}

export function trainingHqHref(tab?: TrainingHqTab): string {
  return tab ? `${TRAINING_HQ_PATH}?tab=${tab}` : TRAINING_HQ_PATH;
}
