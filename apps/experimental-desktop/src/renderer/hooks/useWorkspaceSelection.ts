import { useState } from "react";

export function useWorkspaceSelection() {
	const [selectedFolderPath, setSelectedFolderPath] = useState<
		string | undefined
	>();
	const [selectionMessage, setSelectionMessage] = useState(
		"No file or folder selected.",
	);

	async function chooseFolder() {
		const path = await window.experimentalDesktop.openDirectory();
		setSelectedFolderPath(path ?? undefined);
		setSelectionMessage(path ?? "Folder picker canceled.");
	}

	async function chooseFile() {
		const path = await window.experimentalDesktop.openFile();
		setSelectionMessage(path ?? "File picker canceled.");
	}

	return {
		selectedFolderPath,
		selectionMessage,
		chooseFolder,
		chooseFile,
	};
}
