"use client";

import type { Editor } from "@tiptap/core";
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import type { SlashCommand } from "./commands";

export interface CommandListRef {
	onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export interface CommandListProps {
	items: SlashCommand[];
	editor: Editor;
	onClose: () => void;
}

export const CommandList = forwardRef<CommandListRef, CommandListProps>(
	function CommandList({ items, editor, onClose }, ref) {
		const [selectedIndex, setSelectedIndex] = useState(0);
		const containerRef = useRef<HTMLDivElement>(null);

		const selectItem = useCallback(
			(index: number) => {
				const item = items[index];
				if (item) {
					item.action(editor);
					onClose();
				}
			},
			[items, editor, onClose],
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
					onClose();
					return true;
				}

				return false;
			},
		}));

		if (items.length === 0) {
			return (
				<div className="command-list bg-popover border border-border rounded-md shadow-md p-2 min-w-[200px]">
					<div className="text-sm text-muted-foreground px-2 py-1">
						No commands found
					</div>
				</div>
			);
		}

		return (
			<div
				ref={containerRef}
				className="command-list bg-popover border border-border rounded-md shadow-md py-1 min-w-[240px] max-h-[300px] overflow-y-auto"
				role="listbox"
				aria-label="Slash commands"
			>
				{items.map((item, index) => {
					const Icon = item.icon;
					return (
						<button
							key={item.key}
							type="button"
							data-index={index}
							className={`command-item w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent cursor-pointer ${
								index === selectedIndex ? "bg-accent" : ""
							}`}
							onClick={() => selectItem(index)}
							onMouseEnter={() => setSelectedIndex(index)}
							role="option"
							aria-selected={index === selectedIndex}
						>
							<div className="flex-shrink-0 w-8 h-8 rounded bg-muted flex items-center justify-center">
								<Icon className="w-4 h-4 text-muted-foreground" />
							</div>
							<div className="flex flex-col min-w-0">
								<span className="text-sm font-medium truncate">
									{item.title}
								</span>
								<span className="text-xs text-muted-foreground truncate">
									{item.description}
								</span>
							</div>
						</button>
					);
				})}
			</div>
		);
	},
);
