export interface DeviceInfo {
  index: number;
  serial: string;
  manufacturer: string;
  product: string;
}

export type SdrRole = "radio" | "adsb" | "none";

export interface DeviceAssignment {
  radio: number | null;
  adsb: number | null;
}

export type SdrRoleKey = "radio" | "adsb";
