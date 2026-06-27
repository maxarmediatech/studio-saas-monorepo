import { useEffect, useMemo, useRef, useState } from "react";
import type {
	CodexRuntimeMode,
	DraftRecord,
	PersistedQueueItem,
	RespondSessionRequestInput,
} from "../../../preload/types";
import {
	type ComposerDraftWarningCode,
	normalizeComposerDraftEnvelope,
} from "../../../shared/composer-draft-envelope";
import type { ComposerTarget } from "../../../shared/composer-target";
import type { PendingRequest, RuntimeOption } from "../../app/types";
import { ComposerQueuePanel } from "./ComposerQueuePanel";
import { useComposerDraftStore } from "./core/composerDraftStore";
import {
	composerDraftToPersistInput,
	type PendingRequestAnswerDrafts,
	useComposerDraftSync,
} from "./core/composerDraftSync";
import type { ComposerDraft } from "./core/composerDraftTypes";
import type { AdmittedComposerRequest } from "./core/composerProviderTypes";
import {
	type ComposerQueueController,
	createPendingQueueItem,
	type QueueValidationResult,
	useComposerQueueStore,
	validateQueueAdmission,
} from "./core/composerQueueStore";
import { admitComposerDraft } from "./core/composerSendController";
import { SessionComposer } from "./SessionComposer";

type DraftRouteRecoveryState =
	| { kind: "idle" }
	| { kind: "loading" }
	| { kind: "missing"; draftId: string }
	| { kind: "active" }
	| { kind: "promoted"; conversationId?: string }
	| { kind: "discarded" }
	| { kind: "promotion-interrupted" }
	| { kind: "parse-warning"; warnings: ComposerDraftWarningCode[] }
	| { kind: "parse-error"; message: string };

export type ComposerRegionSession = {
	draftId?: string;
	conversationId?: string;
	isTurnRunning: boolean;
	isTurnActive: boolean;
	pendingRequests: PendingRequest[];
	loadComposerDraft: (
		target: ComposerTarget,
	) => Promise<DraftRecord | undefined>;
	persistDraft: Parameters<typeof useComposerDraftSync>[0]["persistDraft"];
	clearComposerDraft: (target: ComposerTarget) => Promise<void>;
	sendAdmittedRequest: (
		request: AdmittedComposerRequest,
		options?: { target?: ComposerTarget },
	) => Promise<boolean>;
	enqueueAdmittedRequest: (request: AdmittedComposerRequest) => Promise<
		| {
				id: string;
				conversationId: string;
				admittedRequestId: string;
				position: number;
				status: "queued";
				createdAt: string;
				updatedAt: string;
		  }
		| undefined
	>;
	cancelQueuedRequest: (queueItemId: string) => Promise<void>;
	listQueuedRequests: () => Promise<PersistedQueueItem[]>;
	executeNextQueuedRequest: () => Promise<unknown>;
	reportComposerAdmissionBlock: (reason: string) => void;
	interruptConversation: () => Promise<void>;
	createNewSession: () => Promise<void>;
	respondToRequest: (
		requestId: string,
		response: RespondSessionRequestInput,
	) => Promise<void>;
};

