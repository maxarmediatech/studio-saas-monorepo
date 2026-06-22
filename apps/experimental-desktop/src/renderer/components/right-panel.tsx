import type { AppInfo } from "../../preload/types";
import type { PendingRequest } from "../app/types";
import type { useProviderStatus } from "../hooks/useProviderStatus";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";

const labelClass = "m-0 text-[12px] font-medium text-[var(--desktop-subtle)]";
const valueClass = "m-0 font-semibold leading-[1.45] text-[var(--desktop-strong)]";
const mutedClass = "m-0 leading-[1.45] text-[var(--desktop-subtle)]";
const panelClass =
	"flex flex-col gap-3.5 rounded-xl border border-border bg-[var(--desktop-panel)] px-4 py-3.5";
const panelHeadingClass = "flex items-center justify-between gap-3 p-0";

export function RightPanel(props: {
	appInfo?: AppInfo;
	selectionMessage: string;
	provider: ReturnType<typeof useProviderStatus>;
	pendingRequests: PendingRequest[];
	eventLog: string[];
}) {
	return (
		<aside className="flex min-h-0 flex-col gap-3.5 border-l border-border bg-[var(--desktop-panel)] p-[18px]">
			<section className={panelClass}>
				<div className={panelHeadingClass}>
					<p className={labelClass}>Runtime</p>
					<span className="size-[9px] rounded-full bg-[#30d158] shadow-[0_0_0_4px_rgba(48,209,88,0.12)]" />
				</div>
				<p className={valueClass}>
					{props.appInfo
						? `${props.appInfo.name} ${props.appInfo.version} · ${props.appInfo.platform}`
						: "Loading..."}
				</p>
				<p className={mutedClass}>{props.selectionMessage}</p>
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
			<section className={panelClass}>
				<div className={panelHeadingClass}>
					<p className={labelClass}>OpenAI OAuth</p>
					<Badge variant="secondary">
						{props.provider.statusLabel}
					</Badge>
				</div>
				<p className={mutedClass}>{props.provider.detail}</p>
				<div className="flex flex-wrap gap-2">
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
			<section className={`${panelClass} gap-2.5`}>
				<div className={panelHeadingClass}>
					<p className={labelClass}>Pending approvals</p>
					<Badge variant="outline">
						{props.pendingRequests.length}
					</Badge>
				</div>
				{props.pendingRequests.length === 0 ? (
					<p className={mutedClass}>No pending requests.</p>
				) : (
					props.pendingRequests.map((request) => (
						<p className={mutedClass} key={request.data.requestId}>
							{request.data.requestKind} ·{" "}
							{request.data.requestId}
						</p>
					))
				)}
			</section>
			<section className={`${panelClass} min-h-[180px] flex-1`}>
				<div className={panelHeadingClass}>
					<p className={labelClass}>Event log</p>
					<Badge variant="outline">{props.eventLog.length}</Badge>
				</div>
				<ScrollArea className="min-h-0 flex-1">
					<pre className="m-0 overflow-hidden whitespace-pre-wrap text-[12px] text-[var(--desktop-subtle)]">
						{props.eventLog.join("\n")}
					</pre>
				</ScrollArea>
			</section>
		</aside>
	);
}
