import {
	IconCheck,
	IconChevronDown,
	IconChevronUp,
	IconCopy,
	IconRobot,
	IconUser,
} from "@tabler/icons-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ConversationTimelineRow } from "../../conversations/conversationTimelineModel";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { MarkdownText } from "./MarkdownText";
import { TimelinePart } from "./TimelinePart";
import {
	assistantFooterLabel,
	formatTimelineTime,
	timelineAssistantReplyText,
	timelineMessagePlainText,
} from "./timelineText";

type MessageRow = Extract<ConversationTimelineRow, { kind: "message" }>;

const USER_MESSAGE_COLLAPSE_HEIGHT = 300;

export function UserMessageRow(props: { row: MessageRow }) {
	return <MessageBubbleRow row={props.row} align="end" collapsible />;
}

export function AssistantMessageRow(props: { row: MessageRow }) {
	return <MessageBubbleRow row={props.row} align="start" assistantFooter />;
}

export function SystemMessageRow(props: { row: MessageRow }) {
	return <MessageBubbleRow row={props.row} align="start" fullWidth />;
}

function MessageBubbleRow(props: {
	row: MessageRow;
	align: "start" | "end";
	fullWidth?: boolean;
	collapsible?: boolean;
	assistantFooter?: boolean;
}) {
	const row = props.row;
	const alignUser = props.align === "end";
	const copyText = props.assistantFooter
		? timelineAssistantReplyText(row)
		: timelineMessagePlainText(row);
	return (
		<article
			data-timeline-row={row.semanticKind}
			data-timeline-anchor={row.anchorId}
			data-timeline-size={row.sizeHint}
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
					props.fullWidth && "max-w-full bg-transparent",
				)}
			>
				<MessageHeader row={row} copyText={copyText} />
				<MessageBody row={row} collapsible={Boolean(props.collapsible)} />
				{props.assistantFooter ? (
					<AssistantFooter row={row} copyText={copyText} />
				) : null}
			</div>
		</article>
	);
}

function MessageBody(props: { row: MessageRow; collapsible: boolean }) {
	const contentRef = useRef<HTMLDivElement | null>(null);
	const [overflowing, setOverflowing] = useState(false);
	const [expanded, setExpanded] = useState(false);
	const clamped = props.collapsible && overflowing && !expanded;

	useLayoutEffect(() => {
		const element = contentRef.current;
		if (!element || !props.collapsible) {
			return;
		}
		const updateOverflow = () => {
			setOverflowing(element.scrollHeight > USER_MESSAGE_COLLAPSE_HEIGHT);
		};
		if (typeof ResizeObserver === "undefined") {
			updateOverflow();
			return;
		}
		const observer = new ResizeObserver(updateOverflow);
		observer.observe(element);
		updateOverflow();
		return () => observer.disconnect();
	}, [props.collapsible, props.row.signature]);

	return (
		<div className="flex flex-col gap-2">
			<div
				ref={contentRef}
				style={clamped ? { maxHeight: USER_MESSAGE_COLLAPSE_HEIGHT } : undefined}
				className={cn(
					"flex flex-col gap-2",
					clamped &&
						"overflow-hidden [mask-image:linear-gradient(to_bottom,black_calc(100%-4rem),transparent)]",
				)}
			>
				{props.row.parts.length > 0 ? (
					props.row.parts.map((part) => (
						<TimelinePart key={part.id} part={part} />
					))
				) : (
					<MarkdownText text={props.row.text || "(empty)"} />
				)}
			</div>

			{props.collapsible && overflowing ? (
				<button
					type="button"
					data-scroll-anchor-ignore="true"
					onClick={() => setExpanded((value) => !value)}
					className="inline-flex w-fit items-center gap-1 text-[12px] font-medium text-[var(--desktop-subtle)] transition hover:text-[var(--desktop-strong)]"
				>
					{expanded ? (
						<IconChevronUp className="size-3.5" />
					) : (
						<IconChevronDown className="size-3.5" />
					)}
					{expanded ? "Show less" : "Show full message"}
				</button>
			) : null}
		</div>
	);
}

function MessageHeader(props: { row: MessageRow; copyText: string }) {
	const row = props.row;
	return (
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
			<span className="inline-flex shrink-0 items-center gap-1.5">
				<CopyTextButton text={props.copyText} label="Copy message" />
				<time className="tabular-nums">{formatTimelineTime(row.time)}</time>
			</span>
		</div>
	);
}

function AssistantFooter(props: { row: MessageRow; copyText: string }) {
	const [now, setNow] = useState(Date.now());
	const running = props.row.status === "streaming" || props.row.status === "pending";

	useEffect(() => {
		if (!running || !props.row.startedAt) {
			return;
		}
		const timer = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(timer);
	}, [props.row.startedAt, running]);

	const label = assistantFooterLabel(props.row, now);
	return (
		<div className="mt-2 flex items-center gap-2 border-t border-border/60 pt-2 text-[12px] text-[var(--desktop-subtle)]">
			<span className="truncate">{label}</span>
			<span className="h-1 w-1 rounded-full bg-[var(--desktop-subtle)]/45" />
			<CopyTextButton text={props.copyText} label="Copy reply" variant="text" />
		</div>
	);
}

function CopyTextButton(props: {
	text: string;
	label: string;
	variant?: "icon" | "text";
}) {
	const [copied, setCopied] = useState(false);
	const disabled = props.text.trim() === "";
	const variant = props.variant ?? "icon";
	const title = copied ? "Copied" : props.label;

	async function copy() {
		if (disabled) {
			return;
		}
		await writeClipboardText(props.text);
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1200);
	}

	if (variant === "text") {
		return (
			<button
				type="button"
				disabled={disabled}
				onClick={() => void copy()}
				className="inline-flex items-center gap-1 rounded-md text-[12px] font-medium text-[var(--desktop-subtle)] transition hover:text-[var(--desktop-strong)] disabled:cursor-not-allowed disabled:opacity-40"
			>
				{copied ? <IconCheck className="size-3.5" /> : <IconCopy className="size-3.5" />}
				{copied ? "Copied" : "Copy reply"}
			</button>
		);
	}

	return (
		<button
			type="button"
			disabled={disabled}
			title={title}
			aria-label={title}
			onClick={() => void copy()}
			className="inline-flex size-6 items-center justify-center rounded-md text-[var(--desktop-subtle)] opacity-0 transition hover:bg-background/55 hover:text-[var(--desktop-strong)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
		>
			{copied ? <IconCheck className="size-3.5" /> : <IconCopy className="size-3.5" />}
		</button>
	);
}

async function writeClipboardText(value: string) {
	if (navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(value);
		return;
	}
	const textArea = document.createElement("textarea");
	textArea.value = value;
	textArea.style.position = "fixed";
	textArea.style.opacity = "0";
	document.body.append(textArea);
	textArea.select();
	document.execCommand("copy");
	textArea.remove();
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