export function ComposerRegion(props: {
	session: ComposerRegionSession;
	model: string;
	runtimeMode: CodexRuntimeMode;
	runtimeOptions: RuntimeOption[];
	workspaceRoot?: string;
	draftScopeId: string;
	routeDraftId?: string;
	resetKey?: string;
	onModelChange: (model: string) => void;
	onRuntimeModeChange: (mode: CodexRuntimeMode) => void;
	onNewDraftRoute: () => Promise<void>;
	onDraftSendStarted?: (draftId: string) => void;
	onDraftSendFailed?: (draftId: string) => void;
	onOpenPromotedConversation?: (conversationId: string) => void;
	queue?: ComposerQueueController;
	renderQueueInComposer?: boolean;
	renderPendingRequestsInComposer?: boolean;
}) {
	const composer = useComposerDraftStore({
		model: props.model,
		runtimeMode: props.runtimeMode,
	});
	const internalQueue = useComposerQueueStore();
	const queue = props.queue ?? internalQueue;
	const composerTarget = useMemo<ComposerTarget | undefined>(() => {
		const draftId = props.routeDraftId ?? props.session.draftId;
		if (draftId) {
			return { kind: "draft", id: draftId };
		}
		if (props.session.conversationId) {
			return { kind: "conversation", id: props.session.conversationId };
		}
		return undefined;
	}, [
		props.session.conversationId,
		props.routeDraftId,
		props.session.draftId,
	]);
	const composerTargetKey = composerTarget
		? `${composerTarget.kind}:${composerTarget.id}`
		: "none";
	const [suppressNextPersistSignal, setSuppressNextPersistSignal] =
		useState(0);
	const [pendingRequestAnswerDrafts, setPendingRequestAnswerDrafts] =
		useState<PendingRequestAnswerDrafts>({});
	const scopedPendingRequestAnswerDrafts =
		composerTarget?.kind === "conversation"
			? pendingRequestAnswerDrafts
			: undefined;
	const [hydratedComposerTargetKey, setHydratedComposerTargetKey] =
		useState<string>();
	const [draftRouteRecovery, setDraftRouteRecovery] =
		useState<DraftRouteRecoveryState>({ kind: "idle" });
	const openedDraftScopeRef = useRef<string | undefined>(undefined);
	const resetKeyRef = useRef<string | undefined>(props.resetKey);
	const sessionRef = useRef(props.session);
	const latestDraftRef = useRef(composer.draft);
	const latestPendingRequestAnswerDraftsRef = useRef(
		pendingRequestAnswerDrafts,
	);
	const queueItemsRef = useRef(queue.state.items);
	const hydratedQueueConversationRef = useRef<string | undefined>(undefined);
	const executingQueueItemRef = useRef<string | undefined>(undefined);

	useEffect(() => {
		sessionRef.current = props.session;
	}, [props.session]);

	useEffect(() => {
		latestDraftRef.current = composer.draft;
	}, [composer.draft]);

	useEffect(() => {
		latestPendingRequestAnswerDraftsRef.current =
			pendingRequestAnswerDrafts;
	}, [pendingRequestAnswerDrafts]);

	useEffect(() => {
		queueItemsRef.current = queue.state.items;
	}, [queue.state.items]);

	useEffect(() => {
		const conversationId = props.session.conversationId;
		if (!conversationId) {
			hydratedQueueConversationRef.current = undefined;
			return;
		}
		if (hydratedQueueConversationRef.current === conversationId) {
			return;
		}
		hydratedQueueConversationRef.current = conversationId;
		let canceled = false;
		void sessionRef.current.listQueuedRequests().then((items) => {
			if (canceled) {
				console.warn("[composer] stale queue hydrate ignored", {
					warningCode: "draft_hydrate_stale_result_ignored",
					conversationId,
				});
				return;
			}
			const existingIds = new Set(
				queueItemsRef.current.map((item) => item.queueItemId),
			);
			for (const item of items) {
				if (item.status !== "queued" && item.status !== "running") {
					continue;
				}
				if (existingIds.has(item.id)) {
					console.warn(
						"[composer] duplicate persisted queue item ignored",
						{
							warningCode:
								"queue_hydrate_duplicate_optimistic_item",
							conversationId,
							queueItemId: item.id,
						},
					);
					continue;
				}
				queue.add({
					...createPendingQueueItem({
						request: item.request as AdmittedComposerRequest,
						queueItemId: item.id,
						position: item.position,
						createdAt: item.createdAt,
					}),
					status: item.status,
					error: item.error,
				});
			}
		});
		return () => {
			canceled = true;
		};
	}, [props.session.conversationId, queue.add]);

	useEffect(() => {
		if (
			!props.session.conversationId ||
			props.session.isTurnActive ||
			props.session.isTurnRunning ||
			queue.state.isPaused ||
			executingQueueItemRef.current
		) {
			return;
		}
		const next = queue.state.items.find(
			(item) =>
				item.status === "queued" &&
				item.queueItemId !== executingQueueItemRef.current,
		);
		if (!next) {
			return;
		}
		executingQueueItemRef.current = next.queueItemId;
		queue.mark(next.queueItemId, "running");
		void props.session
			.executeNextQueuedRequest()
			.then((result) => {
				if (didExecuteQueuedRequest(result)) {
					queue.remove(next.queueItemId);
					return;
				}
				queue.mark(
					next.queueItemId,
					"failed",
					"Queue execution did not start",
				);
			})
			.catch((error) => {
				queue.mark(
					next.queueItemId,
					"failed",
					error instanceof Error ? error.message : String(error),
				);
			})
			.finally(() => {
				executingQueueItemRef.current = undefined;
			});
	}, [
		props.session.conversationId,
		props.session.isTurnActive,
		props.session.isTurnRunning,
		props.session.executeNextQueuedRequest,
		queue,
	]);

	const draftSync = useComposerDraftSync({
		draft: composer.draft,
		target: composerTarget,
		scopeKey: props.workspaceRoot,
		persistDraft: props.session.persistDraft,
		pendingRequestAnswerDrafts: scopedPendingRequestAnswerDrafts,
		enabled: Boolean(
			composerTarget && hydratedComposerTargetKey === composerTargetKey,
		),
		suppressNextPersistSignal,
		onFlushError: (error) => {
			console.warn("[composer] draft flush failed", {
				warningCode: "draft_flush_failed",
				targetKey: composerTargetKey,
			});
			props.session.reportComposerAdmissionBlock(
				error instanceof Error ? error.message : String(error),
			);
		},
	});

	useEffect(() => {
		const openingRouteDraft =
			props.routeDraftId &&
			openedDraftScopeRef.current !== props.routeDraftId;
		if (openingRouteDraft) {
			openedDraftScopeRef.current = props.routeDraftId;
			const resetBaseline = resetComposerDraftInput(
				latestDraftRef.current,
			);
			latestDraftRef.current = resetBaseline;
			composer.reset();
			void sessionRef.current.createNewSession();
		}
		latestPendingRequestAnswerDraftsRef.current = {};
		setPendingRequestAnswerDrafts({});
		setHydratedComposerTargetKey(undefined);
		setDraftRouteRecovery(
			props.routeDraftId ? { kind: "loading" } : { kind: "idle" },
		);
		if (!composerTarget) {
			return;
		}
		const hydrateBaseline = latestDraftRef.current;
		const pendingAnswerHydrateBaseline =
			latestPendingRequestAnswerDraftsRef.current;
		let canceled = false;
		void sessionRef.current
			.loadComposerDraft(composerTarget)
			.then((storedDraft) => {
				if (canceled) {
					console.warn("[composer] stale draft hydrate ignored", {
						warningCode: "draft_hydrate_stale_result_ignored",
						targetKey: composerTargetKey,
					});
					return;
				}
				if (!storedDraft) {
					setHydratedComposerTargetKey(composerTargetKey);
					setDraftRouteRecovery(
						props.routeDraftId
							? { kind: "missing", draftId: props.routeDraftId }
							: { kind: "idle" },
					);
					return;
				}
				if (props.routeDraftId && storedDraft.status === "promoted") {
					setHydratedComposerTargetKey(composerTargetKey);
					setDraftRouteRecovery({
						kind: "promoted",
						conversationId: storedDraft.promotedConversationId,
					});
					return;
				}
				if (props.routeDraftId && storedDraft.status === "discarded") {
					setHydratedComposerTargetKey(composerTargetKey);
					setDraftRouteRecovery({ kind: "discarded" });
					return;
				}
				if (props.routeDraftId && storedDraft.status === "promoting") {
					setHydratedComposerTargetKey(composerTargetKey);
					setDraftRouteRecovery({ kind: "promotion-interrupted" });
					return;
				}
				try {
					const parsed = normalizeComposerDraftEnvelope({
						target: composerTarget,
						envelope: storedDraft.payload,
						updatedAt: storedDraft.updatedAt,
					});
					if (canceled) {
						console.warn("[composer] stale draft hydrate ignored", {
							warningCode: "draft_hydrate_stale_result_ignored",
							targetKey: composerTargetKey,
						});
						return;
					}
					if (
						!sameComposerDraftInput(
							latestDraftRef.current,
							hydrateBaseline,
						) ||
						!samePendingRequestAnswerDrafts(
							latestPendingRequestAnswerDraftsRef.current,
							pendingAnswerHydrateBaseline,
						)
					) {
						console.warn("[composer] dirty draft hydrate ignored", {
							warningCode: "draft_hydrate_stale_result_ignored",
							targetKey: composerTargetKey,
						});
						setDraftRouteRecovery(
							props.routeDraftId
								? { kind: "active" }
								: { kind: "idle" },
						);
						setHydratedComposerTargetKey(composerTargetKey);
						return;
					}
					composer.hydrate({
						text: parsed.envelope.input.text,
						mode: parsed.envelope.input.mode,
						contextItems: parsed.envelope.input.contextItems,
						attachments: parsed.envelope.input.attachments,
						selection: parsed.envelope.input.selection,
					});
					if (parsed.envelope.input.model) {
						props.onModelChange(parsed.envelope.input.model);
					}
					props.onRuntimeModeChange(
						parsed.envelope.input.runtimeMode,
					);
					setPendingRequestAnswerDrafts(
						composerTarget.kind === "conversation"
							? parsed.envelope.pendingRequestAnswerDrafts
							: {},
					);
					const warnings = [
						...(storedDraft.warnings ?? []),
						...parsed.warnings,
					];
					setDraftRouteRecovery(
						props.routeDraftId
							? warnings.length > 0
								? {
										kind: "parse-warning",
										warnings,
									}
								: { kind: "active" }
							: { kind: "idle" },
					);
					setSuppressNextPersistSignal((signal) => signal + 1);
					setHydratedComposerTargetKey(composerTargetKey);
				} catch (error) {
					console.warn("[composer] draft restore failed", {
						warningCode: "draft_restore_failure",
						targetKey: composerTargetKey,
					});
					setHydratedComposerTargetKey(composerTargetKey);
					setDraftRouteRecovery({
						kind: "parse-error",
						message:
							error instanceof Error
								? error.message
								: String(error),
					});
				}
			})
			.catch((error) => {
				if (canceled) {
					return;
				}
				console.warn("[composer] draft restore failed", {
					warningCode: "draft_restore_failure",
					targetKey: composerTargetKey,
				});
				setHydratedComposerTargetKey(composerTargetKey);
				setDraftRouteRecovery({
					kind: "parse-error",
					message:
						error instanceof Error ? error.message : String(error),
				});
			});
		return () => {
			canceled = true;
		};
	}, [
		composerTarget,
		composerTargetKey,
		props.routeDraftId,
		composer.hydrate,
		composer.reset,
		props.onModelChange,
		props.onRuntimeModeChange,
	]);

	useEffect(() => {
		if (!props.resetKey || resetKeyRef.current === props.resetKey) {
			return;
		}
		resetKeyRef.current = props.resetKey;
		composer.reset();
	}, [props.resetKey, composer.reset]);

	async function sendMessage() {
		if (composerTarget && hydratedComposerTargetKey !== composerTargetKey) {
			props.session.reportComposerAdmissionBlock(
				"Draft is still loading",
			);
			return false;
		}
		try {
			await draftSync.flush();
		} catch {
			return false;
		}
		if (props.routeDraftId) {
			props.onDraftSendStarted?.(props.routeDraftId);
		}
		const submittedDraft = composer.draft;
		const payloadAdmission = admitComposerDraft({
			draft: submittedDraft,
		});
		if (!payloadAdmission.ok) {
			if (props.routeDraftId) {
				props.onDraftSendFailed?.(props.routeDraftId);
			}
			props.session.reportComposerAdmissionBlock(payloadAdmission.reason);
			return false;
		}
		if (shouldQueueInsteadOfSend()) {
			const queued = await enqueueRequest(payloadAdmission.request);
			if (queued) {
				await clearCurrentComposerInput(submittedDraft);
			}
			return queued;
		}
		const sent = await props.session.sendAdmittedRequest(
			payloadAdmission.request,
			{ target: composerTarget },
		);
		if (sent) {
			await clearCurrentComposerInput(submittedDraft);
		} else if (props.routeDraftId) {
			props.onDraftSendFailed?.(props.routeDraftId);
		}
		return sent;
	}

	function shouldQueueInsteadOfSend() {
		return Boolean(
			props.session.conversationId &&
				props.session.isTurnRunning &&
				!props.routeDraftId,
		);
	}

	async function clearCurrentComposerInput(submittedDraft: ComposerDraft) {
		if (!sameComposerDraftInput(latestDraftRef.current, submittedDraft)) {
			return;
		}
		const hasPendingAnswerDrafts = hasPendingRequestAnswerDrafts(
			scopedPendingRequestAnswerDrafts ?? {},
		);
		if (composerTarget?.kind === "conversation") {
			if (hasPendingAnswerDrafts) {
				await props.session.persistDraft({
					target: composerTarget,
					draft: composerDraftToPersistInput(
						{
							...composer.draft,
							text: "",
							contextItems: [],
							attachments: [],
							selection: { start: 0, end: 0 },
							updatedAt: Date.now(),
						},
						scopedPendingRequestAnswerDrafts,
					),
				});
			} else {
				await props.session.clearComposerDraft(composerTarget);
			}
		}
		setSuppressNextPersistSignal((signal) => signal + 1);
		composer.reset();
	}

	async function enqueueRequest(request: AdmittedComposerRequest) {
		const validation = validateQueueAdmission(queue.state, request);
		if (!validation.ok) {
			props.session.reportComposerAdmissionBlock(
				queueValidationMessage(validation.reason) ??
					"Could not queue request",
			);
			return false;
		}
		const serverItem = await props.session.enqueueAdmittedRequest(request);
		if (!serverItem) {
			return false;
		}
		queue.add(
			createPendingQueueItem({
				request,
				queueItemId: serverItem.id,
				position: serverItem.position,
				createdAt: serverItem.createdAt,
			}),
		);
		return true;
	}

	async function removeQueuedRequest(queueItemId: string) {
		await props.session.cancelQueuedRequest(queueItemId);
		queue.remove(queueItemId);
	}

	function updatePendingDraft(
		requestId: string,
		questionId: string,
		value: string,
	) {
		if (composerTarget?.kind !== "conversation") {
			return;
		}
		setPendingRequestAnswerDrafts((drafts) => ({
			...drafts,
			[requestId]: {
				...(drafts[requestId] ?? {}),
				[questionId]: value,
			},
		}));
	}

	async function handleRequestResponse(
		requestId: string,
		response: RespondSessionRequestInput,
	) {
		await props.session.respondToRequest(requestId, response);
		setPendingRequestAnswerDrafts((drafts) => {
			const next = { ...drafts };
			delete next[requestId];
			return next;
		});
	}

	return (
		<>
			<DraftRouteRecoveryBanner
				state={draftRouteRecovery}
				onOpenConversation={props.onOpenPromotedConversation}
			/>
			<SessionComposer
				value={composer.text}
				disabled={
					props.session.isTurnRunning && !props.session.conversationId
				}
				turnActive={props.session.isTurnActive}
				queueActive={shouldQueueInsteadOfSend()}
				mode={composer.mode}
				model={props.model}
				runtimeMode={props.runtimeMode}
				runtimeOptions={props.runtimeOptions}
				pendingRequests={
					props.renderPendingRequestsInComposer === false
						? []
						: props.session.pendingRequests
				}
				workspaceRoot={props.workspaceRoot}
				resetSignal={composer.resetSignal}
				initialContextItems={composer.contextItems}
				initialAttachments={composer.attachments}
				selection={composer.selection}
				onChange={composer.setText}
				onModeChange={composer.setMode}
				onContextItemsChange={composer.setContextItems}
				onAttachmentsChange={composer.setAttachments}
				onSelectionChange={composer.setSelection}
				onModelChange={props.onModelChange}
				onRuntimeModeChange={props.onRuntimeModeChange}
				onBlur={() => {
					void draftSync.flush().catch(() => undefined);
				}}
				onSend={sendMessage}
				onInterrupt={props.session.interruptConversation}
				onNewSession={props.onNewDraftRoute}
				onRespondRequest={handleRequestResponse}
				pendingRequestAnswerDrafts={
					scopedPendingRequestAnswerDrafts ?? {}
				}
				onPendingRequestAnswerDraftChange={updatePendingDraft}
				queuePanel={
					props.renderQueueInComposer === false ? null : (
						<ComposerQueuePanel
							items={queue.state.items}
							isPaused={queue.state.isPaused}
							lastError={queue.state.lastError}
							onPause={queue.pause}
							onResume={queue.resume}
							onRemove={removeQueuedRequest}
						/>
					)
				}
			/>
		</>
	);
}

