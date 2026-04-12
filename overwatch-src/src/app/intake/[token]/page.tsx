import IntakeForm from "./intake-form";

// Required for static export — tokens are dynamic, resolved client-side
export function generateStaticParams() { return []; }

export default function IntakePage() {
  return <IntakeForm />;
}
