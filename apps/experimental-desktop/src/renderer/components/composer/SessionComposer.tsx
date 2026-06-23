import {
	type KeyboardEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type {
	CodexRuntimeMode,
	RespondSessionRequestInput,
} from "../../../preload/types";
import type { PendingRequest, RuntimeOption } from "../../app/types";
import { ComposerContextChips } from "./ComposerContextChips";
import { ComposerFooter } from "./ComposerFooter";
import { ComposerFrame } from "./ComposerFrame";
import { ComposerMenu } from "./ComposerMenu";
import { resolvePrimaryAction } from "./ComposerPrimaryButton";
import { ComposerTextarea } from "./ComposerTextarea";
import { ComposerToolbar } from "./ComposerToolbar";
import { collectContextTokens } from "./composerContext";
import { nextSelectableIndex } from "./composerKeyboard";
import { buildComposerMenuItems } from "./composerMenuItems";
import {
	buildComposerPayload,
	type ComposerPayload,
	estimateComposerContextMetrics,
} from "./composerPayload";
import { type ComposerMode, detectComposerTrigger } from "./composerTriggers";
import type { ComposerContextItem } from "./composerTypes";
import { PendingRequestDock } from "./PendingRequestDock";
import { useComposerHistory } from "./useComposerHistory";
import { useComposerMenuSelection } from "./useComposerMenuSelection";
import { useWorkspaceFileMentions } from "./useWorkspaceFileMentions";

export function SessionComposer(props: {
	value: string;
	disabled: boolean;
	turnActive: boolean;
	model: string;
	runtimeMode: CodexRuntimeMode;
	runtimeOptions: RuntimeOption[];
	pendingRequests: PendingRequest[];
	workspaceRoot?: string;
	resetSignal: number;
	initialContextItems: ComposerContextItem[];
	onChange: (value: string) => void;
	onModeChange: (mode: ComposerMode) => void;
	onContextItemsChange: (items: ComposerContextItem[]) => void;
	onModelChange: (model: string) => void;
	onRuntimeModeChange: (mode: CodexRuntimeMode) => void;
	onSend: (payload: ComposerPayload) => Promise<boolean>;
	onInterrupt: () => Promise<void>;
	onNewSession: () => Promise<void>;
	onRespondRequest: (
		requestId: string,
		response: RespondSessionRequestInput,
	) => Promise<void>;
}) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [mode, setMode] = useState<ComposerMode>("ask");
	const [activeIndex, setActiveIndex] = useState(0);
	const {
		history,
		setHistory,
		historyIndex,
		setHistoryIndex,
		savedDraft,
		setSavedDraft,
	} = useComposerHistory(props.workspaceRoot);
	const [selectionStart, setSelectionStart] = useState(0);
	const [dismissedTriggerKey, setDismissedTriggerKey] = useState<
		string | null
	>(null);
	const [contextItems, setContextItems] = useState<ComposerContextItem[]>(
		props.initialContextItems,
	);
	const [userInputDrafts, setUserInputDrafts] = useState<
		Record<string, Record<string, string>>
	>({});

	const trigger = useMemo(() => {
		return mode === "shell"
			? null
			: detectComposerTrigger(
					props.value,
					selectionStart || props.value.length,
				);
	}, [props.value, mode, selectionStart]);
	const triggerKey = trigger
		? `${trigger.kind}:${trigger.rangeStart}:${trigger.query}`
		: null;
	const activeTrigger =
		trigger && triggerKey !== dismissedTriggerKey ? trigger : null;
	const fileSearch = useWorkspaceFileMentions(
		activeTrigger,
		props.workspaceRoot,
	);

	useEffect(() => {
		setActiveIndex(0);
	}, [activeTrigger?.kind, activeTrigger?.query]);

	useEffect(() => {
		setContextItems(props.initialContextItems);
		setHistoryIndex(-1);
		setSavedDraft(null);
		setDismissedTriggerKey(null);
		setActiveIndex(0);
	}, [
		props.workspaceRoot,
		props.resetSignal,
		setHistoryIndex,
		setSavedDraft,
	]);

	useEffect(() => {
		props.onContextItemsChange(contextItems);
	}, [contextItems, props.onContextItemsChange]);

	const menuItems = useMemo(() => {
		return buildComposerMenuItems(activeTrigger, fileSearch);
	}, [activeTrigger, fileSearch]);

	const selectableMenuItems = useMemo(
		() => menuItems.filter((item) => !item.disabled),
		[menuItems],
	);

	async function send() {
		const sentText = props.value;
		const sentContextItems = contextItems;
		const payload = buildComposerPayload({
			mode,
			text: sentText,
			contextItems: sentContextItems,
		});
		if (!payload.parts.length) {
			return;
		}
		const sent = await props.onSend(payload);
		if (!sent) {
			return;
		}
		setHistory((entries) =>
			[
				{
					mode,
					text: sentText,
					contextItems: sentContextItems,
				},
				...entries,
			].slice(0, 80),
		);
		setContextItems([]);
		setHistoryIndex(-1);
		setSavedDraft(null);
	}

	async function createNewSession() {
		props.onChange("");
		setContextItems([]);
		setHistoryIndex(-1);
		setSavedDraft(null);
		await props.onNewSession();
	}

	function changeMode(nextMode: ComposerMode) {
		setMode(nextMode);
		props.onModeChange(nextMode);
		if (nextMode === "shell") {
			setContextItems([]);
		}
	}

	function focusAt(cursor: number) {
		window.requestAnimationFrame(() => {
			textareaRef.current?.focus();
			textareaRef.current?.setSelectionRange(cursor, cursor);
		});
	}

	async function attachFile() {
		const path = await window.experimentalDesktop.openFile();
		if (!path) {
			return;
		}
		addContextItem({
			type: "file",
			label: basenameFromPath(path),
			path,
		});
	}

	async function attachFolder() {
		const path = await window.experimentalDesktop.openDirectory();
		if (!path) {
			return;
		}
		addContextItem({
			type: "directory",
			label: basenameFromPath(path),
			path,
		});
	}

	function attachWorkspace() {
		if (!props.workspaceRoot) {
			return;
		}
		addContextItem({
			type: "workspace",
			label: props.workspaceRoot,
			path: props.workspaceRoot,
			description: "Current workspace root",
		});
	}

	function addContextItem(item: ComposerContextItem) {
		setContextItems((items) =>
			items.some((existing) => existing.path === item.path)
				? items
				: [...items, item],
		);
	}

	const { selectItem } = useComposerMenuSelection({
		trigger,
		value: props.value,
		workspaceRoot: props.workspaceRoot,
		fileResults: fileSearch.results,
		onChange: props.onChange,
		focusAt,
		changeMode,
		createNewSession,
		setContextItems,
	});

	function navigateHistory(direction: "up" | "down") {
		if (history.length === 0) {
			return false;
		}
		if (direction === "up") {
			const nextIndex =
				historyIndex === -1
					? 0
					: Math.min(historyIndex + 1, history.length - 1);
			if (nextIndex === historyIndex) {
				return false;
			}
			if (historyIndex === -1) {
				setSavedDraft({ text: props.value, contextItems });
			}
			const entry = history[nextIndex];
			setHistoryIndex(nextIndex);
			setMode(entry.mode);
			props.onChange(entry.text);
			setContextItems(entry.contextItems ?? []);
			return true;
		}
		if (historyIndex <= -1) {
			return false;
		}
		const nextIndex = historyIndex - 1;
		setHistoryIndex(nextIndex);
		const entry = nextIndex >= 0 ? history[nextIndex] : null;
		if (entry) {
			setMode(entry.mode);
			props.onChange(entry.text);
			setContextItems(entry.contextItems ?? []);
		} else {
			props.onChange(savedDraft?.text ?? "");
			setContextItems(savedDraft?.contextItems ?? []);
			setSavedDraft(null);
		}
		return true;
	}

	function syncSelection(target: HTMLTextAreaElement) {
		setSelectionStart(target.selectionStart ?? props.value.length);
	}

	function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		if (event.nativeEvent.isComposing) {
			return;
		}
		syncSelection(event.currentTarget);
		if (menuItems.length > 0) {
			if (event.key === "ArrowDown") {
				event.preventDefault();
				setActiveIndex((index) =>
					nextSelectableIndex(menuItems, index, 1),
				);
				return;
			}
			if (event.key === "ArrowUp") {
				event.preventDefault();
				setActiveIndex((index) =>
					nextSelectableIndex(menuItems, index, -1),
				);
				return;
			}
			if (
				(event.key === "Enter" && !event.shiftKey) ||
				event.key === "Tab"
			) {
				event.preventDefault();
				selectItem(
					menuItems[activeIndex] ??
						selectableMenuItems[0] ??
						menuItems[0],
				);
				return;
			}
			if (event.key === "Escape") {
				event.preventDefault();
				if (triggerKey) {
					setDismissedTriggerKey(triggerKey);
				}
				return;
			}
		}
		if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
			event.preventDefault();
			void send();
			return;
		}
		if (event.key === "ArrowUp" && props.value === "") {
			event.preventDefault();
			navigateHistory("up");
			return;
		}
		if (event.key === "ArrowDown" && historyIndex >= 0) {
			event.preventDefault();
			navigateHistory("down");
		}
	}

	const contextTokens = collectContextTokens(props.value).slice(
		0,
		Math.max(0, 8 - contextItems.length),
	);
	const contextMetrics = estimateComposerContextMetrics(contextItems);
	const primaryAction = resolvePrimaryAction({
		mode,
		disabled: props.disabled,
		turnActive: props.turnActive,
		hasText: props.value.trim() !== "" || contextItems.length > 0,
	});

	function onPrimaryAction() {
		if (primaryAction === "stop") {
			void props.onInterrupt();
			return;
		}
		if (primaryAction === "send" || primaryAction === "run-shell") {
			void send();
		}
	}

	return (
		<ComposerFrame
			mode={mode}
			pendingDock={
				<PendingRequestDock
					requests={props.pendingRequests}
					drafts={userInputDrafts}
					onDraftChange={(requestId, questionId, value) =>
						setUserInputDrafts((drafts) => ({
							...drafts,
							[requestId]: {
								...(drafts[requestId] ?? {}),
								[questionId]: value,
							},
						}))
					}
					onRespond={props.onRespondRequest}
				/>
			}
			menu={
				menuItems.length > 0 ? (
					<ComposerMenu
						items={menuItems}
						activeIndex={activeIndex}
						onHover={setActiveIndex}
						onSelect={selectItem}
					/>
				) : null
			}
			chips={
				<ComposerContextChips
					contextItems={contextItems}
					textTokens={contextTokens}
					metrics={contextMetrics}
					onRemoveContext={(path) =>
						setContextItems((items) =>
							items.filter((item) => item.path !== path),
						)
					}
				/>
			}
			editor={
				<ComposerTextarea
					ref={textareaRef}
					value={props.value}
					mode={mode}
					disabled={props.disabled}
					onChange={(value, target) => {
						setActiveIndex(0);
						syncSelection(target);
						props.onChange(value);
					}}
					onSelectionChange={syncSelection}
					onKeyDown={onKeyDown}
				/>
			}
			toolbar={
				<ComposerToolbar
					mode={mode}
					model={props.model}
					runtimeMode={props.runtimeMode}
					runtimeOptions={props.runtimeOptions}
					primaryAction={primaryAction}
					onModeChange={changeMode}
					onModelChange={props.onModelChange}
					onRuntimeModeChange={props.onRuntimeModeChange}
					onNewSession={createNewSession}
					onPrimaryAction={onPrimaryAction}
					onAttachFile={attachFile}
					onAttachFolder={attachFolder}
					onAttachWorkspace={attachWorkspace}
					canAttachWorkspace={Boolean(props.workspaceRoot)}
				/>
			}
			footer={<ComposerFooter mode={mode} />}
		/>
	);
}

function basenameFromPath(path: string) {
	return path.slice(
		Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1,
	);
}
