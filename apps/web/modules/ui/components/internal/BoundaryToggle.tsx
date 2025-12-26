"use client";

import { config } from "@repo/config";
import { Droplet, Layers, Square } from "lucide-react";
import type { BoundaryMode } from "./BoundaryProvider";
import { useBoundaryMode } from "./BoundaryProvider";

const modes: { icon: React.ReactNode; label: string; mode: BoundaryMode }[] = [
	{ icon: <Square className="size-4" />, label: "Off", mode: "off" },
	{
		icon: <Droplet className="size-4" />,
		label: "Hydration",
		mode: "hydration",
	},
	{
		icon: <Layers className="size-4" />,
		label: "Rendering",
		mode: "rendering",
	},
];

export default function BoundaryToggle() {
	const { mode, setMode } = useBoundaryMode();

	// Only show in development mode AND when feature flag is enabled
	if (
		process.env.NODE_ENV !== "development" ||
		!config.ui.devTools.enableBoundaryVisualization
	) {
		return null;
	}

	return (
		<div className="fixed right-8 bottom-4 z-50">
			<div className="flex gap-1 rounded-md border border-border bg-card p-1 shadow-lg dark:bg-card">
				{modes.map(({ icon, label, mode: modeOption }) => {
					const isActive = mode === modeOption;

					return (
						<button
							key={modeOption}
							className={`flex items-center gap-2 rounded px-3 py-2 text-sm font-medium uppercase tracking-wide transition-all duration-200 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus-visible:outline-none ${
								isActive
									? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
									: "bg-transparent text-foreground hover:bg-secondary/80 dark:hover:bg-secondary/20"
							}`}
							onClick={() => {
								setMode(modeOption);
							}}
							title={`Switch to ${label} boundaries`}
							type="button"
						>
							{icon}
							<span className="hidden sm:inline">{label}</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}
