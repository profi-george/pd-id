import { SkeletonLine, SkeletonList } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <SkeletonLine className="h-6 w-24" />
        <SkeletonLine className="h-4 w-32 mt-2" />
      </div>
      <SkeletonList count={5} />
    </div>
  );
}
