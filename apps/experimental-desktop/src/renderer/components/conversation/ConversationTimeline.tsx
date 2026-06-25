import {
	IconChevronDown,
	IconChevronUp,
	IconSearch,
	IconX,
} from "@tabler/icons-react";
import {
	defaultRangeExtractor,
	useVirtualizer,
	type VirtualItem,
} from "@tanstack/react-virtual";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type KeyboardEvent,
	type UIEvent,
} from "react";
import type { ConversationTimelineRow as TimelineRowData } from "../../conversations/conversationTimelineModel";
import { cn } from "../../lib/utils";
import {
	buildTimelineLandmarks,
	buildTimelineSearchMatches,
	type TimelineLandmark,
} from "./conversationTimelineNavigation";
import {
	createTimelineListAdapterPlan,
	estimateTimelineRowHeight,
	isTimelineNearBottom,
	shouldRestoreTimelineAnchor,
	type TimelineScrollAnchor,
} from "./conversationTimelineScroll";
import {
	readConversationTimelineScrollSnapshot,
	writeConversationTimelineScrollSnapshot,
} from "./conversationTimelineScrollStore";
import { TimelineRow } from "./TimelineRow";

type ScrollBehaviorMode = "auto" | "smooth";
type ScrollAlignMode = "start" | "center" | "end";

