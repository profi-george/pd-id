import { SkeletonLine, SkeletonList } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6 max-w-lg">
      <SkeletonLine className="h-6 w-28" />
      <SkeletonLine className="h-56 w-full" />
      <SkeletonList count={4} />
    </div>
  );
}
