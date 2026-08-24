import { SkeletonLine, SkeletonList } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <SkeletonLine className="h-6 w-40" />
        <SkeletonLine className="h-4 w-24 mt-2" />
      </div>
      <SkeletonList count={4} />
    </div>
  );
}