export function ConversationTimeline(props: {
	rows: TimelineRowData[];
	conversationId?: string;
}) {
	const viewportRef = useRef<HTMLDivElement | null>(null);
	const contentRef = useRef<HTMLDivElement | null>(null);
	const searchInputRef = useRef<HTMLInputElement | null>(null);
	const followBottomRef = useRef(true);
	const rowCountRef = useRef(0);
	const resizeFrameRef = useRef<number | null>(null);
	const highlightTimerRef = useRef<number | null>(null);
	const restoredConversationRef = useRef<string | undefined>(undefined);
	const anchorRef = useRef<TimelineScrollAnchor | undefined>(undefined);
	const listPlan = useMemo(
		() => createTimelineListAdapterPlan(props.rows),
		[props.rows],
	);
	const virtualized = listPlan.mode === "virtual-ready";
	const landmarks = useMemo(() => buildTimelineLandmarks(props.rows), [props.rows]);
	const [showJumpToLatest, setShowJumpToLatest] = useState(false);
	const [anchorVersion, setAnchorVersion] = useState(0);
	const [activeAnchorId, setActiveAnchorId] = useState<string | undefined>();
	const [highlightedRowId, setHighlightedRowId] = useState<string | undefined>();
	const [searchOpen, setSearchOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const searchMatches = useMemo(
		() => buildTimelineSearchMatches(props.rows, searchQuery),
		[props.rows, searchQuery],
	);
	const [activeMatchIndex, setActiveMatchIndex] = useState(-1);

	const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
		count: props.rows.length,
		enabled: virtualized,
		getScrollElement: () => viewportRef.current,
		estimateSize: (index) =>
			estimateTimelineRowHeight(
				props.rows[index] ?? props.rows.at(-1) ?? fallbackRow,
			),
		getItemKey: (index) => props.rows[index]?.id ?? `removed:${index}`,
		overscan: 16,
		paddingEnd: 16,
		rangeExtractor: (range) => {
			const indexes = defaultRangeExtractor(range);
			const anchorIndex = anchorRef.current
				? props.rows.findIndex((row) => row.id === anchorRef.current?.rowId)
				: -1;
			const highlightedIndex = highlightedRowId
				? props.rows.findIndex((row) => row.id === highlightedRowId)
				: -1;
			return [
				...new Set([
					...indexes,
					...(anchorIndex >= 0 ? [anchorIndex] : []),
					...(highlightedIndex >= 0 ? [highlightedIndex] : []),
				]),
			].sort((first, second) => first - second);
		},
	});

	const persistScrollSnapshotForConversation = useCallback((
		conversationId: string | undefined,
		viewport: HTMLDivElement,
	) => {
		if (!conversationId) {
			return;
		}
		writeConversationTimelineScrollSnapshot(conversationId, {
			anchor: anchorRef.current,
			followingBottom: followBottomRef.current,
			scrollTop: viewport.scrollTop,
		});
	}, []);

	const persistScrollSnapshot = useCallback((viewport: HTMLDivElement) => {
		persistScrollSnapshotForConversation(props.conversationId, viewport);
	}, [persistScrollSnapshotForConversation, props.conversationId]);

	const highlightRow = useCallback((rowId: string) => {
		setHighlightedRowId(rowId);
		if (highlightTimerRef.current !== null) {
			window.clearTimeout(highlightTimerRef.current);
		}
		highlightTimerRef.current = window.setTimeout(() => {
			highlightTimerRef.current = null;
			setHighlightedRowId(undefined);
		}, 1800);
	}, []);

	const scrollToRow = useCallback((
		rowId: string,
		behavior: ScrollBehaviorMode = "smooth",
		align: ScrollAlignMode = "center",
	) => {
		const index = props.rows.findIndex((row) => row.id === rowId);
		if (index < 0) {
			return false;
		}
		followBottomRef.current = false;
		anchorRef.current = { rowId, topOffset: 0 };
		setActiveAnchorId(rowId);
		setShowJumpToLatest(true);
		highlightRow(rowId);
		if (virtualized) {
			virtualizer.scrollToIndex(index, { align, behavior });
			return true;
		}
		const item = findTimelineListItem(viewportRef.current, rowId);
		item?.scrollIntoView({ block: align, behavior });
		return true;
	}, [highlightRow, props.rows, virtualized, virtualizer]);

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
		setActiveAnchorId(undefined);
		setShowJumpToLatest(false);
		persistScrollSnapshot(viewport);
	}, [persistScrollSnapshot, props.rows.length, virtualized, virtualizer]);

	const restoreSavedScrollSnapshot = useCallback(() => {
		if (!props.conversationId || props.rows.length === 0) {
			return false;
		}
		const snapshot = readConversationTimelineScrollSnapshot(props.conversationId);
		if (!snapshot || snapshot.followingBottom) {
			return false;
		}
		const viewport = viewportRef.current;
		if (!viewport) {
			return false;
		}
		followBottomRef.current = false;
		anchorRef.current = snapshot.anchor;
		setActiveAnchorId(snapshot.anchor?.rowId);
		setShowJumpToLatest(true);
		if (snapshot.anchor?.rowId) {
			const index = props.rows.findIndex((row) => row.id === snapshot.anchor?.rowId);
			if (index >= 0 && virtualized) {
				virtualizer.scrollToIndex(index, { align: "start", behavior: "auto" });
				requestAnimationFrame(() => {
					restoreTimelineAnchor(viewport, snapshot.anchor);
				});
				return true;
			}
			if (restoreTimelineAnchor(viewport, snapshot.anchor)) {
				return true;
			}
		}
		viewport.scrollTop = snapshot.scrollTop;
		return true;
	}, [props.conversationId, props.rows, virtualized, virtualizer]);

	const updateFollowState = useCallback((viewport: HTMLDivElement) => {
		const nearBottom = isTimelineNearBottom(viewport);
		followBottomRef.current = nearBottom;
		const nextAnchor = nearBottom ? undefined : captureTimelineAnchor(viewport);
		anchorRef.current = nextAnchor;
		setActiveAnchorId(nextAnchor?.rowId);
		setAnchorVersion((version) => version + 1);
		setShowJumpToLatest(!nearBottom && viewport.scrollHeight > viewport.clientHeight);
		persistScrollSnapshot(viewport);
	}, [persistScrollSnapshot]);

	const onScroll = useCallback(
		(event: UIEvent<HTMLDivElement>) => {
			updateFollowState(event.currentTarget);
		},
		[updateFollowState],
	);

	const jumpToSearchMatch = useCallback((index: number) => {
		const match = searchMatches[index];
		if (!match) {
			return;
		}
		setActiveMatchIndex(index);
		scrollToRow(match.rowId, "smooth", "center");
	}, [scrollToRow, searchMatches]);

	const jumpToNextMatch = useCallback(() => {
		if (searchMatches.length === 0) {
			return;
		}
		jumpToSearchMatch((activeMatchIndex + 1 + searchMatches.length) % searchMatches.length);
	}, [activeMatchIndex, jumpToSearchMatch, searchMatches.length]);

	const jumpToPreviousMatch = useCallback(() => {
		if (searchMatches.length === 0) {
			return;
		}
		const base = activeMatchIndex < 0 ? 0 : activeMatchIndex;
		jumpToSearchMatch((base - 1 + searchMatches.length) % searchMatches.length);
	}, [activeMatchIndex, jumpToSearchMatch, searchMatches.length]);

	const onSearchKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter") {
			event.preventDefault();
			if (event.shiftKey) {
				jumpToPreviousMatch();
			} else {
				jumpToNextMatch();
			}
		}
		if (event.key === "Escape") {
			event.preventDefault();
			setSearchOpen(false);
			setSearchQuery("");
		}
	}, [jumpToNextMatch, jumpToPreviousMatch]);

	useEffect(() => {
		if (!searchQuery.trim() || searchMatches.length === 0) {
			setActiveMatchIndex(-1);
			return;
		}
		setActiveMatchIndex((index) => {
			if (index >= 0 && index < searchMatches.length) {
				return index;
			}
			return 0;
		});
	}, [searchMatches.length, searchQuery]);

	useEffect(() => {
		if (!searchOpen) {
			return;
		}
		const frame = requestAnimationFrame(() => {
			searchInputRef.current?.focus();
			searchInputRef.current?.select();
		});
		return () => cancelAnimationFrame(frame);
	}, [searchOpen]);

	useEffect(() => {
		const onKeyDown = (event: globalThis.KeyboardEvent) => {
			if (event.defaultPrevented || event.isComposing) {
				return;
			}
			const key = event.key.toLowerCase();
			if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && key === "f") {
				event.preventDefault();
				setSearchOpen(true);
			}
		};
		document.addEventListener("keydown", onKeyDown, true);
		return () => document.removeEventListener("keydown", onKeyDown, true);
	}, []);

	useLayoutEffect(() => {
		const conversationId = props.conversationId;
		return () => {
			const viewport = viewportRef.current;
			if (viewport) {
				persistScrollSnapshotForConversation(conversationId, viewport);
			}
		};
	}, [persistScrollSnapshotForConversation, props.conversationId]);

	useLayoutEffect(() => {
		if (props.conversationId !== restoredConversationRef.current) {
			restoredConversationRef.current = undefined;
			rowCountRef.current = 0;
			followBottomRef.current = true;
			anchorRef.current = undefined;
			setActiveAnchorId(undefined);
		}
	}, [props.conversationId]);

	useLayoutEffect(() => {
		if (props.rows.length === 0) {
			rowCountRef.current = 0;
			followBottomRef.current = true;
			anchorRef.current = undefined;
			setActiveAnchorId(undefined);
			setShowJumpToLatest(false);
			return;
		}

		const previousRowCount = rowCountRef.current;
		const firstRows = previousRowCount === 0;
		const wasFollowingBottom = followBottomRef.current;
		const anchor = anchorRef.current;
		rowCountRef.current = props.rows.length;
		if (firstRows) {
			if (
				props.conversationId &&
				restoredConversationRef.current !== props.conversationId &&
				restoreSavedScrollSnapshot()
			) {
				restoredConversationRef.current = props.conversationId;
				return;
			}
			restoredConversationRef.current = props.conversationId;
			scrollToLatest("auto");
			return;
		}
		if (wasFollowingBottom) {
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
			setActiveAnchorId(anchorRef.current?.rowId);
			setShowJumpToLatest(!isTimelineNearBottom(viewport));
			persistScrollSnapshot(viewport);
		}
	}, [
		persistScrollSnapshot,
		props.conversationId,
		props.rows,
		restoreSavedScrollSnapshot,
		scrollToLatest,
	]);

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
				setActiveAnchorId(anchorRef.current?.rowId);
				setShowJumpToLatest(!isTimelineNearBottom(viewport));
				persistScrollSnapshot(viewport);
			});
		});
		observer.observe(content);

		return () => {
			observer.disconnect();
			if (resizeFrameRef.current !== null) {
				cancelAnimationFrame(resizeFrameRef.current);
			}
		};
	}, [persistScrollSnapshot, scrollToLatest]);

	useEffect(() => {
		return () => {
			if (highlightTimerRef.current !== null) {
				window.clearTimeout(highlightTimerRef.current);
			}
		};
	}, []);

	const virtualItems = virtualized ? virtualizer.getVirtualItems() : [];
	const totalSize = virtualized ? virtualizer.getTotalSize() : undefined;
	const matchLabel = searchQuery.trim()
		? searchMatches.length > 0
			? `${activeMatchIndex + 1}/${searchMatches.length}`
			: "0/0"
		: `${landmarks.length} marks`;

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
										highlighted={row.id === highlightedRowId}
									/>
								) : null;
							})}
						</div>
					) : (
						props.rows.map((row) => (
							<TimelineListItem
								key={row.id}
								row={row}
								highlighted={row.id === highlightedRowId}
							/>
						))
					)}
				</div>
			</div>

			<TimelineSearchPanel
				open={searchOpen}
				query={searchQuery}
				matchLabel={matchLabel}
				inputRef={searchInputRef}
				onOpen={() => setSearchOpen(true)}
				onClose={() => {
					setSearchOpen(false);
					setSearchQuery("");
				}}
				onQueryChange={setSearchQuery}
				onKeyDown={onSearchKeyDown}
				onPrevious={jumpToPreviousMatch}
				onNext={jumpToNextMatch}
				hasMatches={searchMatches.length > 0}
			/>

			<TimelineLandmarkRail
				landmarks={landmarks}
				activeAnchorId={activeAnchorId}
				onSelect={(landmark) => scrollToRow(landmark.rowId, "smooth", "start")}
			/>

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

