import {
	IconArrowUp,
	IconChevronDown,
	IconCommand,
	IconFilePlus,
	IconMicrophone,
	IconPlus,
	IconTerminal2,
} from "@tabler/icons-react";
import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import type {
	CodexRuntimeMode,
	RespondSessionRequestInput,
} from "../../../preload/types";
import { iconProps } from "../../app/icons";
import type { PendingRequest, RuntimeOption } from "../../app/types";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import {
	composerControlClass,
	IconButton,
	ModelPill,
	ModePill,
	RuntimeModeSelect,
} from "./ComposerControls";
import {
	type ComposerCommand,
	type ComposerMode,
	composerCommands,
	detectComposerTrigger,
	replaceComposerRange,
	serializeComposerSendText,
} from "./composerTriggers";
import { PendingRequestDock } from "./PendingRequestDock";

const menuItemClass =
	"grid w-full grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2 rounded-[9px] border-0 bg-transparent px-2.5 py-2 text-left text-[var(--desktop-default)] transition-colors hover:bg-[var(--desktop-inbox-hover)]";
const chipClass =
	"inline-flex h-7 max-w-[220px] items-center gap-1.5 rounded-[8px] border border-[var(--desktop-inbox-border)] bg-[color-mix(in_srgb,var(--desktop-inbox-hover)_72%,transparent)] px-2.5 text-[12px] font-medium text-[var(--desktop-subtle)]";

type ComposerHistoryEntry = {
	mode: ComposerMode;
	text: string;
};

export function SessionComposer(props: {
	value: string;
	disabled: boolean;
	model: string;
	runtimeMode: CodexRuntimeMode;
	runtimeOptions: RuntimeOption[];
	pendingRequests: PendingRequest[];
	onChange: (value: string) => void;
	onModelChange: (model: string) => void;
	onRuntimeModeChange: (mode: CodexRuntimeMode) => void;
	onSend: (text: string) => Promise<boolean>;
	onNewSession: () => Promise<void>;
	onRespondRequest: (
		requestId: string,
		response: RespondSessionRequestInput,
	) => Promise<void>;
}) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [mode, setMode] = useState<ComposerMode>("normal");
	const [activeIndex, setActiveIndex] = useState(0);
	const [history, setHistory] = useState<ComposerHistoryEntry[]>([]);
	const [historyIndex, setHistoryIndex] = useState(-1);
	const [savedDraft, setSavedDraft] = useState<string | null>(null);
	const [userInputDrafts, setUserInputDrafts] = useState<
		Record<string, Record<string, string>>
	>({});

	const trigger = useMemo(() => {
		const target = textareaRef.current;
		const cursor = target?.selectionStart ?? props.value.length;
		return mode === "shell"
			? null
			: detectComposerTrigger(props.value, cursor);
	}, [props.value, mode]);

	const menuItems = useMemo(() => {
		if (!trigger) {
			return [];
		}
		const query = trigger.query.toLowerCase();
		if (trigger.kind === "slash") {
			return composerCommands.filter((command) =>
				command.trigger.toLowerCase().startsWith(query),
			);
		}
		if (trigger.kind === "file") {
			return [
				{
					id: "choose-file",
					trigger: "file",
					label: "Choose File",
					description: "Attach a local file path.",
					action: "insert",
					insertText: "@",
				},
				{
					id: "current-workspace",
					trigger: "workspace",
					label: "Current Workspace",
					description: "Reference the selected folder.",
					action: "insert",
					insertText: "@workspace ",
				},
			] satisfies ComposerCommand[];
		}
		if (trigger.kind === "skill") {
			const skillItems: ComposerCommand[] = [
				{
					id: "apply-patch",
					trigger: "apply_patch",
					label: "apply_patch",
					description: "Ask Codex to patch files.",
					action: "insert",
					insertText: "$apply_patch ",
				},
				{
					id: "run-tests",
					trigger: "run_tests",
					label: "run_tests",
					description: "Ask Codex to validate changes.",
					action: "insert",
					insertText: "$run_tests ",
				},
			];
			return skillItems.filter((item) => item.trigger.startsWith(query));
		}
		return [
			{
				id: "terminal-context",
				trigger: "terminal",
				label: "Terminal Context",
				description: "Reference latest terminal output.",
				action: "insert",
				insertText: ">latest-terminal ",
			},
		] satisfies ComposerCommand[];
	}, [trigger]);

	async function send() {
		const text = serializeComposerSendText(props.value, mode);
		if (!text) {
			return;
		}
		const sent = await props.onSend(text);
		if (!sent) {
			return;
		}
		setHistory((entries) =>
			[{ mode, text: props.value }, ...entries].slice(0, 80),
		);
		setHistoryIndex(-1);
		setSavedDraft(null);
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
		const next = replaceComposerRange(
			props.value,
			trigger.rangeStart,
			trigger.rangeEnd,
			`@${path} `,
		);
		props.onChange(next.text);
		focusAt(next.cursor);
	}

	function selectItem(item: ComposerCommand) {
		if (item.id === "choose-file") {
			void chooseFile();
			return;
		}
		if (item.action === "new-session") {
			props.onChange("");
			void props.onNewSession();
			return;
		}
		if (item.action === "clear") {
			props.onChange("");
			return;
		}
		if (item.action === "shell") {
			setMode("shell");
			props.onChange("");
			return;
		}
		if (item.action === "normal") {
			setMode("normal");
			props.onChange("");
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
				setSavedDraft(props.value);
			}
			const entry = history[nextIndex];
			setHistoryIndex(nextIndex);
			setMode(entry.mode);
			props.onChange(entry.text);
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
		} else {
			props.onChange(savedDraft ?? "");
			setSavedDraft(null);
		}
		return true;
	}

	function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		if (event.nativeEvent.isComposing) {
			return;
		}
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
				props.onChange(props.value);
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

	const contextTokens = collectContextTokens(props.value);

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
				{contextTokens.length > 0 ? (
					<div className="flex flex-wrap gap-1.5 px-[18px] pt-3">
						{contextTokens.map((token) => (
							<span className={chipClass} key={token}>
								<IconFilePlus {...iconProps} size={14} />
								<span className="truncate">{token}</span>
							</span>
						))}
					</div>
				) : null}
				<textarea
					ref={textareaRef}
					value={props.value}
					className={cn(
						"min-h-[76px] resize-none border-0 bg-transparent px-[18px] pb-1.5 pt-4 text-[14px] font-[440] leading-[1.45] text-[var(--desktop-default)] shadow-none outline-none placeholder:text-[color-mix(in_srgb,var(--desktop-subtle)_58%,transparent)] focus-visible:shadow-none",
						mode === "shell" &&
							"font-mono text-[13px] text-[color-mix(in_srgb,#32d583_80%,var(--desktop-default))]",
					)}
					placeholder={
						mode === "shell"
							? "Run command..."
							: "Ask, plan, edit, attach context..."
					}
					disabled={props.disabled}
					onChange={(event) => {
						setActiveIndex(0);
						props.onChange(event.currentTarget.value);
					}}
					onKeyDown={onKeyDown}
				/>
				<div className="flex items-center justify-between gap-2 px-4 pb-3 [&_svg]:!stroke-[1.8]">
					<div className="flex min-w-0 items-center gap-2">
						<IconButton
							label="New session"
							onClick={props.onNewSession}
						>
							<IconPlus {...iconProps} />
						</IconButton>
						<ModePill mode={mode} onModeChange={setMode} />
						<ModelPill
							model={props.model}
							onModelChange={props.onModelChange}
						/>
						<RuntimeModeSelect
							value={props.runtimeMode}
							options={props.runtimeOptions}
							onChange={props.onRuntimeModeChange}
						/>
					</div>
					<div className="flex items-center gap-2">
						<Button
							className={cn(
								composerControlClass,
								"text-[var(--desktop-subtle)]",
							)}
							size="icon-sm"
							variant="ghost"
							type="button"
							title="Voice input"
							aria-label="Voice input"
						>
							<IconMicrophone {...iconProps} />
						</Button>
						<Button
							className={cn(
								composerControlClass,
								mode === "shell"
									? "!bg-[color-mix(in_srgb,#32d583_70%,#101010)] text-white"
									: "!bg-[color-mix(in_srgb,#0a84ff_62%,#ffffff)] text-white",
								"shadow-none active:scale-[0.98]",
							)}
							size="icon-sm"
							type="button"
							disabled={props.disabled}
							onClick={() => void send()}
							title={mode === "shell" ? "Run" : "Send"}
							aria-label={mode === "shell" ? "Run" : "Send"}
						>
							{mode === "shell" ? (
								<IconTerminal2 {...iconProps} />
							) : (
								<IconArrowUp {...iconProps} />
							)}
						</Button>
					</div>
				</div>
			</div>
			<div className="relative z-1 mt-[-12px] flex min-h-[48px] items-center justify-between gap-3 rounded-b-[18px] border border-t-0 border-[var(--desktop-inbox-border)] bg-[color-mix(in_srgb,var(--desktop-inbox-hover)_62%,var(--desktop-inbox))] px-4 pb-0 pt-3 text-[12px] text-[var(--desktop-subtle)] [box-shadow:0_1px_0_color-mix(in_srgb,var(--desktop-strong)_3%,transparent)]">
				<span className="truncate">
					{mode === "shell"
						? "Shell mode sends a command request to Codex."
						: "Triggers: / commands, @ files, $ skills, > terminal context"}
				</span>
				<span className="shrink-0">Cmd Enter</span>
			</div>
		</section>
	);
}

