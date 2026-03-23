export function Skeleton({ h = "16px", w = "100%" }: { h?: string; w?: string }) {
  return <div className="skeleton" style={{ height: h, width: w }} />;
}

export function CardSkeleton() {
  return (
    <div className="stat-card space-y-2">
      <Skeleton h="10px" w="60%" />
      <Skeleton h="24px" w="80%" />
      <Skeleton h="10px" w="40%" />
    </div>
  );
}
