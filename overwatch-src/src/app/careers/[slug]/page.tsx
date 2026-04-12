import CareersClient from "./careers-client";

// Required for static export — slugs are dynamic, resolved client-side
export function generateStaticParams() { return []; }

export default function CareersPage() {
  return <CareersClient />;
}
