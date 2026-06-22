import type { AppInfo } from "../../preload/types";
import type { PendingRequest } from "../app/types";
import type { useProviderStatus } from "../hooks/useProviderStatus";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";

export function RightPanel(props: {
	appInfo?: AppInfo;
	selectionMessage: string;
	provider: ReturnType<typeof useProviderStatus>;
	pendingRequests: PendingRequest[];
	eventLog: string[];
}) {
	return (
		<aside className="inspector">
			<section className="panel">
				<div className="panel-heading">
					<p className="label">Runtime</p>
					<span className="status-dot" />
				</div>
				<p className="value">
					{props.appInfo
						? `${props.appInfo.name} ${props.appInfo.version} · ${props.appInfo.platform}`
						: "Loading..."}
				</p>
				<p className="muted">{props.selectionMessage}</p>
				<Button
					size="sm"
					variant="outline"
					type="button"
					onClick={() =>
						void window.experimentalDesktop.openExternal(
							"https://www.electronjs.org/docs/latest",
						)
					}
				>
					Electron Docs
				</Button>
			</section>
			<section className="panel">
				<div className="panel-heading">
					<p className="label">OpenAI OAuth</p>
					<Badge variant="secondary">
						{props.provider.statusLabel}
					</Badge>
				</div>
				<p className="muted">{props.provider.detail}</p>
				<div className="actions">
					<Button
						size="xs"
						type="button"
						onClick={props.provider.connect}
					>
						Connect
					</Button>
					<Button
						size="xs"
						variant="secondary"
						type="button"
						onClick={props.provider.refreshAuth}
					>
						Refresh
					</Button>
					<Button
						size="xs"
						variant="secondary"
						type="button"
						onClick={props.provider.probe}
					>
						Probe
					</Button>
					<Button
						size="xs"
						variant="ghost"
						type="button"
						onClick={props.provider.logout}
					>
						Disconnect
					</Button>
				</div>
			</section>
			<section className="panel compact">
				<div className="panel-heading">
					<p className="label">Pending approvals</p>
					<Badge variant="outline">
						{props.pendingRequests.length}
					</Badge>
				</div>
				{props.pendingRequests.length === 0 ? (
					<p className="muted">No pending requests.</p>
				) : (
					props.pendingRequests.map((request) => (
						<p className="muted" key={request.data.requestId}>
							{request.data.requestKind} ·{" "}
							{request.data.requestId}
						</p>
					))
				)}
			</section>
			<section className="panel event-panel">
				<div className="panel-heading">
					<p className="label">Event log</p>
					<Badge variant="outline">{props.eventLog.length}</Badge>
				</div>
				<ScrollArea className="event-scroll">
					<pre>{props.eventLog.join("\n")}</pre>
				</ScrollArea>
			</section>
			<section className="channel-card">
				<div className="channel-art" aria-hidden="true" />
				<div>
					<strong>Connect your channel</strong>
					<p>Bring Slack, GitHub, Drive into the workspace.</p>
				</div>
			</section>
		</aside>
	);
}
