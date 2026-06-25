import { useCallback, useReducer } from "react";
import type { AdmittedComposerRequest } from "./composerProviderTypes";

export const MAX_QUEUED_COMPOSER_REQUESTS = 20;
export const MAX_QUEUED_COMPOSER_INPUT_LENGTH = 20_000;
export const MAX_QUEUED_COMPOSER_STATE_BYTES = 256 * 1024;

export type ComposerQueuedRequestStatus = "queued" | "running" | "failed";

export type ComposerQueuedRequest = {
	id: string;
	queueItemId: string;
	admittedRequestId: string;
	request: AdmittedComposerRequest;
	status: ComposerQueuedRequestStatus;
	position: number;
	createdAt: string;
	error?: string;
};

export type ComposerQueueState = {
	items: ComposerQueuedRequest[];
	isPaused: boolean;
	lastError?: string;
};

export type QueueValidationResult =
	| { ok: true; nextStateBytes: number }
	| {
			ok: false;
			reason:
				| "queueFull"
				| "inputTooLong"
				| "queueTooLarge"
				| "emptyInput";
	  };

type QueueAction =
	| { type: "add"; item: ComposerQueuedRequest }
	| { type: "remove"; queueItemId: string }
	| { type: "move"; queueItemId: string; direction: -1 | 1 }
	| {
			type: "mark";
			queueItemId: string;
			status: ComposerQueuedRequestStatus;
			error?: string;
	  }
	| { type: "pause" }
	| { type: "resume" }
	| { type: "clearError" };

export function createEmptyComposerQueueState(): ComposerQueueState {
	return {
		items: [],
		isPaused: false,
	};
}

export function validateQueueAdmission(
	state: ComposerQueueState,
	request: AdmittedComposerRequest,
): QueueValidationResult {
	if (state.items.length >= MAX_QUEUED_COMPOSER_REQUESTS) {
		return { ok: false, reason: "queueFull" };
	}
	if (!request.providerInput.prompt.trim()) {
		return { ok: false, reason: "emptyInput" };
	}
	if (
		request.providerInput.prompt.length >
		MAX_QUEUED_COMPOSER_INPUT_LENGTH
	) {
		return { ok: false, reason: "inputTooLong" };
	}
	const nextStateBytes = estimateComposerQueueStateBytes({
		...state,
		items: [
			...state.items,
			createPendingQueueItem({
				request,
				queueItemId: "pending",
				position: state.items.length,
				createdAt: new Date(0).toISOString(),
			}),
		],
	});
	if (nextStateBytes > MAX_QUEUED_COMPOSER_STATE_BYTES) {
		return { ok: false, reason: "queueTooLarge" };
	}
	return { ok: true, nextStateBytes };
}

export function createPendingQueueItem(input: {
	request: AdmittedComposerRequest;
	queueItemId: string;
	position: number;
	createdAt: string;
}): ComposerQueuedRequest {
	return {
		id: input.request.id,
		queueItemId: input.queueItemId,
		admittedRequestId: input.request.id,
		request: input.request,
		status: "queued",
		position: input.position,
		createdAt: input.createdAt,
	};
}

export function estimateComposerQueueStateBytes(state: ComposerQueueState) {
	const compact = {
		isPaused: state.isPaused,
		items: state.items.map((item) => ({
			id: item.id,
			queueItemId: item.queueItemId,
			admittedRequestId: item.admittedRequestId,
			status: item.status,
			position: item.position,
			createdAt: item.createdAt,
			prompt: item.request.providerInput.prompt,
			partCount: item.request.requestParts.length,
			error: item.error,
		})),
	};
	return new TextEncoder().encode(JSON.stringify(compact)).length;
}

export function useComposerQueueStore() {
	const [state, dispatch] = useReducer(
		composerQueueReducer,
		undefined,
		createEmptyComposerQueueState,
	);
	const add = useCallback((item: ComposerQueuedRequest) => {
		dispatch({ type: "add", item });
	}, []);
	const remove = useCallback((queueItemId: string) => {
		dispatch({ type: "remove", queueItemId });
	}, []);
	const move = useCallback((queueItemId: string, direction: -1 | 1) => {
		dispatch({ type: "move", queueItemId, direction });
	}, []);
	const mark = useCallback(
		(
			queueItemId: string,
			status: ComposerQueuedRequestStatus,
			error?: string,
		) => {
			dispatch({ type: "mark", queueItemId, status, error });
		},
		[],
	);
	const pause = useCallback(() => dispatch({ type: "pause" }), []);
	const resume = useCallback(() => dispatch({ type: "resume" }), []);
	const clearError = useCallback(
		() => dispatch({ type: "clearError" }),
		[],
	);
	return { state, add, remove, move, mark, pause, resume, clearError };
}

export type ComposerQueueController = ReturnType<typeof useComposerQueueStore>;

function composerQueueReducer(
	state: ComposerQueueState,
	action: QueueAction,
): ComposerQueueState {
	switch (action.type) {
		case "add":
			return normalizePositions({
				...state,
				items: [...state.items, action.item],
				lastError: undefined,
			});
		case "remove":
			return normalizePositions({
				...state,
				items: state.items.filter(
					(item) => item.queueItemId !== action.queueItemId,
				),
			});
		case "move": {
			const index = state.items.findIndex(
				(item) => item.queueItemId === action.queueItemId,
			);
			const nextIndex = index + action.direction;
			if (
				index < 0 ||
				nextIndex < 0 ||
				nextIndex >= state.items.length
			) {
				return state;
			}
			const items = [...state.items];
			const [item] = items.splice(index, 1);
			if (!item) {
				return state;
			}
			items.splice(nextIndex, 0, item);
			return normalizePositions({ ...state, items });
		}
		case "mark":
			return {
				...state,
				items: state.items.map((item) =>
					item.queueItemId === action.queueItemId
						? {
								...item,
								status: action.status,
								error: action.error,
							}
						: item,
				),
				lastError:
					action.status === "failed" ? action.error : state.lastError,
			};
		case "pause":
			return { ...state, isPaused: true };
		case "resume":
			return { ...state, isPaused: false, lastError: undefined };
		case "clearError":
			return { ...state, lastError: undefined };
	}
}

function normalizePositions(state: ComposerQueueState): ComposerQueueState {
	return {
		...state,
		items: state.items.map((item, index) => ({
			...item,
			position: index,
		})),
	};
}
