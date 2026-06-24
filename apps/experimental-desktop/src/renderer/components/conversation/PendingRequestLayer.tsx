import type { PendingRequest } from "../../app/types";
import { Button } from "../ui/button";

export function PendingRequestLayer(props: {
	requests: PendingRequest[];
	onRespond: (
		requestId: string,
		decision: "accept" | "acceptForSession" | "decline" | "cancel",
	) => Promise<void>;
}) {
	if (props.requests.length === 0) {
		return null;
	}
	return (
		<div className="px-2 py-3">
			<div className="mx-auto flex w-full max-w-[820px] flex-col gap-2">
				{props.requests.map((request) => (
					<PendingRequestCard
						key={request.data.requestId}
						request={request}
						onRespond={props.onRespond}
					/>
				))}
			</div>
		</div>
	);
}

function PendingRequestCard(props: {
	request: PendingRequest;
	onRespond: (
		requestId: string,
		decision: "accept" | "acceptForSession" | "decline" | "cancel",
	) => Promise<void>;
}) {
	const requestId = props.request.data.requestId;
	return (
		<article className="grid gap-2 rounded-lg border border-border bg-[var(--desktop-panel)] px-3 py-2.5">
			<div className="min-w-0">
				<p className="m-0 text-[13px] font-semibold text-[var(--desktop-strong)]">
					{props.request.data.requestKind} request
				</p>
				<pre className="m-0 max-h-28 overflow-auto whitespace-pre-wrap break-words text-[11px] text-[var(--desktop-subtle)]">
					{summarizeRequest(props.request.data.raw)}
				</pre>
			</div>
			<div className="flex flex-wrap gap-2">
				<Button
					size="xs"
					type="button"
					onClick={() => void props.onRespond(requestId, "accept")}
				>
					Accept Once
				</Button>
				<Button
					size="xs"
					variant="secondary"
					type="button"
					onClick={() =>
						void props.onRespond(requestId, "acceptForSession")
					}
				>
					Accept For Session
				</Button>
				<Button
					size="xs"
					variant="outline"
					type="button"
					onClick={() => void props.onRespond(requestId, "decline")}
				>
					Decline
				</Button>
				<Button
					size="xs"
					variant="ghost"
					type="button"
					onClick={() => void props.onRespond(requestId, "cancel")}
				>
					Cancel
				</Button>
			</div>
		</article>
	);
}

function summarizeRequest(value: unknown) {
	try {
		return JSON.stringify(value, null, 2).slice(0, 1200);
	} catch {
		return String(value);
	}
}
