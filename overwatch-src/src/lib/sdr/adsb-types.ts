export interface AdsbAircraft {
  icao24: string;
  callsign: string;
  lat: number | null;
  lng: number | null;
  altitude: number | null;
  velocity: number | null;
  heading: number | null;
  verticalRate: number | null;
  onGround: boolean;
  lastContact: number;
}

export type AdsbAircraftMap = Record<string, AdsbAircraft>;