function DraftRouteRecoveryBanner(props: {
	state: DraftRouteRecoveryState;
	onOpenConversation?: (conversationId: string) => void;
}) {
	const message = draftRouteRecoveryMessage(props.state);
	if (!message) {
		return null;
	}
	const promotedConversationId =
		props.state.kind === "promoted"
			? props.state.conversationId
			: undefined;
	return (
		<div className="mb-2 rounded-[12px] border border-[var(--desktop-inbox-border)] bg-[color-mix(in_srgb,var(--desktop-inbox)_88%,transparent)] px-3 py-2 text-[12px] text-[var(--desktop-subtle)]">
			<div className="flex items-center justify-between gap-3">
				<span>{message}</span>
				{promotedConversationId ? (
					<button
						className="shrink-0 rounded-[8px] border border-[var(--desktop-inbox-border)] px-2 py-1 text-[12px] font-medium text-[var(--desktop-strong)]"
						type="button"
						onClick={() =>
							props.onOpenConversation?.(promotedConversationId)
						}
					>
						Open conversation
					</button>
				) : null}
			</div>
		</div>
	);
}

function draftRouteRecoveryMessage(state: DraftRouteRecoveryState) {
	switch (state.kind) {
		case "idle":
			return "";
		case "loading":
			return "Checking saved draft...";
		case "missing":
			return `No saved draft found for ${state.draftId}. Start typing to create it.`;
		case "active":
			return "Active draft restored.";
		case "promoted":
			return "This draft was already sent and promoted to a conversation.";
		case "discarded":
			return "This draft was discarded. Start a new draft to continue.";
		case "promotion-interrupted":
			return "Draft promotion was interrupted. Review before sending again.";
		case "parse-warning":
			return `Draft restored with warnings: ${state.warnings.join(", ")}`;
		case "parse-error":
			return `Draft payload could not be restored: ${state.message}`;
	}
}

