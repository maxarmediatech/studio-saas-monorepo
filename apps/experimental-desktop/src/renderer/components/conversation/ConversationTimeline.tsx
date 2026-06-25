import { IconChevronDown } from "@tabler/icons-react";
import {
	defaultRangeExtractor,
	useVirtualizer,
	type VirtualItem,
} from "@tanstack/react-virtual";
import {
	useCallback,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type UIEvent,
} from "react";
import type { ConversationTimelineRow as TimelineRowData } from "../../conversations/conversationTimelineModel";
import { cn } from "../../lib/utils";
import {
	createTimelineListAdapterPlan,
	estimateTimelineRowHeight,
	isTimelineNearBottom,
	shouldRestoreTimelineAnchor,
	type TimelineScrollAnchor,
} from "./conversationTimelineScroll";
import { TimelineRow } from "./TimelineRow";

type ScrollBehaviorMode = "auto" | "smooth";

export function ConversationTimeline(props: { rows: TimelineRowData[] }) {
	const viewportRef = useRef<HTMLDivElement | null>(null);
	const contentRef = useRef<HTMLDivElement | null>(null);
	const followBottomRef = useRef(true);
	const rowCountRef = useRef(0);
	const resizeFrameRef = useRef<number | null>(null);
	const anchorRef = useRef<TimelineScrollAnchor | undefined>(undefined);
	const listPlan = useMemo(
		() => createTimelineListAdapterPlan(props.rows),
		[props.rows],
	);
	const virtualized = listPlan.mode === "virtual-ready";
	const [showJumpToLatest, setShowJumpToLatest] = useState(false);
	const [anchorVersion, setAnchorVersion] = useState(0);

	const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
		count: props.rows.length,
		enabled: virtualized,
		getScrollElement: () => viewportRef.current,
		estimateSize: (index) => estimateTimelineRowHeight(props.rows[index] ?? props.rows.at(-1) ?? fallbackRow),
		getItemKey: (index) => props.rows[index]?.id ?? `removed:${index}`,
		overscan: 16,
		paddingEnd: 16,
		rangeExtractor: (range) => {
			const indexes = defaultRangeExtractor(range);
			const anchorIndex = anchorRef.current
				? props.rows.findIndex((row) => row.id === anchorRef.current?.rowId)
				: -1;
			return [
				...new Set([
					...indexes,
					...(anchorIndex >= 0 ? [anchorIndex] : []),
				]),
			].sort((first, second) => first - second);
		},
	});

	const scrollToLatest = useCallback((behavior: ScrollBehaviorMode = "smooth") => {
		const viewport = viewportRef.current;
		if (!viewport) {
			return;
		}
		if (virtualized && props.rows.length > 0) {
			virtualizer.scrollToIndex(props.rows.length - 1, {
				align: "end",
				behavior,
			});
		} else {
			viewport.scrollTo({
				top: viewport.scrollHeight,
				behavior,
			});
		}
		followBottomRef.current = true;
		anchorRef.current = undefined;
		setShowJumpToLatest(false);
	}, [props.rows.length, virtualized, virtualizer]);

	const updateFollowState = useCallback((viewport: HTMLDivElement) => {
		const nearBottom = isTimelineNearBottom(viewport);
		followBottomRef.current = nearBottom;
		const nextAnchor = nearBottom ? undefined : captureTimelineAnchor(viewport);
		anchorRef.current = nextAnchor;
		setAnchorVersion((version) => version + 1);
		setShowJumpToLatest(!nearBottom && viewport.scrollHeight > viewport.clientHeight);
	}, []);

	const onScroll = useCallback(
		(event: UIEvent<HTMLDivElement>) => {
			updateFollowState(event.currentTarget);
		},
		[updateFollowState],
	);

	useLayoutEffect(() => {
		if (props.rows.length === 0) {
			rowCountRef.current = 0;
			followBottomRef.current = true;
			anchorRef.current = undefined;
			setShowJumpToLatest(false);
			return;
		}

		const previousRowCount = rowCountRef.current;
		const firstRows = previousRowCount === 0;
		const wasFollowingBottom = followBottomRef.current;
		const anchor = anchorRef.current;
		rowCountRef.current = props.rows.length;
		if (firstRows || wasFollowingBottom) {
			scrollToLatest("auto");
			return;
		}

		const viewport = viewportRef.current;
		if (viewport) {
			if (
				shouldRestoreTimelineAnchor({
					wasFollowingBottom,
					previousRowCount,
					nextRowCount: props.rows.length,
					anchor,
				})
			) {
				restoreTimelineAnchor(viewport, anchor);
			}
			anchorRef.current = captureTimelineAnchor(viewport);
			setShowJumpToLatest(!isTimelineNearBottom(viewport));
		}
	}, [props.rows, scrollToLatest]);

	useLayoutEffect(() => {
		const content = contentRef.current;
		if (!content || typeof ResizeObserver === "undefined") {
			return;
		}

		const observer = new ResizeObserver(() => {
			if (resizeFrameRef.current !== null) {
				cancelAnimationFrame(resizeFrameRef.current);
			}
			resizeFrameRef.current = requestAnimationFrame(() => {
				resizeFrameRef.current = null;
				const viewport = viewportRef.current;
				if (!viewport) {
					return;
				}
				if (followBottomRef.current) {
					scrollToLatest("auto");
					return;
				}
				restoreTimelineAnchor(viewport, anchorRef.current);
				anchorRef.current = captureTimelineAnchor(viewport);
				setShowJumpToLatest(!isTimelineNearBottom(viewport));
			});
		});
		observer.observe(content);

		return () => {
			observer.disconnect();
			if (resizeFrameRef.current !== null) {
				cancelAnimationFrame(resizeFrameRef.current);
			}
		};
	}, [scrollToLatest]);

	const virtualItems = virtualized ? virtualizer.getVirtualItems() : [];
	const totalSize = virtualized ? virtualizer.getTotalSize() : undefined;

	return (
		<div className="relative h-full min-h-0 overflow-hidden">
			<div
				ref={viewportRef}
				data-conversation-timeline="viewport"
				className="h-full min-h-0 overflow-y-auto overscroll-y-contain"
				onScroll={onScroll}
			>
				<div
					ref={contentRef}
					data-conversation-timeline-content="true"
					data-timeline-list-mode={listPlan.mode}
					data-timeline-row-count={listPlan.rowCount}
					data-timeline-anchor-version={anchorVersion}
					className={cn(
						"mx-auto min-h-full w-full max-w-[980px] px-2 py-4",
						virtualized ? "" : "flex flex-col gap-3",
					)}
				>
					{virtualized ? (
						<div
							data-timeline-virtual-window="tanstack"
							className="relative w-full"
							style={{ height: totalSize }}
						>
							{virtualItems.map((item) => {
								const row = props.rows[item.index];
								return row ? (
									<TimelineListItem
										key={item.key}
										row={row}
										virtualItem={item}
										measureElement={virtualizer.measureElement}
									/>
								) : null;
							})}
						</div>
					) : (
						props.rows.map((row) => (
							<TimelineListItem key={row.id} row={row} />
						))
					)}
				</div>
			</div>

			<button
				type="button"
				tabIndex={showJumpToLatest ? 0 : -1}
				aria-label="Jump to latest message"
				onClick={() => scrollToLatest("smooth")}
				className={cn(
					"absolute bottom-4 left-1/2 z-20 -translate-x-1/2",
					"inline-flex items-center gap-1.5 rounded-full border border-border bg-background/90 px-3 py-1.5",
					"text-[12px] font-medium text-[var(--desktop-strong)] shadow-lg backdrop-blur",
					"transition duration-150 ease-out hover:border-[var(--desktop-border-strong)] hover:bg-background",
					"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
					showJumpToLatest
						? "translate-y-0 opacity-100"
						: "pointer-events-none translate-y-1 opacity-0",
				)}
			>
				<IconChevronDown className="size-3.5" aria-hidden />
				<span>Latest</span>
			</button>
		</div>
	);
}

