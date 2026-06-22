import type { PendingRequest, TranscriptItem } from "../app/types";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";

const labelClass = "m-0 text-[12px] font-medium text-[var(--desktop-subtle)]";
const valueClass = "m-0 font-semibold text-[var(--desktop-strong)]";
const preClass =
	"m-0 overflow-hidden whitespace-pre-wrap text-[12px] text-[var(--desktop-subtle)]";

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
		<section className="flex min-h-0 w-[min(100%,980px)] flex-1 flex-col self-center rounded-xl border border-border bg-[var(--desktop-panel)]">
			<div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5">
				<div>
					<p className={labelClass}>Conversation</p>
					<p className={valueClass}>{props.status}</p>
				</div>
				<p className={labelClass}>{props.threadId ?? "No session"}</p>
			</div>
			<ScrollArea className="min-h-0 flex-1">
				<div className="flex flex-col gap-3 p-4">
					{props.transcript.length === 0 ? (
						<p className="m-0 font-mono text-[var(--desktop-subtle)]">
							Conversation output will appear here.
						</p>
					) : (
						props.transcript.map((item) => (
							<TranscriptRow item={item} key={item.id} />
						))
					)}
				</div>
			</ScrollArea>
			{props.pendingRequests.length > 0 ? (
				<div className="flex flex-col gap-2.5 border-t border-border p-3.5">
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
		<article
			className={cn(
				"rounded-[10px] border border-border p-3",
				item.type === "user" && "bg-[var(--desktop-selected)]",
				item.type === "assistant" && "bg-[var(--desktop-soft)]",
			)}
		>
			<div className="flex justify-between text-[12px] text-[var(--desktop-subtle)]">
				<span>{item.type}</span>
				<time>{new Date(item.time).toLocaleTimeString()}</time>
			</div>
			<p className="mb-0 mt-2 whitespace-pre-wrap">
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
		<article className="grid gap-3 rounded-[10px] border border-border bg-[var(--desktop-selected)] p-3">
			<div>
				<p className="mb-2 mt-0 font-semibold text-[var(--desktop-strong)]">
					{props.request.data.requestKind} request
				</p>
				<pre className={preClass}>
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
