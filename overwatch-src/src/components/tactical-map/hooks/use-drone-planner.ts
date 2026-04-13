import { useState } from "react";
import type { Waypoint } from "../drone-planner";

export function useDronePlanner() {
  const [dronePlannerOpen, setDronePlannerOpen] = useState(false);
  const [droneWaypoints, setDroneWaypoints] = useState<Waypoint[]>([]);

  return { dronePlannerOpen, setDronePlannerOpen, droneWaypoints, setDroneWaypoints };
}