function resetComposerDraftInput(draft: ComposerDraft): ComposerDraft {
	return {
		...draft,
		text: "",
		mode: "ask",
		contextItems: [],
		attachments: [],
		selection: { start: 0, end: 0 },
		updatedAt: Date.now(),
	};
}

function sameComposerDraftInput(left: ComposerDraft, right: ComposerDraft) {
	return composerDraftInputKey(left) === composerDraftInputKey(right);
}

function composerDraftInputKey(draft: ComposerDraft) {
	return JSON.stringify({
		text: draft.text,
		mode: draft.mode,
		model: draft.model,
		runtimeMode: draft.runtimeMode,
		contextItems: draft.contextItems,
		attachments: draft.attachments,
	});
}

function hasPendingRequestAnswerDrafts(drafts: PendingRequestAnswerDrafts) {
	return Object.values(drafts).some((answers) =>
		Object.values(answers).some((answer) => answer.length > 0),
	);
}

function samePendingRequestAnswerDrafts(
	left: PendingRequestAnswerDrafts,
	right: PendingRequestAnswerDrafts,
) {
	return JSON.stringify(left) === JSON.stringify(right);
}

function didExecuteQueuedRequest(value: unknown) {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}
	const result = value as Record<string, unknown>;
	return result.ok === true && result.executed === true;
}

function queueValidationMessage(
	reason: Extract<QueueValidationResult, { ok: false }>["reason"],
) {
	switch (reason) {
		case "queueFull":
			return "Queue limit reached";
		case "inputTooLong":
			return "Queued request is too long";
		case "queueTooLarge":
			return "Queue is too large";
		case "emptyInput":
			return "Message required";
	}
}
