function asMetadataRecord(metadata: unknown): Record<string, unknown> | null {
	if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
		return null;
	}
	return metadata as Record<string, unknown>;
}

export function taskMetadataForDeliverableAccess(
	metadata: unknown,
	canReadDeliverables: boolean,
): Record<string, unknown> | null {
	const record = asMetadataRecord(metadata);
	if (!record || canReadDeliverables) {
		return record;
	}
	const visible = { ...record };
	delete visible.convertedFromDeliverableId;
	delete visible.convertedFromDeliverableName;
	return visible;
}

export function deliverableMetadataForTaskAccess(
	metadata: unknown,
	canReadTasks: boolean,
): Record<string, unknown> | null {
	const record = asMetadataRecord(metadata);
	if (!record || canReadTasks) {
		return record;
	}
	const visible = { ...record };
	delete visible.convertedToTaskId;
	return visible;
}

function preserveSystemKeys(
	incomingMetadata: unknown,
	existingMetadata: unknown,
	keys: string[],
): Record<string, unknown> | null {
	const incoming = asMetadataRecord(incomingMetadata);
	const existing = asMetadataRecord(existingMetadata);
	const merged = { ...(incoming ?? {}) };
	for (const key of keys) {
		delete merged[key];
		if (existing && key in existing) {
			merged[key] = existing[key];
		}
	}
	if (incomingMetadata === null && Object.keys(merged).length === 0) {
		return null;
	}
	return merged;
}

export function taskMetadataForCreate(
	metadata: unknown,
): Record<string, unknown> | null {
	return preserveSystemKeys(metadata, null, [
		"convertedFromDeliverableId",
		"convertedFromDeliverableName",
	]);
}

export function taskMetadataForUpdate(
	incomingMetadata: unknown,
	existingMetadata: unknown,
): Record<string, unknown> | null {
	return preserveSystemKeys(incomingMetadata, existingMetadata, [
		"convertedFromDeliverableId",
		"convertedFromDeliverableName",
	]);
}

export function deliverableMetadataForCreate(
	metadata: unknown,
): Record<string, unknown> | null {
	return preserveSystemKeys(metadata, null, [
		"convertedToTaskId",
		"convertedAt",
	]);
}

export function deliverableMetadataForUpdate(
	incomingMetadata: unknown,
	existingMetadata: unknown,
): Record<string, unknown> | null {
	return preserveSystemKeys(incomingMetadata, existingMetadata, [
		"convertedToTaskId",
		"convertedAt",
	]);
}
