import { ScreenTitle } from "@/components/ui";
import { PulseTracker } from "./PulseTracker";

export default function PulsePage() {
  return (
    <div className="space-y-5">
      <ScreenTitle>heart rate</ScreenTitle>
      <PulseTracker />
    </div>
  );
}
