import type { PendingRequest, TranscriptItem } from "../app/types";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";

export function SessionPanel(props: {
	status: string;
	threadId?: string;
	transcript: TranscriptItem[];
	eventLog: string[];
	pendingRequests: PendingRequest[];
	onRespond: (
		requestId: string,
		decision: "accept" | "acceptForSession" | "decline" | "cancel",
	) => Promise<void>;
}) {
	return (
		<section className="session-stream">
			<div className="stream-header">
				<div>
					<p className="label">Codex Session</p>
					<p className="value">{props.status}</p>
				</div>
				<p className="label">{props.threadId ?? "No session"}</p>
			</div>
			<ScrollArea className="transcript-scroll">
				<div className="transcript-list">
					{props.transcript.length === 0 ? (
						<p className="empty-copy">
							Session output will appear here.
						</p>
					) : (
						props.transcript.map((item) => (
							<TranscriptRow item={item} key={item.id} />
						))
					)}
				</div>
			</ScrollArea>
			{props.pendingRequests.length > 0 ? (
				<div className="request-stack">
					{props.pendingRequests.map((request) => (
						<ApprovalRequestCard
							request={request}
							key={request.data.requestId}
							onRespond={props.onRespond}
						/>
					))}
				</div>
			) : null}
		</section>
	);
}

function TranscriptRow(props: { item: TranscriptItem }) {
	const item = props.item;
	return (
		<article className={`transcript-row ${item.type}`}>
			<div className="transcript-meta">
				<span>{item.type}</span>
				<time>{new Date(item.time).toLocaleTimeString()}</time>
			</div>
			<p>
				{item.type === "approval"
					? `${item.requestKind} approval requested`
					: item.text}
			</p>
		</article>
	);
}

function ApprovalRequestCard(props: {
	request: PendingRequest;
	onRespond: (
		requestId: string,
		decision: "accept" | "acceptForSession" | "decline" | "cancel",
	) => Promise<void>;
}) {
	const requestId = props.request.data.requestId;
	return (
		<article className="request-card">
			<div>
				<p className="request-title">
					{props.request.data.requestKind} request
				</p>
				<pre>{summarizeRequest(props.request.data.raw)}</pre>
			</div>
			<div className="request-actions">
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
