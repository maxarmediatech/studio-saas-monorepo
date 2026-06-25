import {
	IconChevronDown,
	IconFile,
	IconFolder,
	IconPhoto,
	IconPlayerPause,
	IconTerminal2,
} from "@tabler/icons-react";
import type { ConversationTimelinePart } from "../../conversations/conversationTimelineModel";
import { MarkdownText } from "./MarkdownText";

export function TimelinePart(props: { part: ConversationTimelinePart }) {
	const part = props.part;
	switch (part.kind) {
		case "text":
			return <MarkdownText text={part.text} />;
		case "file":
		case "image":
		case "context":
			return <ReferencePart part={part} />;
		case "tool":
			return <ProviderPart part={part} defaultOpen />;
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
	defaultOpen?: boolean;
}) {
	const part = props.part;
	const Icon = part.kind === "tool" ? IconTerminal2 : IconPlayerPause;
	const body = part.text || summarize(part.metadata);
	return (
		<details
			open={props.defaultOpen}
			className="group/provider rounded-md border border-border bg-background/45 p-2.5"
		>
			<summary className="flex cursor-pointer list-none items-center gap-1.5 text-[12px] font-medium text-[var(--desktop-strong)] marker:hidden">
				<IconChevronDown className="size-3.5 text-[var(--desktop-subtle)] transition group-open/provider:rotate-180" />
				<Icon className="size-3.5" />
				<span>{part.label}</span>
				{!props.defaultOpen ? (
					<span className="ml-auto truncate text-[11px] font-normal text-[var(--desktop-subtle)]">
						{preview(body)}
					</span>
				) : null}
			</summary>
			<pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words border-t border-border pt-2 text-[11px] text-[var(--desktop-subtle)]">
				{body}
			</pre>
		</details>
	);
}

function preview(value: string) {
	return value.replace(/\s+/g, " ").trim().slice(0, 90);
}

function summarize(value: unknown) {
	try {
		return JSON.stringify(value ?? {}, null, 2).slice(0, 1800);
	} catch {
		return String(value);
	}
}