function TimelineListItem(props: {
	row: TimelineRowData;
	virtualItem?: VirtualItem;
	measureElement?: (node: HTMLDivElement | null) => void;
}) {
	const style: CSSProperties | undefined = props.virtualItem
		? {
				position: "absolute",
				left: 0,
				right: 0,
				transform: `translateY(${props.virtualItem.start}px)`,
			}
		: undefined;

	return (
		<div
			ref={props.measureElement}
			data-index={props.virtualItem?.index}
			data-timeline-list-item={props.row.id}
			data-timeline-list-size={props.row.sizeHint}
			data-timeline-list-index={props.virtualItem?.index}
			className={cn("min-w-0", props.virtualItem ? "pb-3" : "")}
			style={style}
		>
			<TimelineRow row={props.row} />
		</div>
	);
}

function captureTimelineAnchor(
	viewport: HTMLElement,
): TimelineScrollAnchor | undefined {
	const viewportTop = viewport.getBoundingClientRect().top;
	const items = Array.from(
		viewport.querySelectorAll<HTMLElement>("[data-timeline-list-item]"),
	);
	for (const item of items) {
		const rect = item.getBoundingClientRect();
		if (rect.bottom < viewportTop + 1) {
			continue;
		}
		const rowId = item.dataset.timelineListItem;
		if (!rowId) {
			continue;
		}
		return {
			rowId,
			topOffset: rect.top - viewportTop,
		};
	}
	return undefined;
}

function restoreTimelineAnchor(
	viewport: HTMLElement,
	anchor?: TimelineScrollAnchor,
) {
	if (!anchor) {
		return;
	}
	const nextItem = findTimelineListItem(viewport, anchor.rowId);
	if (!nextItem) {
		return;
	}
	const viewportTop = viewport.getBoundingClientRect().top;
	const nextOffset = nextItem.getBoundingClientRect().top - viewportTop;
	viewport.scrollTop += nextOffset - anchor.topOffset;
}

function findTimelineListItem(viewport: HTMLElement, rowId: string) {
	const items = Array.from(
		viewport.querySelectorAll<HTMLElement>("[data-timeline-list-item]"),
	);
	for (const item of items) {
		if (item.dataset.timelineListItem === rowId) {
			return item;
		}
	}
	return undefined;
}

const fallbackRow: TimelineRowData = {
	id: "fallback",
	kind: "message",
	semanticKind: "system_notice",
	anchorId: "fallback",
	signature: "fallback",
	sizeHint: "message",
	role: "system",
	status: "completed",
	text: "",
	time: "1970-01-01T00:00:00.000Z",
	parts: [],
};
