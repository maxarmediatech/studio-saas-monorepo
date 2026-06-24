import type { ComposerPayload, ComposerPayloadPart } from "../composerPayload";
import type { ComposerContextItem } from "../composerTypes";
import type { ComposerRequestPart } from "./composerProviderTypes";

export function buildComposerRequestParts(
	payload: ComposerPayload,
): ComposerRequestPart[] {
	const seen = new Set<string>();
	return payload.parts.flatMap((part) =>
		requestPartFromPayloadPart(part).filter((requestPart) => {
			const key = requestPartKey(requestPart);
			if (seen.has(key)) {
				return false;
			}
			seen.add(key);
			return true;
		}),
	);
}

function requestPartFromPayloadPart(
	part: ComposerPayloadPart,
): ComposerRequestPart[] {
	switch (part.type) {
		case "user_text":
			return part.text.trim()
				? [{ type: "text", text: part.text.trim() }]
				: [];
		case "attachment_image":
			return part.path
				? [
						{
							type: "image_ref",
							path: part.path,
							name: part.name,
							mimeType: part.mimeType,
						},
					]
				: [];
		case "attachment_file":
			return part.path
				? [
						{
							type: "file_ref",
							path: part.path,
							name: part.name,
							mimeType: part.mimeType,
						},
					]
				: [];
		case "context_directory":
		case "context_workspace":
			return [
				{
					type: "folder_ref",
					path: part.path,
					label: part.label,
					mode: part.folderMode,
				},
			];
		case "context_file":
		case "context_skill":
		case "context_terminal":
			return [
				{
					type: "context_ref",
					path: part.path,
					label: part.label,
					contextType: contextTypeFromPartType(part.type),
				},
			];
	}
}

function requestPartKey(part: ComposerRequestPart) {
	if (part.type === "text") {
		return `${part.type}:${part.text}`;
	}
	if (part.type === "folder_ref") {
		return `${part.type}:${part.path}:${part.mode ?? ""}`;
	}
	if (part.type === "context_ref") {
		return `${part.type}:${part.contextType}:${part.path}`;
	}
	return `${part.type}:${part.path}`;
}

function contextTypeFromPartType(
	type: Extract<ComposerPayloadPart, { type: `context_${string}` }>["type"],
): ComposerContextItem["type"] {
	switch (type) {
		case "context_file":
			return "file";
		case "context_directory":
			return "directory";
		case "context_workspace":
			return "workspace";
		case "context_skill":
			return "skill";
		case "context_terminal":
			return "terminal";
	}
}
