import { DesktopRouteStateView } from "../app/DesktopRouteStateView";

export function CaptureRoute() {
	return <DesktopRouteStateView state={{ kind: "capture" }} />;
}
