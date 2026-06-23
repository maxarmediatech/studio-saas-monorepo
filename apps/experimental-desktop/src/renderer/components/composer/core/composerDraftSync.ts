import { useEffect, useMemo, useRef } from "react";
import { buildComposerPayload, type ComposerPayload } from "../composerPayload";
import type { ComposerDraft } from "./composerDraftTypes";

export type ComposerDraftPersistInput = {
	payload: ComposerPayload;
	model: string;
	runtimeMode: ComposerDraft["runtimeMode"];
};

export function shouldPersistComposerDraft(input: {
	draft: ComposerDraft;
	draftId?: string;
	conversationId?: string;
}) {
	if (input.conversationId) {
		return false;
	}
	return (
		Boolean(input.draftId) ||
		input.draft.text.trim().length > 0 ||
		input.draft.contextItems.length > 0 ||
		input.draft.attachments.length > 0
	);
}

export function composerDraftToPersistInput(
	draft: ComposerDraft,
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
	};
}

export function createComposerDraftPersistKey(input: {
	draft: ComposerDraft;
	scopeKey?: string;
}) {
	return JSON.stringify({
		scopeKey: input.scopeKey ?? null,
		draft: composerDraftToPersistInput(input.draft),
	});
}

export function useComposerDraftSync(input: {
	draft: ComposerDraft;
	draftId?: string;
	conversationId?: string;
	debounceMs?: number;
	scopeKey?: string;
	persistDraft: (draft: ComposerDraftPersistInput) => Promise<void>;
}) {
	const lastPersistKeyRef = useRef<string | undefined>(undefined);
	const persistKey = useMemo(
		() =>
			createComposerDraftPersistKey({
				draft: input.draft,
				scopeKey: input.scopeKey,
			}),
		[input.draft, input.scopeKey],
	);

	useEffect(() => {
		if (
			!shouldPersistComposerDraft({
				draft: input.draft,
				draftId: input.draftId,
				conversationId: input.conversationId,
			})
		) {
			return;
		}
		if (lastPersistKeyRef.current === persistKey) {
			return;
		}
		const timeout = window.setTimeout(() => {
			lastPersistKeyRef.current = persistKey;
			void input.persistDraft(composerDraftToPersistInput(input.draft));
		}, input.debounceMs ?? 350);
		return () => window.clearTimeout(timeout);
	}, [
		input.draft,
		input.draftId,
		input.conversationId,
		input.debounceMs,
		input.persistDraft,
		input.scopeKey,
		persistKey,
	]);
}
