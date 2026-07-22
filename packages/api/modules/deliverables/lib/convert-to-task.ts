function asMetadataRecord(metadata: unknown): Record<string, unknown> | null {
	if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
		return null;
	}

	return metadata as Record<string, unknown>;
}

export function getConvertedTaskIdFromMetadata(
	metadata: unknown,
): string | null {
	const record = asMetadataRecord(metadata);
	const value = record?.convertedToTaskId;

	if (typeof value !== "string") {
		return null;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export function canConvertDeliverableToTask(
	metadata: unknown,
	trackingMode: "direct" | "task_based",
): boolean {
	return (
		trackingMode === "direct" &&
		getConvertedTaskIdFromMetadata(metadata) === null
	);
}

export function buildConvertedDeliverableMetadata(
	metadata: unknown,
	taskId: string,
	convertedAtIso: string,
): Record<string, unknown> {
	const base = asMetadataRecord(metadata) ?? {};

	return {
		...base,
		convertedToTaskId: taskId,
		convertedAt: convertedAtIso,
	};
}
