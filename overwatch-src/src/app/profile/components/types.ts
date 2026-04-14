// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Sub = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Sheet = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Attempt = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MemberProfile = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OProgress = any;

export interface EducationEntry {
  institution: string;
  degree: string;
  startYear: string;
  endYear: string;
}

export interface WorkHistoryEntry {
  employer: string;
  title: string;
  startDate: string;
  endDate: string;
  description: string;
}

export const EMPTY_EDU: EducationEntry = { institution: "", degree: "", startYear: "", endYear: "" };
export const EMPTY_WORK: WorkHistoryEntry = { employer: "", title: "", startDate: "", endDate: "", description: "" };

export const WORK_PREF_OPTIONS = ["Weekdays", "Weekends", "Nights", "Mornings", "Events", "Overtime", "Holidays"];
export const DIETARY_OPTIONS = [
  "None", "Vegetarian", "Vegan", "Pescatarian", "Gluten-Free", "Dairy-Free",
  "Nut Allergy", "Shellfish Allergy", "Soy Allergy", "Egg Allergy",
  "Kosher", "Halal", "Keto", "Paleo", "Low Sodium", "Diabetic-Friendly",
  "Lactose Intolerant", "No Pork", "No Beef", "No Red Meat", "Other",
];

export type { SessionUser } from "@/types";

export interface CompFormData {
  bio: string;
  address: string;
  shirtSize: string;
  jacketSize: string;
  dietaryRestrictions: string[];
  emergencyContactName: string;
  emergencyContactPhone: string;
  whatsappOptedIn: boolean;
  hideContactFromRoster: boolean;
  workPreferences: string[];
}
