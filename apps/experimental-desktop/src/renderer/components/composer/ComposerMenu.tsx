import { IconChevronDown, IconCommand } from "@tabler/icons-react";
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
	return (
		<div className="absolute inset-x-3 bottom-full mb-2 max-h-[284px] overflow-auto rounded-[14px] border border-[var(--desktop-inbox-border)] bg-[color-mix(in_srgb,var(--desktop-inbox)_94%,transparent)] p-1.5 shadow-[0_18px_52px_-34px_var(--desktop-shadow)] backdrop-blur-xl">
			{props.items.map((item, index) => {
				const active = index === props.activeIndex;
				return (
					<button
						className={cn(
							menuItemClass,
							active && "bg-[var(--desktop-inbox-hover)]",
						)}
						type="button"
						key={item.id}
						onMouseEnter={() => props.onHover(index)}
						onMouseDown={(event) => {
							event.preventDefault();
							props.onSelect(item);
						}}
					>
						<IconCommand {...iconProps} size={16} />
						<span className="min-w-0">
							<span className="block truncate text-[13px] font-semibold">
								/{item.trigger} · {item.label}
							</span>
							<span className="block truncate text-[12px] text-[var(--desktop-subtle)]">
								{item.description}
							</span>
						</span>
						<IconChevronDown
							className={active ? "opacity-100" : "opacity-0"}
							{...iconProps}
							size={15}
						/>
					</button>
				);
			})}
		</div>
	);
}
