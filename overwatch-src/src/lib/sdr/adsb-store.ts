import type { AdsbAircraftMap } from "./adsb-types";

let _aircraft: AdsbAircraftMap = {};
let _listeners: Array<(a: AdsbAircraftMap) => void> = [];

export function setAdsbAircraft(aircraft: AdsbAircraftMap): void {
  _aircraft = aircraft;
  for (const fn of _listeners) fn(_aircraft);
}

export function getAdsbAircraft(): AdsbAircraftMap {
  return _aircraft;
}

export function subscribeAdsb(fn: (a: AdsbAircraftMap) => void): () => void {
  _listeners.push(fn);
  fn(_aircraft);
  return () => {
    _listeners = _listeners.filter(l => l !== fn);
  };
}
