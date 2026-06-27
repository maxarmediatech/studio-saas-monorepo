import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ComposerTarget } from "../../../../shared/composer-target";
import { buildComposerPayload, type ComposerPayload } from "../composerPayload";
import type { ComposerDraft } from "./composerDraftTypes";

export type PendingRequestAnswerDrafts = Record<string, Record<string, string>>;

export type ComposerDraftPersistInput = {
	payload: ComposerPayload;
	model: string;
	runtimeMode: ComposerDraft["runtimeMode"];
	selection: ComposerDraft["selection"];
	pendingRequestAnswerDrafts?: PendingRequestAnswerDrafts;
};

export function shouldPersistComposerDraft(input: {
	draft: ComposerDraft;
	target?: ComposerTarget;
	draftId?: string;
	conversationId?: string;
	pendingRequestAnswerDrafts?: PendingRequestAnswerDrafts;
}) {
	const target = input.target ?? legacyTargetFromInput(input);
	if (target?.kind === "draft") {
		return true;
	}
	return (
		input.draft.text.trim().length > 0 ||
		input.draft.contextItems.length > 0 ||
		input.draft.attachments.length > 0 ||
		hasPendingRequestAnswerDrafts(input.pendingRequestAnswerDrafts)
	);
}

export function composerDraftToPersistInput(
	draft: ComposerDraft,
	pendingRequestAnswerDrafts?: PendingRequestAnswerDrafts,
): ComposerDraftPersistInput {
	return {
		payload: buildComposerPayload({
			mode: draft.mode,
			text: draft.text,
			contextItems: draft.contextItems,
			attachments: draft.attachments,
		}),
		model: draft.model,
		runtimeMode: draft.runtimeMode,
		selection: draft.selection,
		...(pendingRequestAnswerDrafts ? { pendingRequestAnswerDrafts } : {}),
	};
}

export function createComposerDraftPersistKey(input: {
	draft: ComposerDraft;
	target?: ComposerTarget;
	draftScopeId?: string;
	scopeKey?: string;
	pendingRequestAnswerDrafts?: PendingRequestAnswerDrafts;
}) {
	return JSON.stringify({
		target: input.target ?? input.draftScopeId ?? null,
		scopeKey: input.scopeKey ?? null,
		draft: composerDraftToPersistInput(
			input.draft,
			input.pendingRequestAnswerDrafts,
		),
	});
}

