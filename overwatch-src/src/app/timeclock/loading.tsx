import { CardSkeleton } from "@/components/loading-skeleton";

export default function TimeclockLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <CardSkeleton className="h-48" />
      <CardSkeleton className="h-32" />
    </div>
  );
}
