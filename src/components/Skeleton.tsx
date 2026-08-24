export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`bg-neutral-200 rounded animate-pulse ${className}`} />;
}

export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg px-3.5 py-3 space-y-2">
      <SkeletonLine className="h-4 w-3/4" />
      {lines > 1 && <SkeletonLine className="h-3 w-1/3" />}
    </div>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
