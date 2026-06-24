import type { CodexRuntimeMode } from "../../preload/types";
import { useConversationSessionController } from "../conversations/useConversationSessionController";

export function useCodexSession(input: {
	model: string;
	runtimeMode: CodexRuntimeMode;
	selectedFolderPath?: string;
}) {
	return useConversationSessionController(input);
}
