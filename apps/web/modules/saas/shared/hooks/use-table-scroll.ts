"use client";

import * as React from "react";

export interface UseTableScrollOptions {
	/** Amount to scroll in pixels (when not using column widths) */
	scrollAmount?: number;
	/** Snap to column boundaries instead of fixed scroll amount */
	useColumnWidths?: boolean;
	/** Column index to start scrolling from (columns before this are sticky) */
	startFromColumn?: number;
}

/**
 * Hook for managing horizontal table scrolling with optional column-snapping.
 * Provides scroll state and functions for programmatic scrolling.
 */
export function useTableScroll(options: UseTableScrollOptions = {}) {
	const {
		scrollAmount = 120,
		useColumnWidths = false,
		startFromColumn = 0,
	} = options;

	const containerRef = React.useRef<HTMLDivElement | null>(null);
	const [canScrollLeft, setCanScrollLeft] = React.useState(false);
	const [canScrollRight, setCanScrollRight] = React.useState(false);
	const [isScrollable, setIsScrollable] = React.useState(false);
	const currentColumnIndex = React.useRef(startFromColumn);
	const isScrollingProgrammatically = React.useRef(false);
	const scrollTimeoutRef = React.useRef<number | undefined>(undefined);

	const getColumnPositions = React.useCallback(() => {
		const container = containerRef.current;
		if (!container) {
			return [];
		}

		const table = container.querySelector("table");
		if (!table) {
			return [];
		}

		const headerRow = table.querySelector("thead tr");
		if (!headerRow) {
			return [];
		}

		const columns = Array.from(headerRow.querySelectorAll("th"));
		const positions: number[] = [];
		let currentPosition = 0;

		for (const column of columns) {
			positions.push(currentPosition);
			currentPosition += (column as HTMLElement).offsetWidth;
		}

		return positions;
	}, []);

	const syncColumnIndex = React.useCallback(() => {
		const container = containerRef.current;
		if (
			!container ||
			!useColumnWidths ||
			isScrollingProgrammatically.current
		) {
			return;
		}

		const allColumnPositions = getColumnPositions();
		if (allColumnPositions.length === 0) {
			return;
		}

		const currentScrollLeft = container.scrollLeft;
		const maxScrollLeft = container.scrollWidth - container.clientWidth;

		if (currentScrollLeft <= 10) {
			currentColumnIndex.current = startFromColumn;
			return;
		}
		if (currentScrollLeft >= maxScrollLeft - 10) {
			currentColumnIndex.current = allColumnPositions.length - 1;
			return;
		}

		let accumulatedDistance = 0;
		let detectedColumn = startFromColumn;

		for (let i = startFromColumn; i < allColumnPositions.length - 1; i++) {
			const columnStart = allColumnPositions[i] ?? 0;
			const columnEnd = allColumnPositions[i + 1] ?? 0;
			const columnWidth = columnEnd - columnStart;
			const nextDistance = accumulatedDistance + columnWidth;

			if (
				Math.abs(currentScrollLeft - accumulatedDistance) <=
				Math.abs(currentScrollLeft - nextDistance)
			) {
				detectedColumn = i;
				break;
			}

			accumulatedDistance = nextDistance;
			detectedColumn = i + 1;
		}

		currentColumnIndex.current = Math.max(
			startFromColumn,
			Math.min(detectedColumn, allColumnPositions.length - 1),
		);
	}, [useColumnWidths, startFromColumn, getColumnPositions]);

	const checkScrollability = React.useCallback(() => {
		const container = containerRef.current;
		if (!container) {
			return;
		}

		const { scrollWidth, clientWidth } = container;
		const isScrollableTable = scrollWidth > clientWidth;

		if (useColumnWidths) {
			syncColumnIndex();

			const allColumnPositions = getColumnPositions();
			const maxColumnIndex = allColumnPositions.length - 1;

			const newCanScrollLeft =
				currentColumnIndex.current > startFromColumn ||
				container.scrollLeft > 10;
			const newCanScrollRight =
				currentColumnIndex.current < maxColumnIndex;

			setIsScrollable(isScrollableTable);
			setCanScrollLeft(newCanScrollLeft);
			setCanScrollRight(newCanScrollRight);
		} else {
			const { scrollLeft } = container;
			setIsScrollable(isScrollableTable);
			setCanScrollLeft(scrollLeft > 0);
			setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
		}
	}, [useColumnWidths, startFromColumn, getColumnPositions, syncColumnIndex]);

	const scrollLeft = React.useCallback(
		(smooth = true) => {
			const container = containerRef.current;
			if (!container) {
				return;
			}

			if (useColumnWidths) {
				const allColumnPositions = getColumnPositions();
				if (allColumnPositions.length === 0) {
					return;
				}

				if (
					currentColumnIndex.current <= startFromColumn &&
					container.scrollLeft <= 0
				) {
					return;
				}

				if (
					currentColumnIndex.current <= startFromColumn &&
					container.scrollLeft > 0
				) {
					isScrollingProgrammatically.current = true;
					container.scrollTo({
						left: 0,
						behavior: "smooth",
					});

					window.setTimeout(() => {
						isScrollingProgrammatically.current = false;
						syncColumnIndex();
						checkScrollability();
					}, 500);
					return;
				}

				const originalColumnIndex = currentColumnIndex.current;
				currentColumnIndex.current = currentColumnIndex.current - 1;

				const currentScrollLeft = container.scrollLeft;
				const maxScrollLeft =
					container.scrollWidth - container.clientWidth;

				let targetScrollLeft: number;

				if (Math.abs(currentScrollLeft - maxScrollLeft) < 10) {
					const lastColumnStart =
						allColumnPositions[originalColumnIndex] ?? 0;
					const lastColumnEnd =
						allColumnPositions[originalColumnIndex + 1] ??
						lastColumnStart + 150;
					const lastColumnWidth = lastColumnEnd - lastColumnStart;

					targetScrollLeft = Math.max(
						0,
						currentScrollLeft - lastColumnWidth,
					);
				} else {
					targetScrollLeft = 0;
					for (
						let i = startFromColumn;
						i < currentColumnIndex.current;
						i++
					) {
						const columnStart = allColumnPositions[i] ?? 0;
						const columnEnd = allColumnPositions[i + 1] ?? 0;
						const columnWidth = columnEnd - columnStart;
						targetScrollLeft += columnWidth;
					}
				}

				isScrollingProgrammatically.current = true;

				container.scrollTo({
					left: targetScrollLeft,
					behavior: "smooth",
				});

				window.setTimeout(() => {
					isScrollingProgrammatically.current = false;
					syncColumnIndex();
					checkScrollability();
				}, 500);
			} else {
				container.scrollBy({
					left: -scrollAmount,
					behavior: smooth ? "smooth" : "auto",
				});
			}
		},
		[
			checkScrollability,
			getColumnPositions,
			scrollAmount,
			startFromColumn,
			syncColumnIndex,
			useColumnWidths,
		],
	);

	const scrollRight = React.useCallback(
		(smooth = true) => {
			const container = containerRef.current;
			if (!container) {
				return;
			}

			if (useColumnWidths) {
				const allColumnPositions = getColumnPositions();
				if (allColumnPositions.length === 0) {
					return;
				}
				const maxColumnIndex = allColumnPositions.length - 1;

				if (currentColumnIndex.current >= maxColumnIndex) {
					return;
				}

				currentColumnIndex.current = currentColumnIndex.current + 1;

				isScrollingProgrammatically.current = true;

				if (currentColumnIndex.current === maxColumnIndex) {
					container.scrollTo({
						left: container.scrollWidth - container.clientWidth,
						behavior: "smooth",
					});
				} else {
					let targetScrollLeft = 0;
					for (
						let i = startFromColumn;
						i < currentColumnIndex.current;
						i++
					) {
						const columnStart = allColumnPositions[i] ?? 0;
						const columnEnd = allColumnPositions[i + 1] ?? 0;
						targetScrollLeft += columnEnd - columnStart;
					}

					container.scrollTo({
						left: targetScrollLeft,
						behavior: "smooth",
					});
				}

				window.setTimeout(() => {
					isScrollingProgrammatically.current = false;
					syncColumnIndex();
					checkScrollability();
				}, 500);
			} else {
				container.scrollBy({
					left: scrollAmount,
					behavior: smooth ? "smooth" : "auto",
				});
			}
		},
		[
			checkScrollability,
			getColumnPositions,
			scrollAmount,
			startFromColumn,
			syncColumnIndex,
			useColumnWidths,
		],
	);

	React.useEffect(() => {
		const container = containerRef.current;
		if (!container) {
			return;
		}

		currentColumnIndex.current = startFromColumn;
		checkScrollability();

		const handleScroll = () => {
			if (isScrollingProgrammatically.current) {
				return;
			}

			if (scrollTimeoutRef.current !== undefined) {
				window.clearTimeout(scrollTimeoutRef.current);
			}

			scrollTimeoutRef.current = window.setTimeout(() => {
				checkScrollability();
			}, 100);
		};

		const handleResize = () => {
			currentColumnIndex.current = startFromColumn;
			checkScrollability();
		};

		container.addEventListener("scroll", handleScroll);
		window.addEventListener("resize", handleResize);

		let resizeObserver: ResizeObserver | undefined;
		if (typeof ResizeObserver !== "undefined") {
			resizeObserver = new ResizeObserver(() => {
				currentColumnIndex.current = startFromColumn;
				checkScrollability();
			});

			resizeObserver.observe(container);
		}

		return () => {
			container.removeEventListener("scroll", handleScroll);
			window.removeEventListener("resize", handleResize);
			if (resizeObserver) {
				resizeObserver.disconnect();
			}
			if (scrollTimeoutRef.current !== undefined) {
				window.clearTimeout(scrollTimeoutRef.current);
			}
		};
	}, [checkScrollability, startFromColumn]);

	return {
		containerRef,
		canScrollLeft,
		canScrollRight,
		isScrollable,
		scrollLeft,
		scrollRight,
	};
}
