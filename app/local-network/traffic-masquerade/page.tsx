import { redirect } from "next/navigation";

export default function TrafficMasqueradePage() {
  redirect("/local-network/traffic-engine?mode=masquerade");
}
