import { IconChevronDown, IconCommand } from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import { iconProps } from "../../app/icons";
import { cn } from "../../lib/utils";
import type { ComposerCommand } from "./composerTriggers";

const menuItemClass =
	"grid w-full grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2 rounded-[9px] border-0 bg-transparent px-2.5 py-2 text-left text-[var(--desktop-default)] transition-colors hover:bg-[var(--desktop-inbox-hover)]";

export function ComposerMenu(props: {
	items: ComposerCommand[];
	activeIndex: number;
	onHover: (index: number) => void;
	onSelect: (item: ComposerCommand) => void;
}) {
	const activeItemRef = useRef<HTMLButtonElement | null>(null);
	useEffect(() => {
		activeItemRef.current?.scrollIntoView({
			block: "nearest",
		});
	}, [props.activeIndex]);

	let previousSection: string | undefined;

	return (
		<div className="absolute inset-x-3 bottom-full mb-2 max-h-[284px] overflow-auto rounded-[14px] border border-[var(--desktop-inbox-border)] bg-[color-mix(in_srgb,var(--desktop-inbox)_94%,transparent)] p-1.5 shadow-[0_18px_52px_-34px_var(--desktop-shadow)] backdrop-blur-xl">
			{props.items.map((item, index) => {
				const active = index === props.activeIndex;
				const section = item.section;
				const showSection = section && section !== previousSection;
				previousSection = section;
				return (
					<div key={item.id}>
						{showSection ? (
							<p className="mb-1 mt-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[color-mix(in_srgb,var(--desktop-subtle)_64%,transparent)] first:mt-0">
								{section}
							</p>
						) : null}
						<button
							ref={active ? activeItemRef : undefined}
							className={cn(
								menuItemClass,
								active &&
									!item.disabled &&
									"bg-[var(--desktop-inbox-hover)]",
								item.disabled &&
									"cursor-default text-[var(--desktop-subtle)] opacity-70 hover:bg-transparent",
							)}
							type="button"
							disabled={item.disabled}
							onMouseEnter={() => {
								if (!item.disabled) {
									props.onHover(index);
								}
							}}
							onMouseDown={(event) => {
								event.preventDefault();
								if (!item.disabled) {
									props.onSelect(item);
								}
							}}
						>
							<IconCommand {...iconProps} size={16} />
							<span className="min-w-0">
								<span className="block truncate text-[13px] font-semibold">
									{item.shortcut ?? item.trigger} ·{" "}
									{item.label}
								</span>
								<span className="block truncate text-[12px] text-[var(--desktop-subtle)]">
									{item.description}
								</span>
							</span>
							<IconChevronDown
								className={
									active && !item.disabled
										? "opacity-100"
										: "opacity-0"
								}
								{...iconProps}
								size={15}
							/>
						</button>
					</div>
				);
			})}
		</div>
	);
}
