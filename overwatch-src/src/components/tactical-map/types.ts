// Types for entities we plot on the map

export interface StaffPin {
  userId: string;
  name: string;
  role: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  updatedAt: string;
}

export interface OperationPin {
  id: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
  status: string;
  startDate: string;
  shiftCount?: number;
  geofenceRadius?: number;
  siteMapUrl?: string | null;
}

export interface IncidentPin {
  id: string;
  title: string;
  description?: string;
  type?: string;
  priority?: string;
  lat: number;
  lng: number;
  severity: string;
  status: string;
  reportedBy?: string;
  assignedTo?: string;
  location?: string;
  createdAt: string;
  incidentNumber?: string | null;
  teamId?: string | null;
  teamName?: string | null;
  teamColor?: string | null;
}

export interface TacticalMapProps {
  operations: OperationPin[];
  staff: StaffPin[];
  incidents: IncidentPin[];
  companyId: string;
  isAdmin?: boolean;
  onSelectOperation?: (id: string) => void;
  onMessageStaff?: (userId: string) => void;
}
