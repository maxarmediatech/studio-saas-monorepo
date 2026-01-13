"use client";

import { cn } from "@repo/ui/lib/utils";
import { STICKY_COLORS, type StickyColor } from "./constants";

interface StickyColorPickerProps {
	value: StickyColor;
	onChange: (color: StickyColor) => void;
}

export function StickyColorPicker({ value, onChange }: StickyColorPickerProps) {
	return (
		<div className="flex items-center gap-3">
			<span className="text-sm font-medium text-muted-foreground">
				Color:
			</span>
			<div className="flex flex-wrap gap-2">
				{(Object.keys(STICKY_COLORS) as StickyColor[]).map((color) => {
					const isSelected = value === color;
					const { bg, border } = STICKY_COLORS[color];

					return (
						<button
							key={color}
							type="button"
							onClick={() => onChange(color)}
							className={cn(
								"size-6 rounded-full border transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
								bg,
								isSelected
									? "border-primary scale-110 shadow-sm"
									: border,
							)}
							aria-label={`Select ${STICKY_COLORS[color].name}`}
							title={STICKY_COLORS[color].name}
						/>
					);
				})}
			</div>
		</div>
	);
}
