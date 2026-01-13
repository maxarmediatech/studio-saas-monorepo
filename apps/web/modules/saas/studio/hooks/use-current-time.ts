"use client";

import { useEffect, useState } from "react";

interface UseCurrentTimeOptions {
	intervalMs?: number;
}

export function useCurrentTime(options: UseCurrentTimeOptions = {}) {
	const { intervalMs = 60000 } = options;
	const [currentTime, setCurrentTime] = useState(() => new Date());

	useEffect(() => {
		const timer = setInterval(() => {
			setCurrentTime(new Date());
		}, intervalMs);

		return () => clearInterval(timer);
	}, [intervalMs]);

	return { currentTime };
}
