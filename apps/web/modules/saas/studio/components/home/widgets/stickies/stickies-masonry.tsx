"use client";

import { cn } from "@repo/ui/lib/utils";
import {
	Children,
	createContext,
	type ReactNode,
	isValidElement,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import Masonry from "react-masonry-component";

interface StickiesMasonryProps {
	children: ReactNode;
	className?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MasonryComponent = Masonry as any;

type RequestLayout = () => void;

const StickiesMasonryLayoutContext = createContext<RequestLayout | null>(null);

export function useStickiesMasonryLayout() {
	return useContext(StickiesMasonryLayoutContext);
}

function getColumnCount(width: number): number {
	if (width < 640) {
		return 2;
	}
	if (width < 850) {
		return 3;
	}
	if (width < 1024) {
		return 4;
	}
	if (width < 1280) {
		return 5;
	}
	return 6;
}

// Calculate item width based on column count and gap
function getItemWidth(containerWidth: number, columnCount: number): string {
	const gap = 8; // 0.5rem = 8px
	const totalGap = gap * (columnCount - 1);
	const itemWidth = (containerWidth - totalGap) / columnCount;
	return `${itemWidth}px`;
}

export function StickiesMasonry({ children, className }: StickiesMasonryProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const masonryRef = useRef<any>(null);
	const [columnCount, setColumnCount] = useState(4);
	const [containerWidth, setContainerWidth] = useState(0);
	const layoutRafRef = useRef<number | null>(null);

	const performLayout = useCallback(() => {
		if (masonryRef.current?.masonry?.layout) {
			masonryRef.current.masonry.layout();
		}
	}, []);

	const requestLayout = useCallback(() => {
		if (layoutRafRef.current != null) {
			return;
		}
		layoutRafRef.current = requestAnimationFrame(() => {
			layoutRafRef.current = null;
			performLayout();
		});
	}, [performLayout]);

	useEffect(() => {
		return () => {
			if (layoutRafRef.current != null) {
				cancelAnimationFrame(layoutRafRef.current);
			}
		};
	}, []);

	// Responsive columns via ResizeObserver
	useEffect(() => {
		const container = containerRef.current;
		if (!container) {
			return;
		}

		const updateColumns = () => {
			const width = container.offsetWidth;
			setContainerWidth(width);
			setColumnCount(getColumnCount(width));
		};

		updateColumns();
		requestLayout();

		const resizeObserver = new ResizeObserver(() => {
			updateColumns();
			requestLayout();
		});

		resizeObserver.observe(container);
		return () => resizeObserver.disconnect();
	}, [requestLayout]);

	const itemWidth = getItemWidth(containerWidth || 800, columnCount);

	const masonryOptions = {
		transitionDuration: 0,
		gutter: 8,
		fitWidth: false,
		percentPosition: false,
	};

	const normalizedChildren = Children.toArray(children).filter(
		(child) => child != null && typeof child !== "boolean",
	);

	useEffect(() => {
		requestLayout();
	}, [normalizedChildren.length, requestLayout]);

	return (
		<div ref={containerRef} className={cn("w-full", className)}>
			<StickiesMasonryLayoutContext.Provider value={requestLayout}>
				<MasonryComponent
					ref={masonryRef}
					options={masonryOptions}
					enableResizableChildren
					className="relative w-full"
				>
					{normalizedChildren.map((child, index) => {
						const key =
							isValidElement(child) && child.key != null
								? child.key
								: index;
						return (
							<div
								key={key}
								style={{ width: itemWidth }}
								className="mb-2"
							>
								{child}
							</div>
						);
					})}
				</MasonryComponent>
			</StickiesMasonryLayoutContext.Provider>
		</div>
	);
}

interface StickiesMasonryItemProps {
	children: ReactNode;
	className?: string;
}

// Keep this for backwards compatibility, but items are now wrapped in StickiesMasonry
export function StickiesMasonryItem({
	children,
	className,
}: StickiesMasonryItemProps) {
	return <div className={cn(className)}>{children}</div>;
}
