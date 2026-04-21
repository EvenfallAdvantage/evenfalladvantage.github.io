import { CardSkeleton } from "@/components/loading-skeleton";

export default function ProfileLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <CardSkeleton className="h-40" />
      <div className="grid gap-4 sm:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
