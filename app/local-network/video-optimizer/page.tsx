import VideoOptimizerSettingsCard from "@/components/local-network/video-optimizer/video-optimizer-settings-card";

const VideoOptimizerPage = () => {
  return (
    <div className="@container/main mx-auto p-2">
      <h1 className="text-2xl font-bold tracking-tight">Video Optimizer</h1>
      <p className="text-muted-foreground mb-4">
        Bypass carrier video throttling using DPI evasion
      </p>
      <div className="grid grid-cols-1 gap-4">
        <VideoOptimizerSettingsCard />
      </div>
    </div>
  );
};

export default VideoOptimizerPage;
