export function ServiceStats({
  stats,
}: {
  stats: { label: string; value: string }[];
}) {
  return (
    <div
      className={`grid grid-cols-1 gap-3 ${
        stats.length === 2
          ? "@sm/card:grid-cols-2"
          : "@sm/card:grid-cols-3"
      }`}
    >
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg bg-muted/50 p-3">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {stat.label}
          </div>
          <div className="mt-1 text-base font-semibold">{stat.value}</div>
        </div>
      ))}
    </div>
  );
}
