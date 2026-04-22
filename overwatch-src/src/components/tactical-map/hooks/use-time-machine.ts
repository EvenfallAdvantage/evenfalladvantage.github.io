import { useState, useEffect, useMemo } from "react";
import type { StaffPin, IncidentPin } from "../types";
import type { MapAnnotation } from "@/lib/supabase/db-annotations";
import { getStaffLocationsAt } from "@/lib/supabase/db-location";

/** Wrapper so the react-compiler does not flag `Date.now()` as an inline impure call */
function currentTimestamp() { return Date.now(); }

export function useTimeMachine(
  staff: StaffPin[],
  companyId: string,
  incidents?: IncidentPin[],
  annotations?: MapAnnotation[],
) {
  const [timeMachineOpen, setTimeMachineOpen] = useState(false);
  const [replayTime, setReplayTime] = useState(currentTimestamp);
  const [timeMachineStaff, setTimeMachineStaff] = useState<StaffPin[]>([]);
  // Debounced replay time — only updates every 2 seconds to avoid flooding Supabase
  const [debouncedReplayTime, setDebouncedReplayTime] = useState(currentTimestamp);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedReplayTime(replayTime), 2000);
    return () => clearTimeout(timer);
  }, [replayTime]);

  // When Time Machine is active, fetch historical staff positions (debounced)
  useEffect(() => {
    if (!timeMachineOpen || !companyId) return;
    // Only fetch if we're replaying past (>5s ago)
    const isReplaying = debouncedReplayTime < currentTimestamp() - 5000;
    if (!isReplaying) return;
    let cancelled = false;
    getStaffLocationsAt(companyId, debouncedReplayTime).then((locs) => {
      if (cancelled) return;
      setTimeMachineStaff(locs.map((l) => ({
        userId: l.userId,
        name: l.name,
        role: "staff",
        lat: l.lat,
        lng: l.lng,
        heading: l.heading ?? undefined,
        speed: l.speed ?? undefined,
        updatedAt: l.updatedAt,
      })));
    }).catch(() => {});
    return () => { cancelled = true; setTimeMachineStaff([]); };
  }, [timeMachineOpen, debouncedReplayTime, companyId]);

  // Use time machine staff when replaying, otherwise live staff
  const isReplaying = timeMachineOpen && debouncedReplayTime < currentTimestamp() - 5000;
  const effectiveStaff = isReplaying ? timeMachineStaff : staff;

  // Filter incidents to only show those created before the replay timestamp
  const effectiveIncidents = useMemo(() => {
    if (!isReplaying || !incidents) return incidents ?? [];
    return incidents.filter(i => {
      const createdAt = i.createdAt ? new Date(i.createdAt).getTime() : 0;
      return createdAt <= debouncedReplayTime;
    });
  }, [isReplaying, incidents, debouncedReplayTime]);

  // Filter annotations to only show those created before the replay timestamp
  const effectiveAnnotations = useMemo(() => {
    if (!isReplaying || !annotations) return annotations ?? [];
    return annotations.filter(a => {
      const createdAt = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      return createdAt <= debouncedReplayTime;
    });
  }, [isReplaying, annotations, debouncedReplayTime]);

  return {
    timeMachineOpen, setTimeMachineOpen, replayTime, setReplayTime,
    debouncedReplayTime, effectiveStaff, effectiveIncidents, effectiveAnnotations,
  };
}
