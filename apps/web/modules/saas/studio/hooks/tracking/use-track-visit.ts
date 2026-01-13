"use client";

import { recentVisitsMutations } from "@saas/studio/lib/api";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

type EntityType = "booking" | "shoot" | "task" | "deliverable";

interface UseTrackVisitOptions {
	entityType: EntityType;
	entityId: string | undefined;
	enabled?: boolean;
}

export function useTrackVisit({
	entityType,
	entityId,
	enabled = true,
}: UseTrackVisitOptions) {
	const trackedRef = useRef<string | null>(null);

	const mutation = useMutation(recentVisitsMutations.track());

	useEffect(() => {
		if (!enabled || !entityId) return;

		const trackingKey = `${entityType}:${entityId}`;
		if (trackedRef.current === trackingKey) return;

		trackedRef.current = trackingKey;
		mutation.mutate({ entityType, entityId });
	}, [entityType, entityId, enabled, mutation]);
}
