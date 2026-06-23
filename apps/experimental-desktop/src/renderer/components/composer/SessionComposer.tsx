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
import { cn } from "../../lib/utils";
import { ComposerContextChips } from "./ComposerContextChips";
import { ComposerFooter } from "./ComposerFooter";
import { ComposerMenu } from "./ComposerMenu";
import type { ComposerPrimaryAction } from "./ComposerPrimaryButton";
import { ComposerTextarea } from "./ComposerTextarea";
import { ComposerToolbar } from "./ComposerToolbar";
import { collectContextTokens, withContextItems } from "./composerContext";
import { buildComposerMenuItems } from "./composerMenuItems";
import {
	type ComposerCommand,
	type ComposerMode,
	detectComposerTrigger,
	replaceComposerRange,
	serializeComposerSendText,
} from "./composerTriggers";
import type { ComposerContextItem } from "./composerTypes";
import { PendingRequestDock } from "./PendingRequestDock";
import { useComposerHistory } from "./useComposerHistory";
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
	onChange: (value: string) => void;
	onModelChange: (model: string) => void;
	onRuntimeModeChange: (mode: CodexRuntimeMode) => void;
	onSend: (text: string) => Promise<boolean>;
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
	const [contextItems, setContextItems] = useState<ComposerContextItem[]>([]);
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
	const fileResults = useWorkspaceFileMentions(
		activeTrigger,
		props.workspaceRoot,
	);

	useEffect(() => {
		setActiveIndex(0);
	}, [activeTrigger?.kind, activeTrigger?.query]);

	useEffect(() => {
		setContextItems([]);
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

	const menuItems = useMemo(() => {
		return buildComposerMenuItems(activeTrigger, fileResults);
	}, [activeTrigger, fileResults]);

	async function send() {
		const sentText = props.value;
		if (!sentText.trim()) {
			return;
		}
		const sentContextItems = contextItems;
		const text = withContextItems(
			serializeComposerSendText(sentText, mode),
			sentContextItems,
		);
		if (!text) {
			return;
		}
		const sent = await props.onSend(text);
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

	async function chooseFile() {
		const path = await window.experimentalDesktop.openFile();
		if (!path || !trigger) {
			return;
		}
		const label = path.slice(
			Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1,
		);
		setContextItems((items) =>
			items.some((existing) => existing.path === path)
				? items
				: [...items, { type: "file", label, path }],
		);
		const next = replaceComposerRange(
			props.value,
			trigger.rangeStart,
			trigger.rangeEnd,
			`@${label} `,
		);
		props.onChange(next.text);
		focusAt(next.cursor);
	}

	function selectItem(item: ComposerCommand) {
		const workspaceRoot = props.workspaceRoot;
		if (item.id.startsWith("workspace-file:")) {
			const file = fileResults.find(
				(result) => `workspace-file:${result.path}` === item.id,
			);
			if (file && trigger) {
				setContextItems((items) =>
					items.some((existing) => existing.path === file.path)
						? items
						: [
								...items,
								{
									type: file.kind,
									label: file.relativePath,
									path: file.path,
								},
							],
				);
				const next = replaceComposerRange(
					props.value,
					trigger.rangeStart,
					trigger.rangeEnd,
					`@${file.name} `,
				);
				props.onChange(next.text);
				focusAt(next.cursor);
			}
			return;
		}
		if (item.id === "current-workspace" && workspaceRoot && trigger) {
			setContextItems((items) =>
				items.some((existing) => existing.path === workspaceRoot)
					? items
					: [
							...items,
							{
								type: "directory",
								label: workspaceRoot,
								path: workspaceRoot,
							},
						],
			);
		}
		if (item.id === "choose-file") {
			void chooseFile();
			return;
		}
		if (item.action === "mode" && item.mode) {
			changeMode(item.mode);
			if (trigger) {
				const next = replaceComposerRange(
					props.value,
					trigger.rangeStart,
					trigger.rangeEnd,
					"",
				);
				props.onChange(next.text);
				focusAt(next.cursor);
			}
			return;
		}
		if (item.action === "new-session") {
			void createNewSession();
			return;
		}
		if (item.action === "clear") {
			props.onChange("");
			setContextItems([]);
			return;
		}
		if (!trigger) {
			return;
		}
		const next = replaceComposerRange(
			props.value,
			trigger.rangeStart,
			trigger.rangeEnd,
			item.insertText ?? `/${item.trigger} `,
		);
		props.onChange(next.text);
		focusAt(next.cursor);
	}

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
				setActiveIndex((index) => (index + 1) % menuItems.length);
				return;
			}
			if (event.key === "ArrowUp") {
				event.preventDefault();
				setActiveIndex(
					(index) =>
						(index - 1 + menuItems.length) % menuItems.length,
				);
				return;
			}
			if (event.key === "Enter" && !event.shiftKey) {
				event.preventDefault();
				selectItem(menuItems[activeIndex] ?? menuItems[0]);
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
	const primaryAction = resolvePrimaryAction({
		mode,
		disabled: props.disabled,
		turnActive: props.turnActive,
		hasText: props.value.trim() !== "",
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
		<section
			className="isolate flex flex-col overflow-visible border-0 bg-transparent shadow-none"
			aria-label="Codex session composer"
		>
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
			<div
				className={cn(
					"relative z-2 flex min-h-[132px] flex-col rounded-[18px] border border-[var(--desktop-inbox-border)] bg-[var(--desktop-inbox)] [box-shadow:0_1px_0_color-mix(in_srgb,var(--desktop-strong)_3%,transparent),0_10px_22px_-18px_var(--desktop-shadow)]",
					mode === "shell" &&
						"border-[color-mix(in_srgb,#32d583_34%,var(--desktop-inbox-border))]",
					mode === "plan" &&
						"border-[color-mix(in_srgb,#f7c948_34%,var(--desktop-inbox-border))]",
					mode === "build" &&
						"border-[color-mix(in_srgb,#0a84ff_34%,var(--desktop-inbox-border))]",
					mode === "review" &&
						"border-[color-mix(in_srgb,#ff7a45_30%,var(--desktop-inbox-border))]",
				)}
			>
				{menuItems.length > 0 ? (
					<ComposerMenu
						items={menuItems}
						activeIndex={activeIndex}
						onHover={setActiveIndex}
						onSelect={selectItem}
					/>
				) : null}
				<ComposerContextChips
					contextItems={contextItems}
					textTokens={contextTokens}
					onRemoveContext={(path) =>
						setContextItems((items) =>
							items.filter((item) => item.path !== path),
						)
					}
				/>
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
				/>
			</div>
			<ComposerFooter mode={mode} />
		</section>
	);
}

function resolvePrimaryAction(input: {
	mode: ComposerMode;
	disabled: boolean;
	turnActive: boolean;
	hasText: boolean;
}): ComposerPrimaryAction {
	if (input.turnActive) {
		return "stop";
	}
	if (input.disabled || !input.hasText) {
		return "disabled";
	}
	return input.mode === "shell" ? "run-shell" : "send";
}