function TimelineSearchPanel(props: {
	open: boolean;
	query: string;
	matchLabel: string;
	inputRef: React.RefObject<HTMLInputElement | null>;
	onOpen: () => void;
	onClose: () => void;
	onQueryChange: (query: string) => void;
	onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
	onPrevious: () => void;
	onNext: () => void;
	hasMatches: boolean;
}) {
	if (!props.open) {
		return (
			<button
				type="button"
				aria-label="Search timeline"
				onClick={props.onOpen}
				className="absolute right-8 top-4 z-20 inline-flex size-8 items-center justify-center rounded-full border border-border bg-background/85 text-[var(--desktop-muted)] shadow-sm backdrop-blur transition hover:text-[var(--desktop-strong)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
			>
				<IconSearch className="size-4" aria-hidden />
			</button>
		);
	}

	return (
		<div className="absolute right-8 top-4 z-30 flex w-[min(420px,calc(100%-4rem))] items-center gap-1.5 rounded-xl border border-border bg-background/95 p-1.5 shadow-xl backdrop-blur">
			<IconSearch className="ml-1 size-4 shrink-0 text-[var(--desktop-muted)]" aria-hidden />
			<input
				ref={props.inputRef}
				value={props.query}
				onChange={(event) => props.onQueryChange(event.currentTarget.value)}
				onKeyDown={props.onKeyDown}
				placeholder="Search this conversation"
				className="min-w-0 flex-1 bg-transparent px-1 text-[13px] text-[var(--desktop-strong)] outline-none placeholder:text-[var(--desktop-muted)]"
			/>
			<span className="min-w-12 text-right text-[11px] font-medium text-[var(--desktop-muted)]">
				{props.matchLabel}
			</span>
			<button
				type="button"
				aria-label="Previous match"
				disabled={!props.hasMatches}
				onClick={props.onPrevious}
				className="inline-flex size-7 items-center justify-center rounded-md text-[var(--desktop-muted)] transition hover:bg-muted hover:text-[var(--desktop-strong)] disabled:cursor-not-allowed disabled:opacity-40"
			>
				<IconChevronUp className="size-4" aria-hidden />
			</button>
			<button
				type="button"
				aria-label="Next match"
				disabled={!props.hasMatches}
				onClick={props.onNext}
				className="inline-flex size-7 items-center justify-center rounded-md text-[var(--desktop-muted)] transition hover:bg-muted hover:text-[var(--desktop-strong)] disabled:cursor-not-allowed disabled:opacity-40"
			>
				<IconChevronDown className="size-4" aria-hidden />
			</button>
			<button
				type="button"
				aria-label="Close search"
				onClick={props.onClose}
				className="inline-flex size-7 items-center justify-center rounded-md text-[var(--desktop-muted)] transition hover:bg-muted hover:text-[var(--desktop-strong)]"
			>
				<IconX className="size-4" aria-hidden />
			</button>
		</div>
	);
}

