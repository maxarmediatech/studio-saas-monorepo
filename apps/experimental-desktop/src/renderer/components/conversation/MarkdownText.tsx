import { Fragment, type ReactNode } from "react";
import { cn } from "../../lib/utils";

type MarkdownBlock =
	| { kind: "code"; id: string; language: string | null; text: string }
	| { kind: "heading"; id: string; depth: 1 | 2 | 3; text: string }
	| { kind: "list"; id: string; ordered: boolean; items: string[] }
	| { kind: "paragraph"; id: string; text: string };

export function MarkdownText(props: {
	text: string;
	className?: string;
}) {
	const blocks = parseMarkdownBlocks(props.text);
	return (
		<div className={cn("flex flex-col gap-2", props.className)}>
			{blocks.map((block) => (
				<MarkdownBlockView key={block.id} block={block} />
			))}
		</div>
	);
}

function MarkdownBlockView(props: { block: MarkdownBlock }) {
	const block = props.block;
	if (block.kind === "code") {
		return (
			<div className="overflow-hidden rounded-md border border-border bg-background/55">
				{block.language ? (
					<div className="border-b border-border px-2.5 py-1 text-[11px] font-medium text-[var(--desktop-subtle)]">
						{block.language}
					</div>
				) : null}
				<pre className="m-0 max-h-72 overflow-auto p-2.5 text-[12px] leading-5 text-[var(--desktop-strong)]">
					<code>{block.text}</code>
				</pre>
			</div>
		);
	}
	if (block.kind === "heading") {
		const Tag = block.depth === 1 ? "h3" : block.depth === 2 ? "h4" : "h5";
		return (
			<Tag className="m-0 text-[14px] font-semibold leading-6 text-[var(--desktop-strong)]">
				{renderInlineMarkdown(block.text)}
			</Tag>
		);
	}
	if (block.kind === "list") {
		const Tag = block.ordered ? "ol" : "ul";
		return (
			<Tag className={cn("m-0 pl-5 text-[14px] leading-6 text-[var(--desktop-strong)]", block.ordered ? "list-decimal" : "list-disc")}>
				{block.items.map((item, index) => (
					<li key={`${block.id}:${index}`}>{renderInlineMarkdown(item)}</li>
				))}
			</Tag>
		);
	}
	return (
		<p className="m-0 whitespace-pre-wrap break-words text-[14px] leading-6 text-[var(--desktop-strong)]">
			{renderInlineMarkdown(block.text)}
		</p>
	);
}

function parseMarkdownBlocks(value: string): MarkdownBlock[] {
	const lines = value.replace(/\r\n/g, "\n").split("\n");
	const blocks: MarkdownBlock[] = [];
	let paragraph: string[] = [];
	let list: { ordered: boolean; items: string[] } | null = null;
	let code: { language: string | null; lines: string[] } | null = null;

	function flushParagraph() {
		if (paragraph.length === 0) return;
		blocks.push({
			kind: "paragraph",
			id: `paragraph:${blocks.length}`,
			text: paragraph.join("\n").trim(),
		});
		paragraph = [];
	}

	function flushList() {
		if (!list) return;
		blocks.push({
			kind: "list",
			id: `list:${blocks.length}`,
			ordered: list.ordered,
			items: list.items,
		});
		list = null;
	}

	for (const line of lines) {
		const fence = line.match(/^```\s*([^`]*)\s*$/);
		if (fence) {
			if (code) {
				blocks.push({
					kind: "code",
					id: `code:${blocks.length}`,
					language: code.language,
					text: code.lines.join("\n"),
				});
				code = null;
				continue;
			}
			flushParagraph();
			flushList();
			code = { language: fence[1]?.trim() || null, lines: [] };
			continue;
		}
		if (code) {
			code.lines.push(line);
			continue;
		}

		const heading = line.match(/^(#{1,3})\s+(.+)$/);
		if (heading) {
			flushParagraph();
			flushList();
			blocks.push({
				kind: "heading",
				id: `heading:${blocks.length}`,
				depth: heading[1].length as 1 | 2 | 3,
				text: heading[2].trim(),
			});
			continue;
		}

		const unordered = line.match(/^\s*[-*]\s+(.+)$/);
		const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
		if (unordered || ordered) {
			flushParagraph();
			const nextOrdered = Boolean(ordered);
			if (list && list.ordered !== nextOrdered) {
				flushList();
			}
			list ??= { ordered: nextOrdered, items: [] };
			list.items.push((ordered?.[1] ?? unordered?.[1] ?? "").trim());
			continue;
		}

		if (line.trim() === "") {
			flushParagraph();
			flushList();
			continue;
		}
		flushList();
		paragraph.push(line);
	}

	if (code) {
		blocks.push({
			kind: "code",
			id: `code:${blocks.length}`,
			language: code.language,
			text: code.lines.join("\n"),
		});
	}
	flushParagraph();
	flushList();

	return blocks.length > 0
		? blocks
		: [{ kind: "paragraph", id: "paragraph:empty", text: "" }];
}

function renderInlineMarkdown(value: string): ReactNode[] {
	const nodes: ReactNode[] = [];
	const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
	let lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(value))) {
		if (match.index > lastIndex) {
			nodes.push(value.slice(lastIndex, match.index));
		}
		if (match[2]) {
			nodes.push(<strong key={`strong:${match.index}`}>{match[2]}</strong>);
		} else if (match[3]) {
			nodes.push(
				<code
					key={`code:${match.index}`}
					className="rounded bg-background/60 px-1 py-0.5 font-mono text-[12px]"
				>
					{match[3]}
				</code>,
			);
		}
		lastIndex = pattern.lastIndex;
	}
	if (lastIndex < value.length) {
		nodes.push(value.slice(lastIndex));
	}
	return nodes.map((node, index) => <Fragment key={index}>{node}</Fragment>);
}
