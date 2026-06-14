declare module "mode-s-aircraft-store" {
  interface Aircraft {
    icao: string;
    callsign?: string;
    altitude?: number;
    speed?: number;
    heading?: number;
    vertRate?: number;
    lat?: number;
    lng?: number;
    seen: number;
    count: number;
    unit: number;
  }

  interface AircraftStoreOptions {
    timeout?: number;
  }

  class AircraftStore {
    constructor(opts?: AircraftStoreOptions);
    addMessage(msg: { icao?: string; [key: string]: unknown }): void;
    getAircrafts(): Aircraft[];
  }

  export default AircraftStore;
}
