import {
	IconAlertTriangle,
	IconFile,
	IconFolder,
	IconPhoto,
	IconPlayerPause,
	IconRobot,
	IconTerminal2,
	IconUser,
} from "@tabler/icons-react";
import type {
	ConversationTimelinePart,
	ConversationTimelineRow,
} from "../../conversations/conversationTimelineModel";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";

export function TimelineRow(props: { row: ConversationTimelineRow }) {
	const row = props.row;
	if (row.kind === "request") {
		return <RequestRow row={row} />;
	}
	if (row.kind === "event") {
		return <EventRow row={row} />;
	}
	const alignUser = row.role === "user";
	return (
		<article
			className={cn(
				"group flex w-full",
				alignUser ? "justify-end" : "justify-start",
			)}
		>
			<div
				className={cn(
					"min-w-0 max-w-[82%] rounded-lg border border-border px-3.5 py-3",
					alignUser
						? "bg-[var(--desktop-selected)]"
						: "bg-[var(--desktop-soft)]",
					row.role === "system" && "max-w-full bg-transparent",
				)}
			>
				<div className="mb-2 flex items-center justify-between gap-3 text-[12px] text-[var(--desktop-subtle)]">
					<span className="inline-flex min-w-0 items-center gap-1.5">
						{row.role === "user" ? (
							<IconUser className="size-3.5 shrink-0" />
						) : (
							<IconRobot className="size-3.5 shrink-0" />
						)}
						<span className="truncate">{roleLabel(row.role)}</span>
						{row.status && row.status !== "completed" ? (
							<Badge variant="outline" className="h-5 rounded-md px-1.5">
								{row.status}
							</Badge>
						) : null}
					</span>
					<time className="shrink-0 tabular-nums">
						{formatTime(row.time)}
					</time>
				</div>
				<div className="flex flex-col gap-2">
					{row.parts.length > 0 ? (
						row.parts.map((part) => (
							<TimelinePart key={part.id} part={part} />
						))
					) : (
						<p className="m-0 whitespace-pre-wrap break-words text-[14px] leading-6 text-[var(--desktop-strong)]">
							{row.text || "(empty)"}
						</p>
					)}
				</div>
			</div>
		</article>
	);
}

function TimelinePart(props: { part: ConversationTimelinePart }) {
	const part = props.part;
	switch (part.kind) {
		case "text":
			return (
				<p className="m-0 whitespace-pre-wrap break-words text-[14px] leading-6 text-[var(--desktop-strong)]">
					{part.text}
				</p>
			);
		case "file":
		case "image":
		case "context":
			return <ReferencePart part={part} />;
		case "tool":
		case "approval":
		case "raw":
			return <ProviderPart part={part} />;
	}
}

function ReferencePart(props: {
	part: Extract<
		ConversationTimelinePart,
		{ kind: "file" | "image" | "context" }
	>;
}) {
	const part = props.part;
	const Icon =
		part.kind === "image" ? IconPhoto : part.kind === "context" ? IconFolder : IconFile;
	return (
		<div className="flex min-w-0 items-start gap-2 rounded-md border border-border bg-background/45 px-2.5 py-2 text-[12px]">
			<Icon className="mt-0.5 size-4 shrink-0 text-[var(--desktop-subtle)]" />
			<div className="min-w-0">
				<p className="m-0 truncate font-medium text-[var(--desktop-strong)]">
					{part.label}
				</p>
				{part.path ? (
					<p className="m-0 truncate font-mono text-[11px] text-[var(--desktop-subtle)]">
						{part.path}
					</p>
				) : null}
				{"mimeType" in part && part.mimeType ? (
					<p className="m-0 text-[11px] text-[var(--desktop-subtle)]">
						{part.mimeType}
					</p>
				) : null}
			</div>
		</div>
	);
}

function ProviderPart(props: {
	part: Extract<
		ConversationTimelinePart,
		{ kind: "tool" | "approval" | "raw" }
	>;
}) {
	const part = props.part;
	const Icon = part.kind === "tool" ? IconTerminal2 : IconPlayerPause;
	return (
		<div className="rounded-md border border-border bg-background/45 p-2.5">
			<div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-[var(--desktop-strong)]">
				<Icon className="size-3.5" />
				{part.label}
			</div>
			<pre className="m-0 max-h-44 overflow-auto whitespace-pre-wrap break-words text-[11px] text-[var(--desktop-subtle)]">
				{part.text || summarize(part.metadata)}
			</pre>
		</div>
	);
}

function RequestRow(props: {
	row: Extract<ConversationTimelineRow, { kind: "request" }>;
}) {
	return (
		<article className="mx-auto w-full max-w-[760px] rounded-lg border border-border bg-[var(--desktop-selected)] px-3 py-2.5">
			<div className="flex items-center justify-between gap-3">
				<div className="min-w-0">
					<p className="m-0 text-[13px] font-medium text-[var(--desktop-strong)]">
						{props.row.requestKind} approval
					</p>
					<p className="m-0 truncate font-mono text-[11px] text-[var(--desktop-subtle)]">
						{props.row.requestId}
					</p>
				</div>
				<Badge
					variant={props.row.pending ? "default" : "outline"}
					className="rounded-md"
				>
					{props.row.pending ? "pending" : "resolved"}
				</Badge>
			</div>
		</article>
	);
}

function EventRow(props: {
	row: Extract<ConversationTimelineRow, { kind: "event" }>;
}) {
	return (
		<article
			className={cn(
				"mx-auto flex w-full max-w-[760px] gap-2 rounded-lg border px-3 py-2.5 text-[13px]",
				props.row.tone === "error"
					? "border-destructive/30 bg-destructive/10"
					: "border-border bg-background/35",
			)}
		>
			<IconAlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--desktop-subtle)]" />
			<div className="min-w-0">
				<p className="m-0 font-medium text-[var(--desktop-strong)]">
					{props.row.title}
				</p>
				{props.row.text ? (
					<p className="m-0 whitespace-pre-wrap break-words text-[var(--desktop-subtle)]">
						{props.row.text}
					</p>
				) : null}
			</div>
		</article>
	);
}

function roleLabel(role: "user" | "assistant" | "system") {
	if (role === "assistant") {
		return "Assistant";
	}
	if (role === "system") {
		return "System";
	}
	return "You";
}

function formatTime(value: string) {
	return new Date(value).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
}

function summarize(value: unknown) {
	try {
		return JSON.stringify(value ?? {}, null, 2).slice(0, 900);
	} catch {
		return String(value);
	}
}
