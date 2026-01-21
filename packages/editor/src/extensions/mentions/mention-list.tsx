"use client";

import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import type { MentionSuggestion } from "../../types/mention";

export interface MentionListRef {
	onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export interface MentionListProps {
	items: MentionSuggestion[];
	command: (item: { id: string; label: string }) => void;
	isLoading?: boolean;
}

export const MentionList = forwardRef<MentionListRef, MentionListProps>(
	function MentionList({ items, command, isLoading }, ref) {
		const [selectedIndex, setSelectedIndex] = useState(0);
		const containerRef = useRef<HTMLDivElement>(null);

		const selectItem = useCallback(
			(index: number) => {
				const item = items[index];
				if (item) {
					command({ id: item.id, label: item.label });
				}
			},
			[items, command],
		);

		useEffect(() => {
			setSelectedIndex(0);
		}, [items]);

		useEffect(() => {
			const selectedElement = containerRef.current?.querySelector(
				`[data-index="${selectedIndex}"]`,
			);
			selectedElement?.scrollIntoView({ block: "nearest" });
		}, [selectedIndex]);

		useImperativeHandle(ref, () => ({
			onKeyDown: ({ event }: { event: KeyboardEvent }) => {
				if (event.key === "ArrowUp") {
					setSelectedIndex((prev) =>
						prev === 0 ? items.length - 1 : prev - 1,
					);
					return true;
				}

				if (event.key === "ArrowDown") {
					setSelectedIndex((prev) =>
						prev === items.length - 1 ? 0 : prev + 1,
					);
					return true;
				}

				if (event.key === "Enter") {
					selectItem(selectedIndex);
					return true;
				}

				if (event.key === "Escape") {
					return true;
				}

				return false;
			},
		}));

		if (isLoading) {
			return (
				<div className="mention-list bg-popover border border-border rounded-md shadow-md p-2 min-w-[200px]">
					<div className="text-sm text-muted-foreground px-2 py-1">
						Loading...
					</div>
				</div>
			);
		}

		if (items.length === 0) {
			return (
				<div className="mention-list bg-popover border border-border rounded-md shadow-md p-2 min-w-[200px]">
					<div className="text-sm text-muted-foreground px-2 py-1">
						No members found
					</div>
				</div>
			);
		}

		return (
			<div
				ref={containerRef}
				className="mention-list bg-popover border border-border rounded-md shadow-md py-1 min-w-[200px] max-h-[300px] overflow-y-auto"
				role="listbox"
				aria-label="Mention suggestions"
			>
				{items.map((item, index) => (
					<button
						key={item.id}
						type="button"
						data-index={index}
						className={`mention-item w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent cursor-pointer ${
							index === selectedIndex ? "bg-accent" : ""
						}`}
						onClick={() => selectItem(index)}
						onMouseEnter={() => setSelectedIndex(index)}
						role="option"
						aria-selected={index === selectedIndex}
					>
						{item.avatar && (
							<img
								src={item.avatar}
								alt=""
								className="w-6 h-6 rounded-full object-cover"
							/>
						)}
						{!item.avatar && (
							<div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
								{item.label.charAt(0).toUpperCase()}
							</div>
						)}
						<span className="truncate">{item.label}</span>
					</button>
				))}
			</div>
		);
	},
);
