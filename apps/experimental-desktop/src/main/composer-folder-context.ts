import { execFile } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const IGNORED_NAMES = new Set([
	".git",
	"node_modules",
	"dist",
	"out",
	".next",
	".turbo",
	"coverage",
	"build",
]);

const DEFAULT_PATTERNS = [
	".ts",
	".tsx",
	".js",
	".jsx",
	".json",
	".md",
	".css",
	".scss",
];
const MAX_VISITED_DIRECTORIES = 10_000;
const MAX_TREE_LINES = 350;
const MAX_INCLUDED_PATHS = 220;

type FolderMode =
	| "reference"
	| "tree"
	| "pattern"
	| "changed-files"
	| "summary";

type FolderEntry = {
	path: string;
	relativePath: string;
	kind: "file" | "directory";
};

export async function scanComposerFolderContext(input: unknown) {
	const record = input as {
		path?: unknown;
		mode?: unknown;
		patterns?: unknown;
	};
	if (typeof record.path !== "string" || !record.path.trim()) {
		throw new Error("Folder path is required");
	}
	const rootPath = resolve(record.path);
	const rootStat = await stat(rootPath).catch(() => null);
	if (!rootStat?.isDirectory()) {
		throw new Error("Folder path must be a directory");
	}
	const mode = normalizeMode(record.mode);
	const patterns = normalizePatterns(record.patterns);
	if (mode === "reference") {
		return referenceResult(rootPath, mode, patterns);
	}
	const scan = await collectEntries(rootPath);
	const files = scan.entries.filter((entry) => entry.kind === "file");
	const directories = scan.entries.filter(
		(entry) => entry.kind === "directory",
	);
	const warnings = [...scan.warnings];
	let includedPaths: string[] = [];
	let treeLines: string[] = [];

	if (mode === "tree") {
		treeLines = scan.entries.slice(0, MAX_TREE_LINES).map(formatTreeLine);
		includedPaths = files
			.slice(0, MAX_INCLUDED_PATHS)
			.map((entry) => entry.relativePath);
		if (scan.entries.length > MAX_TREE_LINES) {
			warnings.push(
				`Folder tree truncated to ${MAX_TREE_LINES} entries.`,
			);
		}
	}
	if (mode === "pattern") {
		const matchedFiles = files.filter((entry) =>
			matchesPattern(entry.relativePath, patterns),
		);
		includedPaths = matchedFiles
			.slice(0, MAX_INCLUDED_PATHS)
			.map((entry) => entry.relativePath);
		if (matchedFiles.length > MAX_INCLUDED_PATHS) {
			warnings.push(
				`Pattern results truncated to ${MAX_INCLUDED_PATHS} files.`,
			);
		}
	}
	if (mode === "changed-files") {
		const changedFiles = await collectChangedFiles(rootPath);
		includedPaths = changedFiles
			.slice(0, MAX_INCLUDED_PATHS)
			.map((entry) => entry.relativePath);
		if (changedFiles.length > MAX_INCLUDED_PATHS) {
			warnings.push(
				`Changed files truncated to ${MAX_INCLUDED_PATHS} files.`,
			);
		}
		if (changedFiles.length === 0) {
			warnings.push("No Git changed files found under this folder.");
		}
	}
	if (mode === "summary") {
		includedPaths = files.slice(0, 60).map((entry) => entry.relativePath);
	}

	const extensions = extensionCounts(files);
	const approxChars = estimateChars({
		mode,
		rootPath,
		includedPaths,
		treeLines,
		extensions,
	});
	return {
		mode,
		rootPath,
		label: basename(rootPath),
		fileCount: files.length,
		directoryCount: directories.length,
		includedFileCount: includedPaths.length,
		ignoredCount: scan.ignoredCount,
		visitedCount: scan.visitedCount,
		truncated: scan.truncated || includedPaths.length >= MAX_INCLUDED_PATHS,
		patterns: mode === "pattern" ? patterns : undefined,
		treeLines: treeLines.length ? treeLines : undefined,
		includedPaths: includedPaths.length ? includedPaths : undefined,
		extensions: extensions.slice(0, 16),
		warnings,
		approxChars,
		approxTokens: Math.ceil(approxChars / 4),
		createdAt: new Date().toISOString(),
	};
}

function referenceResult(
	rootPath: string,
	mode: FolderMode,
	patterns: string[],
) {
	const approxChars = rootPath.length;
	return {
		mode,
		rootPath,
		label: basename(rootPath),
		fileCount: 0,
		directoryCount: 0,
		includedFileCount: 0,
		ignoredCount: 0,
		visitedCount: 0,
		truncated: false,
		patterns: mode === "pattern" ? patterns : undefined,
		warnings: [
			"Reference mode includes only the folder path, not contents.",
		],
		approxChars,
		approxTokens: Math.ceil(approxChars / 4),
		createdAt: new Date().toISOString(),
	};
}

