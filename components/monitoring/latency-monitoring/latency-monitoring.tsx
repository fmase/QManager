"use client";

import LatencyMonitoringCard, {
  useLatencyMonitoring,
} from "./latency-monitoring-card";
import PingEntriesCard from "./ping-entries-card";

const LatencyMonitoringComponent = () => {
  const { viewMode, setViewMode, chartData, total, tableData } =
    useLatencyMonitoring();

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Latency Monitoring</h1>
        <p className="text-muted-foreground">
          Monitor and analyze latency and packet loss to identify potential
          issues and optimize performance.
        </p>
      </div>
      <div className="grid grid-cols-1 @xl/main:grid-cols-2 @5xl/main:grid-cols-2 grid-flow-row gap-4 *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:shadow-xs">
        <LatencyMonitoringCard
          viewMode={viewMode}
          setViewMode={setViewMode}
          chartData={chartData}
          total={total}
        />
        <PingEntriesCard
          entries={tableData.entries}
          emptyMessage={tableData.emptyMessage}
          isRealtime={tableData.isRealtime}
        />
      </div>
    </div>
  );
};

export default LatencyMonitoringComponent;
