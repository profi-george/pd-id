// Скелетоны: вместо мигания прозрачностью (animate-pulse) — блик, который
// проходит слева направо. Пульсация читается как «что-то моргает/сломалось»,
// бегущий блик — как «идёт загрузка»; это стандартный язык ожидания
// в приложениях уровня, на который мы равняемся.
export function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-md bg-neutral-200 animate-shimmer ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(100deg, transparent 20%, rgba(255,255,255,0.75) 40%, transparent 60%)",
        backgroundSize: "200% 100%",
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}

export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="surface px-4 py-3.5 space-y-2.5">
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
