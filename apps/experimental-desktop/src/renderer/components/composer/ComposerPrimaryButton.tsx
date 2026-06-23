import { IconArrowUp, IconSquare, IconTerminal2 } from "@tabler/icons-react";
import { iconProps } from "../../app/icons";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { composerControlClass } from "./ComposerControls";

export type ComposerPrimaryAction = "send" | "run-shell" | "stop" | "disabled";

export function ComposerPrimaryButton(props: {
	action: ComposerPrimaryAction;
	onClick: () => void;
}) {
	const disabled = props.action === "disabled";
	const title = titleForAction(props.action);
	return (
		<Button
			className={cn(
				composerControlClass,
				props.action === "stop"
					? "!bg-[color-mix(in_srgb,#ff453a_76%,#101010)] text-white"
					: props.action === "run-shell"
						? "!bg-[color-mix(in_srgb,#32d583_70%,#101010)] text-white"
						: "!bg-[color-mix(in_srgb,#0a84ff_62%,#ffffff)] text-white",
				"shadow-none active:scale-[0.98]",
			)}
			size="icon-sm"
			type="button"
			disabled={disabled}
			onClick={props.onClick}
			title={title}
			aria-label={title}
		>
			{iconForAction(props.action)}
		</Button>
	);
}

function titleForAction(action: ComposerPrimaryAction) {
	switch (action) {
		case "run-shell":
			return "Run";
		case "stop":
			return "Stop";
		case "send":
		case "disabled":
			return "Send";
	}
}

function iconForAction(action: ComposerPrimaryAction) {
	switch (action) {
		case "run-shell":
			return <IconTerminal2 {...iconProps} />;
		case "stop":
			return <IconSquare {...iconProps} />;
		case "send":
		case "disabled":
			return <IconArrowUp {...iconProps} />;
	}
}