async function collectEntries(rootPath: string) {
	const entries: FolderEntry[] = [];
	const warnings: string[] = [];
	const queue = [rootPath];
	let ignoredCount = 0;
	let visitedCount = 0;
	let truncated = false;
	while (queue.length > 0 && visitedCount < MAX_VISITED_DIRECTORIES) {
		const current = queue.shift();
		if (!current) {
			break;
		}
		visitedCount += 1;
		const dirents = await readdir(current, { withFileTypes: true }).catch(
			() => [],
		);
		for (const dirent of dirents) {
			if (dirent.isSymbolicLink() || IGNORED_NAMES.has(dirent.name)) {
				ignoredCount += 1;
				continue;
			}
			const fullPath = join(current, dirent.name);
			const relativePath = relative(rootPath, fullPath)
				.split("\\")
				.join("/");
			if (dirent.isDirectory()) {
				entries.push({
					path: fullPath,
					relativePath,
					kind: "directory",
				});
				queue.push(fullPath);
			}
			if (dirent.isFile()) {
				entries.push({ path: fullPath, relativePath, kind: "file" });
			}
		}
	}
	if (queue.length > 0 || visitedCount >= MAX_VISITED_DIRECTORIES) {
		truncated = true;
		warnings.push(
			`Folder scan stopped after ${MAX_VISITED_DIRECTORIES.toLocaleString()} visited directories.`,
		);
	}
	return { entries, warnings, ignoredCount, visitedCount, truncated };
}

async function collectChangedFiles(rootPath: string) {
	const { stdout } = await execFileAsync(
		"git",
		[
			"-C",
			rootPath,
			"status",
			"--porcelain=v1",
			"--untracked-files=normal",
			"--",
			".",
		],
		{ maxBuffer: 1024 * 1024 },
	).catch(() => ({ stdout: "" }));
	return stdout
		.split("\n")
		.map(parseGitStatusPath)
		.filter((path): path is string => Boolean(path))
		.map((relativePath) => ({
			path: join(rootPath, relativePath),
			relativePath,
			kind: "file" as const,
		}));
}

function parseGitStatusPath(line: string) {
	if (line.length < 4) {
		return undefined;
	}
	const raw = line.slice(3);
	const renamePath = raw.includes(" -> ") ? raw.split(" -> ").at(-1) : raw;
	return renamePath?.replace(/^"|"$/g, "").trim() || undefined;
}

function normalizeMode(mode: unknown): FolderMode {
	return mode === "tree" ||
		mode === "pattern" ||
		mode === "changed-files" ||
		mode === "summary" ||
		mode === "reference"
		? mode
		: "reference";
}

function normalizePatterns(patterns: unknown) {
	if (!Array.isArray(patterns)) {
		return DEFAULT_PATTERNS;
	}
	const cleaned = patterns
		.filter((pattern): pattern is string => typeof pattern === "string")
		.map((pattern) => pattern.trim())
		.filter(Boolean)
		.slice(0, 24);
	return cleaned.length ? cleaned : DEFAULT_PATTERNS;
}

function matchesPattern(relativePath: string, patterns: string[]) {
	const lower = relativePath.toLowerCase();
	return patterns.some((pattern) => {
		const normalized = pattern.toLowerCase().replace(/^\*/, "");
		return lower.endsWith(normalized) || lower.includes(normalized);
	});
}

function formatTreeLine(entry: FolderEntry) {
	return `${entry.kind === "directory" ? "dir " : "file"} ${entry.relativePath}`;
}

function extensionCounts(files: FolderEntry[]) {
	const counts = new Map<string, number>();
	for (const file of files) {
		const extension =
			extname(file.relativePath).toLowerCase() || "[no extension]";
		counts.set(extension, (counts.get(extension) ?? 0) + 1);
	}
	return Array.from(counts.entries())
		.map(([extension, count]) => ({ extension, count }))
		.sort(
			(left, right) =>
				right.count - left.count ||
				left.extension.localeCompare(right.extension),
		);
}

function estimateChars(input: {
	mode: FolderMode;
	rootPath: string;
	includedPaths: string[];
	treeLines: string[];
	extensions: Array<{ extension: string; count: number }>;
}) {
	return [
		input.mode,
		input.rootPath,
		...input.includedPaths,
		...input.treeLines,
		...input.extensions.map((item) => `${item.extension}:${item.count}`),
	].reduce((total, value) => total + value.length + 1, 0);
}
