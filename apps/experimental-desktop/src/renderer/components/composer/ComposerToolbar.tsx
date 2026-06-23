import {
	IconBriefcase,
	IconFilePlus,
	IconFolderPlus,
	IconPlus,
} from "@tabler/icons-react";
import type { CodexRuntimeMode } from "../../../preload/types";
import { iconProps } from "../../app/icons";
import type { RuntimeOption } from "../../app/types";
import {
	IconButton,
	ModelPill,
	ModePill,
	RuntimeModeSelect,
} from "./ComposerControls";
import {
	type ComposerPrimaryAction,
	ComposerPrimaryButton,
} from "./ComposerPrimaryButton";
import type { ComposerMode } from "./composerTriggers";

export function ComposerToolbar(props: {
	mode: ComposerMode;
	model: string;
	runtimeMode: CodexRuntimeMode;
	runtimeOptions: RuntimeOption[];
	primaryAction: ComposerPrimaryAction;
	onModeChange: (mode: ComposerMode) => void;
	onModelChange: (model: string) => void;
	onRuntimeModeChange: (mode: CodexRuntimeMode) => void;
	onNewSession: () => Promise<void>;
	onPrimaryAction: () => void;
	onAttachFile: () => Promise<void>;
	onAttachFolder: () => Promise<void>;
	onAttachWorkspace: () => void;
	canAttachWorkspace: boolean;
}) {
	return (
		<div className="flex items-center justify-between gap-2 px-4 pb-3 [&_svg]:!stroke-[1.8]">
			<div className="flex min-w-0 items-center gap-2">
				<IconButton label="New session" onClick={props.onNewSession}>
					<IconPlus {...iconProps} />
				</IconButton>
				<ModePill mode={props.mode} onModeChange={props.onModeChange} />
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
				<IconButton label="Attach file" onClick={props.onAttachFile}>
					<IconFilePlus {...iconProps} />
				</IconButton>
				<IconButton
					label="Reference folder"
					onClick={props.onAttachFolder}
				>
					<IconFolderPlus {...iconProps} />
				</IconButton>
				<IconButton
					label="Attach workspace"
					disabled={!props.canAttachWorkspace}
					onClick={async () => props.onAttachWorkspace()}
				>
					<IconBriefcase {...iconProps} />
				</IconButton>
				<ComposerPrimaryButton
					action={props.primaryAction}
					onClick={props.onPrimaryAction}
				/>
			</div>
		</div>
	);
}
