import { WifiOff } from "lucide-react";

interface OfflineBannerProps {
  visible: boolean;
}

export function OfflineBanner({ visible }: OfflineBannerProps) {
  if (!visible) return null;
  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <WifiOff aria-hidden="true" />
      <span>You're offline. Chapter quests can't be generated until you reconnect.</span>
    </div>
  );
}
