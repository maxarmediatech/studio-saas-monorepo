"use client";

import { cn } from "@repo/ui/lib/utils";
import { type ReactNode, useEffect, useRef, useState } from "react";

interface StickiesMasonryProps {
	children: ReactNode;
	className?: string;
}

function getColumnCount(width: number): number {
	if (width < 640) return 2;
	if (width < 850) return 3;
	if (width < 1024) return 4;
	if (width < 1280) return 5;
	return 6;
}

export function StickiesMasonry({ children, className }: StickiesMasonryProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [columnCount, setColumnCount] = useState(4);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const updateColumns = () => {
			setColumnCount(getColumnCount(container.offsetWidth));
		};

		updateColumns();

		const resizeObserver = new ResizeObserver(() => {
			updateColumns();
		});

		resizeObserver.observe(container);
		return () => resizeObserver.disconnect();
	}, []);

	return (
		<div ref={containerRef} className={cn("w-full", className)}>
			<div
				className="gap-2"
				style={{
					columnCount,
					columnGap: "0.5rem",
				}}
			>
				{children}
			</div>
		</div>
	);
}

interface StickiesMasonryItemProps {
	children: ReactNode;
	className?: string;
}

export function StickiesMasonryItem({
	children,
	className,
}: StickiesMasonryItemProps) {
	return (
		<div className={cn("break-inside-avoid mb-2", className)}>
			{children}
		</div>
	);
}
