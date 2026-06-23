import { readdir, stat } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";

const WORKSPACE_SEARCH_IGNORED_NAMES = new Set([
	".git",
	"node_modules",
	"dist",
	"out",
	".next",
	".turbo",
	"coverage",
	"build",
]);

export async function searchWorkspaceFiles(input: unknown) {
	const record = input as {
		rootPath?: unknown;
		query?: unknown;
		limit?: unknown;
	};
	if (typeof record.rootPath !== "string" || !record.rootPath.trim()) {
		return [];
	}
	const rootPath = resolve(record.rootPath);
	const query =
		typeof record.query === "string"
			? record.query.trim().toLowerCase()
			: "";
	const limit =
		typeof record.limit === "number" && Number.isFinite(record.limit)
			? Math.max(1, Math.min(80, Math.floor(record.limit)))
			: 30;
	const rootStat = await stat(rootPath).catch(() => null);
	if (!rootStat?.isDirectory()) {
		return [];
	}

	const results: Array<{
		path: string;
		name: string;
		relativePath: string;
		kind: "file" | "directory";
	}> = [];
	const queue = [rootPath];
	let visited = 0;
	const maxVisited = 4500;

	while (queue.length > 0 && visited < maxVisited && results.length < limit) {
		const current = queue.shift();
		if (!current) {
			break;
		}
		visited += 1;
		const entries = await readdir(current, { withFileTypes: true }).catch(
			() => [],
		);
		for (const entry of entries) {
			if (
				entry.isSymbolicLink() ||
				WORKSPACE_SEARCH_IGNORED_NAMES.has(entry.name)
			) {
				continue;
			}
			const fullPath = join(current, entry.name);
			const relativePath = relative(rootPath, fullPath);
			const normalizedRelativePath = relativePath.split("\\").join("/");
			const kind = entry.isDirectory()
				? "directory"
				: entry.isFile()
					? "file"
					: null;
			if (!kind) {
				continue;
			}
			if (
				!query ||
				normalizedRelativePath.toLowerCase().includes(query)
			) {
				results.push({
					path: fullPath,
					name: basename(fullPath),
					relativePath: normalizedRelativePath,
					kind,
				});
				if (results.length >= limit) {
					break;
				}
			}
			if (kind === "directory") {
				queue.push(fullPath);
			}
		}
	}
	return results.sort((left, right) => {
		if (left.kind !== right.kind) {
			return left.kind === "file" ? -1 : 1;
		}
		return left.relativePath.localeCompare(right.relativePath);
	});
}
