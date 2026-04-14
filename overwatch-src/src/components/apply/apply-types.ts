export type EducationEntry = { institution: string; degree: string; startYear: string; endYear: string };
export type WorkHistoryEntry = { employer: string; title: string; startDate: string; endDate: string; description: string };
export type DocumentEntry = { name: string; type: string; fileUrl: string };
export type PendingFile = { name: string; type: string; file: File };

export const DOCUMENT_TYPES = [
  "Guard Card",
  "CPR/First Aid",
  "EMT",
  "OSHA",
  "Firearms",
  "Security License",
  "Military",
  "LEO",
  "Other",
] as const;