function TimelineLandmarkRail(props: {
	landmarks: TimelineLandmark[];
	activeAnchorId?: string;
	onSelect: (landmark: TimelineLandmark) => void;
}) {
	const [open, setOpen] = useState(false);
	if (props.landmarks.length === 0) {
		return null;
	}
	return (
		<div
			className="absolute right-3 top-16 z-20 flex max-h-[calc(100%-8rem)] flex-col items-end"
			onPointerEnter={() => setOpen(true)}
			onPointerLeave={() => setOpen(false)}
			onFocusCapture={() => setOpen(true)}
			onBlurCapture={(event) => {
				const next = event.relatedTarget;
				if (next instanceof Node && event.currentTarget.contains(next)) return;
				setOpen(false);
			}}
		>
			{open ? (
				<div
					role="listbox"
					aria-label="Timeline landmarks"
					className="flex max-h-[min(60vh,34rem)] w-[min(22rem,42vw)] flex-col gap-1 overflow-y-auto rounded-xl border border-border bg-background/95 p-1.5 shadow-xl backdrop-blur"
				>
					{props.landmarks.map((landmark, index) => (
						<button
							key={landmark.rowId}
							type="button"
							role="option"
							aria-selected={landmark.rowId === props.activeAnchorId}
							onClick={() => props.onSelect(landmark)}
							className={cn(
								"block w-full rounded-lg border-0 bg-transparent px-2.5 py-2 text-left transition hover:bg-muted",
								landmark.rowId === props.activeAnchorId ? "bg-muted" : "",
							)}
						>
							<div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-medium text-[var(--desktop-muted)]">
								<span>{landmark.label}</span>
								<span>#{index + 1}</span>
							</div>
							<div className="line-clamp-2 text-[12px] leading-5 text-[var(--desktop-strong)]">
								{landmark.preview || landmark.label}
							</div>
						</button>
					))}
				</div>
			) : (
				<div className="flex max-h-[calc(100vh-12rem)] flex-col items-end gap-[2px] overflow-hidden rounded-full bg-background/80 px-px py-1 shadow-sm backdrop-blur">
					{props.landmarks.map((landmark) => (
						<button
							key={landmark.rowId}
							type="button"
							aria-label={`Jump to ${landmark.label}`}
							onClick={() => props.onSelect(landmark)}
							className={cn(
								"h-[2px] shrink-0 cursor-pointer rounded-full border-0 p-0 transition-colors",
								landmark.importance === "primary" ? "w-2" : "w-1.5",
								landmark.rowId === props.activeAnchorId
									? "bg-[var(--desktop-strong)]"
									: "bg-[var(--desktop-muted)]/35 hover:bg-[var(--desktop-muted)]/70",
							)}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function TimelineListItem(props: {
	row: TimelineRowData;
	virtualItem?: VirtualItem;
	measureElement?: (node: HTMLDivElement | null) => void;
	highlighted?: boolean;
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
			className={cn(
				"min-w-0 rounded-2xl transition-[background,box-shadow] duration-300",
				props.virtualItem ? "pb-3" : "",
				props.highlighted ? "bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.18)]" : "",
			)}
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
	viewport: HTMLElement | null,
	anchor?: TimelineScrollAnchor,
) {
	if (!viewport || !anchor) {
		return false;
	}
	const nextItem = findTimelineListItem(viewport, anchor.rowId);
	if (!nextItem) {
		return false;
	}
	const viewportTop = viewport.getBoundingClientRect().top;
	const nextOffset = nextItem.getBoundingClientRect().top - viewportTop;
	viewport.scrollTop += nextOffset - anchor.topOffset;
	return true;
}

function findTimelineListItem(viewport: HTMLElement | null, rowId: string) {
	if (!viewport) {
		return undefined;
	}
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