function ComposerMenu(props: {
	items: ComposerCommand[];
	activeIndex: number;
	onHover: (index: number) => void;
	onSelect: (item: ComposerCommand) => void;
}) {
	return (
		<div className="absolute inset-x-3 bottom-full mb-2 max-h-[284px] overflow-auto rounded-[14px] border border-[var(--desktop-inbox-border)] bg-[color-mix(in_srgb,var(--desktop-inbox)_94%,transparent)] p-1.5 shadow-[0_18px_52px_-34px_var(--desktop-shadow)] backdrop-blur-xl">
			{props.items.map((item, index) => {
				const active = index === props.activeIndex;
				return (
					<button
						className={cn(
							menuItemClass,
							active && "bg-[var(--desktop-inbox-hover)]",
						)}
						type="button"
						key={item.id}
						onMouseEnter={() => props.onHover(index)}
						onMouseDown={(event) => {
							event.preventDefault();
							props.onSelect(item);
						}}
					>
						<IconCommand {...iconProps} size={16} />
						<span className="min-w-0">
							<span className="block truncate text-[13px] font-semibold">
								/{item.trigger} · {item.label}
							</span>
							<span className="block truncate text-[12px] text-[var(--desktop-subtle)]">
								{item.description}
							</span>
						</span>
						<IconChevronDown
							className={active ? "opacity-100" : "opacity-0"}
							{...iconProps}
							size={15}
						/>
					</button>
				);
			})}
		</div>
	);
}

function collectContextTokens(text: string) {
	const matches = text.match(/(?:^|\s)([@$>][^\s]+)/g) ?? [];
	return matches.map((match) => match.trim()).slice(0, 6);
}
