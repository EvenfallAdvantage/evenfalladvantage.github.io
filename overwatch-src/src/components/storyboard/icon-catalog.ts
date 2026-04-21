import {
  MapPin, DoorOpen, Camera, ShieldAlert, Heart, Flame,
  User, Radio, Car, Star,
  // Extended icon library for searchable picker
  Building2, Warehouse, ParkingCircle, Fence, TreePine, Mountain,
  Waves, Tent, Flag, Target, Eye, EyeOff, Lock, Unlock,
  Shield, Siren, Zap, AlertTriangle, Ban,
  Phone, Wifi, Satellite, Megaphone,
  Ambulance, Stethoscope, Pill, Cross, HeartPulse,
  Flashlight, Key, HardHat,
  Users, UserCheck, UserX, Baby, Dog, Footprints,
  Truck, Bus, Bike, Plane, Ship, TrainFront,
  Coffee, UtensilsCrossed, Droplets,
  Cctv, Scan, QrCode, Fingerprint,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Circle,
  Package,
  Lightbulb, Power,
  Bell, BellRing,
  MapPinned, Navigation, Compass,
  Skull, Bomb, Radiation, Biohazard,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { IconEntry } from "./types";

const ICON_CATEGORIES: { label: string; icons: IconEntry[] }[] = [
  { label: "Common", icons: [
    { value: "pin", label: "Pin", icon: MapPin, tags: ["location", "marker", "point"] },
    { value: "star", label: "Star", icon: Star, tags: ["important", "favorite", "command"] },
    { value: "flag", label: "Flag", icon: Flag, tags: ["checkpoint", "rally", "marker"] },
    { value: "target", label: "Target", icon: Target, tags: ["objective", "focus", "goal"] },
    { value: "circle", label: "Circle", icon: Circle, tags: ["area", "zone", "point"] },
    { value: "pinned", label: "Pinned", icon: MapPinned, tags: ["fixed", "location"] },
  ]},
  { label: "Security", icons: [
    { value: "incident", label: "Incident", icon: ShieldAlert, tags: ["alert", "security", "breach"] },
    { value: "shield", label: "Shield", icon: Shield, tags: ["protection", "secure", "guard"] },
    { value: "siren", label: "Siren", icon: Siren, tags: ["alarm", "emergency", "alert"] },
    { value: "eye", label: "Observation", icon: Eye, tags: ["watch", "surveillance", "lookout"] },
    { value: "eyeoff", label: "Blind Spot", icon: EyeOff, tags: ["hidden", "concealed", "no coverage"] },
    { value: "lock", label: "Locked", icon: Lock, tags: ["secure", "restricted", "closed"] },
    { value: "unlock", label: "Unlocked", icon: Unlock, tags: ["open", "access", "unsecured"] },
    { value: "ban", label: "Restricted", icon: Ban, tags: ["prohibited", "no entry", "blocked"] },
    { value: "alert", label: "Warning", icon: AlertTriangle, tags: ["caution", "danger", "hazard"] },
    { value: "skull", label: "Danger", icon: Skull, tags: ["lethal", "extreme", "death"] },
    { value: "scan", label: "Scanner", icon: Scan, tags: ["check", "inspect", "verify"] },
  ]},
  { label: "Access", icons: [
    { value: "gate", label: "Gate / Door", icon: DoorOpen, tags: ["entrance", "exit", "entry"] },
    { value: "exit", label: "Exit", icon: DoorOpen, tags: ["egress", "way out", "emergency exit"] },
    { value: "fence", label: "Fence", icon: Fence, tags: ["barrier", "perimeter", "boundary"] },
    { value: "key", label: "Key Access", icon: Key, tags: ["keycard", "badge", "credential"] },
    { value: "fingerprint", label: "Biometric", icon: Fingerprint, tags: ["access control", "scanner"] },
    { value: "qrcode", label: "QR Code", icon: QrCode, tags: ["scan", "ticket", "credential"] },
  ]},
  { label: "Surveillance", icons: [
    { value: "camera", label: "Camera", icon: Camera, tags: ["cctv", "surveillance", "photo"] },
    { value: "cctv", label: "CCTV", icon: Cctv, tags: ["surveillance", "monitor", "security camera"] },
    { value: "flashlight", label: "Flashlight", icon: Flashlight, tags: ["light", "search", "patrol"] },
  ]},
  { label: "Medical", icons: [
    { value: "medical", label: "Medical", icon: Heart, tags: ["first aid", "health", "aid station"] },
    { value: "heartpulse", label: "Heart Pulse", icon: HeartPulse, tags: ["vital", "emergency", "aed"] },
    { value: "ambulance", label: "Ambulance", icon: Ambulance, tags: ["ems", "transport", "medevac"] },
    { value: "stethoscope", label: "Stethoscope", icon: Stethoscope, tags: ["doctor", "nurse", "triage"] },
    { value: "cross", label: "Red Cross", icon: Cross, tags: ["aid", "first aid", "medical station"] },
    { value: "pill", label: "Pharmacy", icon: Pill, tags: ["medication", "drugs", "narcan"] },
  ]},
  { label: "Hazards", icons: [
    { value: "fire", label: "Fire", icon: Flame, tags: ["hazard", "burn", "emergency"] },
    { value: "zap", label: "Electrical", icon: Zap, tags: ["shock", "power", "hazard"] },
    { value: "radiation", label: "Radiation", icon: Radiation, tags: ["hazmat", "nuclear", "contamination"] },
    { value: "biohazard", label: "Biohazard", icon: Biohazard, tags: ["contamination", "biological", "hazmat"] },
    { value: "bomb", label: "Explosive", icon: Bomb, tags: ["ied", "suspicious package", "eod"] },
    { value: "droplets", label: "Water/Flood", icon: Droplets, tags: ["leak", "flooding", "spill"] },
  ]},
  { label: "Personnel", icons: [
    { value: "personnel", label: "Person", icon: User, tags: ["guard", "staff", "individual"] },
    { value: "users", label: "Group", icon: Users, tags: ["team", "crowd", "assembly"] },
    { value: "usercheck", label: "Verified", icon: UserCheck, tags: ["cleared", "confirmed", "vip"] },
    { value: "userx", label: "Denied", icon: UserX, tags: ["ejected", "banned", "trespasser"] },
    { value: "baby", label: "Child", icon: Baby, tags: ["minor", "lost child", "family"] },
    { value: "dog", label: "K9", icon: Dog, tags: ["canine", "animal", "service dog"] },
    { value: "footprints", label: "Footprints", icon: Footprints, tags: ["patrol", "route", "track"] },
    { value: "hardhat", label: "Hard Hat", icon: HardHat, tags: ["construction", "worker", "safety"] },
  ]},
  { label: "Vehicles", icons: [
    { value: "car", label: "Car", icon: Car, tags: ["vehicle", "parking", "automobile"] },
    { value: "truck", label: "Truck", icon: Truck, tags: ["delivery", "large vehicle", "semi"] },
    { value: "bus", label: "Bus", icon: Bus, tags: ["transport", "shuttle", "transit"] },
    { value: "bike", label: "Bicycle", icon: Bike, tags: ["cycle", "bike rack"] },
    { value: "plane", label: "Aircraft", icon: Plane, tags: ["helicopter", "aviation", "drone"] },
    { value: "ship", label: "Boat", icon: Ship, tags: ["watercraft", "marine", "dock"] },
    { value: "train", label: "Train", icon: TrainFront, tags: ["rail", "station", "transit"] },
    { value: "parking", label: "Parking", icon: ParkingCircle, tags: ["lot", "garage", "valet"] },
  ]},
  { label: "Comms", icons: [
    { value: "radio", label: "Radio", icon: Radio, tags: ["communication", "walkie talkie", "comms"] },
    { value: "phone", label: "Phone", icon: Phone, tags: ["call", "telephone", "landline"] },
    { value: "wifi", label: "WiFi", icon: Wifi, tags: ["internet", "network", "connectivity"] },
    { value: "satellite", label: "Satellite", icon: Satellite, tags: ["gps", "tracking", "comms"] },
    { value: "megaphone", label: "Megaphone", icon: Megaphone, tags: ["announcement", "pa system", "broadcast"] },
    { value: "bell", label: "Bell", icon: Bell, tags: ["alarm", "notification", "alert"] },
    { value: "bellring", label: "Alarm Bell", icon: BellRing, tags: ["fire alarm", "emergency alarm"] },
  ]},
  { label: "Facilities", icons: [
    { value: "building", label: "Building", icon: Building2, tags: ["structure", "office", "facility"] },
    { value: "warehouse", label: "Warehouse", icon: Warehouse, tags: ["storage", "depot", "staging"] },
    { value: "tent", label: "Tent", icon: Tent, tags: ["temporary", "canopy", "shelter"] },
    { value: "coffee", label: "Break Area", icon: Coffee, tags: ["rest", "break room", "canteen"] },
    { value: "utensils", label: "Food", icon: UtensilsCrossed, tags: ["concessions", "catering", "kitchen"] },
    { value: "power", label: "Power", icon: Power, tags: ["generator", "electrical", "outlet"] },
    { value: "lightbulb", label: "Lighting", icon: Lightbulb, tags: ["light", "illumination", "lamp"] },
    { value: "package", label: "Storage", icon: Package, tags: ["supply", "equipment", "staging area"] },
  ]},
  { label: "Navigation", icons: [
    { value: "arrowup", label: "North", icon: ArrowUp, tags: ["direction", "up"] },
    { value: "arrowdown", label: "South", icon: ArrowDown, tags: ["direction", "down"] },
    { value: "arrowleft", label: "West", icon: ArrowLeft, tags: ["direction", "left"] },
    { value: "arrowright", label: "East", icon: ArrowRight, tags: ["direction", "right"] },
    { value: "compass", label: "Compass", icon: Compass, tags: ["orientation", "bearing"] },
    { value: "navigate", label: "Navigate", icon: Navigation, tags: ["route", "direction", "heading"] },
  ]},
  { label: "Terrain", icons: [
    { value: "tree", label: "Tree / Woods", icon: TreePine, tags: ["forest", "vegetation", "nature"] },
    { value: "mountain", label: "Mountain", icon: Mountain, tags: ["hill", "elevation", "terrain"] },
    { value: "waves", label: "Water", icon: Waves, tags: ["river", "lake", "ocean", "shore"] },
  ]},
];

// Flat lookup for rendering pins
const ICON_MAP: Record<string, LucideIcon> = {};
const ALL_ICONS: IconEntry[] = [];
for (const cat of ICON_CATEGORIES) {
  for (const entry of cat.icons) {
    ICON_MAP[entry.value] = entry.icon;
    ALL_ICONS.push(entry);
  }
}

const DEFAULT_COLORS = [
  "#d59b3c", // will be replaced by brand accent at render time
  "#ef4444",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#f97316",
  "#06b6d4",
  "#ec4899",
  "#facc15",
  "#64748b",
];

export { ICON_CATEGORIES, ICON_MAP, ALL_ICONS, DEFAULT_COLORS };
