import { useEffect, useRef } from "react";
import {
	attachmentKeysToDelete,
	shouldGuardSpaNavigation,
} from "../quotation-helpers";

async function deleteUploads(keys: string[]) {
	const results = await Promise.allSettled(
		keys.map(async (key) => {
			const response = await fetch("/api/uploads/file", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ key }),
			});
			if (!response.ok) {
				throw new Error(`Could not clean uploaded document ${key}`);
			}
		}),
	);
	return results.every((result) => result.status === "fulfilled");
}

export function useQuotationAttachmentLifecycle() {
	const initialKeys = useRef(new Set<string>());
	const uploadedKeys = useRef(new Set<string>());

	return {
		setInitialKeys(keys: Iterable<string>) {
			initialKeys.current = new Set(keys);
		},
		trackUpload(key: string) {
			uploadedKeys.current.add(key);
		},
		async cleanupAfterSave(currentKeys: Iterable<string>) {
			return deleteUploads(
				attachmentKeysToDelete({
					initialKeys: initialKeys.current,
					currentKeys,
					uploadedKeys: uploadedKeys.current,
					includeInitial: true,
				}),
			);
		},
		async cleanupOnDiscard() {
			return deleteUploads(
				attachmentKeysToDelete({
					initialKeys: initialKeys.current,
					currentKeys: [],
					uploadedKeys: uploadedKeys.current,
					includeInitial: false,
				}),
			);
		},
	};
}

export function useQuotationNavigationGuard({
	dirty,
	onBlocked,
}: {
	dirty: boolean;
	onBlocked: (target: string) => void;
}) {
	const onBlockedRef = useRef(onBlocked);
	onBlockedRef.current = onBlocked;

	useEffect(() => {
		const warn = (event: BeforeUnloadEvent) => {
			if (dirty) {
				event.preventDefault();
			}
		};
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [dirty]);

	useEffect(() => {
		if (!dirty) {
			return;
		}
		const currentUrl = window.location.href;
		const guardLink = (event: MouseEvent) => {
			if (
				event.defaultPrevented ||
				event.button !== 0 ||
				event.metaKey ||
				event.ctrlKey ||
				event.shiftKey ||
				event.altKey
			) {
				return;
			}
			const anchor = (event.target as Element | null)?.closest(
				"a[href]",
			) as HTMLAnchorElement | null;
			if (!anchor || anchor.target || anchor.hasAttribute("download")) {
				return;
			}
			const target = new URL(anchor.href, currentUrl);
			if (!shouldGuardSpaNavigation(new URL(currentUrl), target)) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			onBlockedRef.current(
				`${target.pathname}${target.search}${target.hash}`,
			);
		};
		const guardBack = (event: PopStateEvent) => {
			event.preventDefault();
			event.stopImmediatePropagation();
			const target = `${window.location.pathname}${window.location.search}${window.location.hash}`;
			window.history.pushState(null, "", currentUrl);
			onBlockedRef.current(target);
		};
		document.addEventListener("click", guardLink, true);
		window.addEventListener("popstate", guardBack, true);
		return () => {
			document.removeEventListener("click", guardLink, true);
			window.removeEventListener("popstate", guardBack, true);
		};
	}, [dirty]);
}