export function useComposerDraftSync(input: {
	draft: ComposerDraft;
	target?: ComposerTarget;
	draftId?: string;
	conversationId?: string;
	draftScopeId?: string;
	debounceMs?: number;
	scopeKey?: string;
	pendingRequestAnswerDrafts?: PendingRequestAnswerDrafts;
	enabled?: boolean;
	persistDraft: (input: {
		target: ComposerTarget;
		draft: ComposerDraftPersistInput;
	}) => Promise<void>;
	onFlushError?: (error: unknown) => void;
	suppressNextPersistSignal?: number;
}) {
	const effectiveTarget = useMemo(
		() => input.target ?? legacyTargetFromInput(input),
		[input.target, input.draftId, input.conversationId, input.draftScopeId],
	);
	const lastPersistKeyRef = useRef<string | undefined>(undefined);
	const persistDraftRef = useRef(input.persistDraft);
	const targetRef = useRef(effectiveTarget);
	const draftRef = useRef(input.draft);
	const pendingRequestAnswerDraftsRef = useRef(
		input.pendingRequestAnswerDrafts,
	);
	const flushErrorRef = useRef(input.onFlushError);
	const enabledRef = useRef(input.enabled);
	const suppressSignalRef = useRef(input.suppressNextPersistSignal);
	const persistKey = useMemo(
		() =>
			createComposerDraftPersistKey({
				draft: input.draft,
				target: effectiveTarget,
				draftScopeId: input.draftScopeId,
				scopeKey: input.scopeKey,
				pendingRequestAnswerDrafts: input.pendingRequestAnswerDrafts,
			}),
		[
			input.draft,
			effectiveTarget,
			input.draftScopeId,
			input.scopeKey,
			input.pendingRequestAnswerDrafts,
		],
	);

	useEffect(() => {
		persistDraftRef.current = input.persistDraft;
	}, [input.persistDraft]);

	const persistSnapshot = useCallback(
		async (snapshot: {
			target?: ComposerTarget;
			draft: ComposerDraft;
			pendingRequestAnswerDrafts?: PendingRequestAnswerDrafts;
		}) => {
			if (
				!snapshot.target ||
				!shouldPersistComposerDraft({
					draft: snapshot.draft,
					target: snapshot.target,
					pendingRequestAnswerDrafts:
						snapshot.pendingRequestAnswerDrafts,
				})
			) {
				return;
			}
			const currentKey = createComposerDraftPersistKey({
				draft: snapshot.draft,
				target: snapshot.target,
				scopeKey: input.scopeKey,
				pendingRequestAnswerDrafts: snapshot.pendingRequestAnswerDrafts,
			});
			lastPersistKeyRef.current = currentKey;
			await persistDraftRef.current({
				target: snapshot.target,
				draft: composerDraftToPersistInput(
					snapshot.draft,
					snapshot.pendingRequestAnswerDrafts,
				),
			});
		},
		[input.scopeKey],
	);

	useEffect(() => {
		targetRef.current = effectiveTarget;
		draftRef.current = input.draft;
		pendingRequestAnswerDraftsRef.current =
			input.pendingRequestAnswerDrafts;
		flushErrorRef.current = input.onFlushError;
		enabledRef.current = input.enabled;
	}, [
		effectiveTarget,
		input.draft,
		input.pendingRequestAnswerDrafts,
		input.onFlushError,
		input.enabled,
	]);

	useEffect(() => {
		if (suppressSignalRef.current === input.suppressNextPersistSignal) {
			return;
		}
		suppressSignalRef.current = input.suppressNextPersistSignal;
		console.warn("[composer] clear suppressed autosave", {
			warningCode: "draft_clear_suppressed_autosave",
		});
		lastPersistKeyRef.current = persistKey;
	}, [input.suppressNextPersistSignal, persistKey]);

	const flush = useCallback(async () => {
		const target = targetRef.current;
		const draft = draftRef.current;
		const pendingRequestAnswerDrafts =
			pendingRequestAnswerDraftsRef.current;
		if (input.enabled === false) {
			return;
		}
		try {
			await persistSnapshot({
				target,
				draft,
				pendingRequestAnswerDrafts,
			});
		} catch (error) {
			flushErrorRef.current?.(error);
			throw error;
		}
	}, [input.enabled, persistSnapshot]);

	useEffect(() => {
		return () => {
			if (enabledRef.current === false) {
				return;
			}
			void persistSnapshot({
				target: targetRef.current,
				draft: draftRef.current,
				pendingRequestAnswerDrafts:
					pendingRequestAnswerDraftsRef.current,
			}).catch((error) => {
				flushErrorRef.current?.(error);
			});
		};
	}, [
		effectiveTarget?.kind,
		effectiveTarget?.id,
		input.enabled,
		persistSnapshot,
	]);

	useEffect(() => {
		if (input.enabled === false) {
			return;
		}
		if (!effectiveTarget) {
			return;
		}
		if (
			!shouldPersistComposerDraft({
				draft: input.draft,
				target: effectiveTarget,
				pendingRequestAnswerDrafts: input.pendingRequestAnswerDrafts,
			})
		) {
			return;
		}
		if (lastPersistKeyRef.current === persistKey) {
			return;
		}
		const timeout = window.setTimeout(() => {
			void flush().catch(() => undefined);
		}, input.debounceMs ?? 350);
		return () => window.clearTimeout(timeout);
	}, [
		input.draft,
		input.debounceMs,
		input.enabled,
		effectiveTarget,
		persistKey,
		flush,
	]);

	useEffect(() => {
		function flushBeforeUnload() {
			void flush().catch(() => undefined);
		}
		window.addEventListener("beforeunload", flushBeforeUnload);
		return () => {
			window.removeEventListener("beforeunload", flushBeforeUnload);
		};
	}, [flush]);

	useEffect(() => {
		return () => {
			void flush().catch(() => undefined);
		};
	}, [flush]);

	return { flush };
}

function legacyTargetFromInput(input: {
	draftId?: string;
	conversationId?: string;
	draftScopeId?: string;
}): ComposerTarget | undefined {
	if (input.conversationId) {
		return { kind: "conversation", id: input.conversationId };
	}
	const draftId = input.draftId ?? input.draftScopeId;
	return draftId ? { kind: "draft", id: draftId } : undefined;
}

function hasPendingRequestAnswerDrafts(drafts?: PendingRequestAnswerDrafts) {
	if (!drafts) {
		return false;
	}
	return Object.values(drafts).some((answers) =>
		Object.values(answers).some((answer) => answer.length > 0),
	);
}
