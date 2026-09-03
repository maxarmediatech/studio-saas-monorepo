"use client";

import { Button } from "@repo/ui/components/button";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	buildQuotationPdfUrl,
	type QuotationPresentationIdentity,
} from "./quotation-pdf-route";
import {
	fetchQuotationPdfBlob,
	shouldAcceptQuotationPreviewResponse,
} from "./quotation-preview-resource";
import {
	completeQuotationPreviewLoad,
	listQuotationPreviewResources,
	promoteQuotationPreviewResource,
	type QuotationPreviewFrameState,
	type QuotationPreviewResourceState,
	syncQuotationPreviewTarget,
} from "./quotation-preview-state";

interface QuotationPdfPreviewProps {
	quoteId: string;
	identity: QuotationPresentationIdentity;
	className?: string;
}

export function QuotationPdfPreview({
	quoteId,
	identity,
	className = "h-[720px]",
}: QuotationPdfPreviewProps) {
	const targetUrl = useMemo(
		() => buildQuotationPdfUrl(quoteId, identity),
		[quoteId, identity],
	);
	const targetUrlRef = useRef(targetUrl);
	targetUrlRef.current = targetUrl;
	const liveObjectUrls = useRef(new Set<string>());
	const [frame, setFrame] = useState<QuotationPreviewFrameState>({
		displayedUrl: null,
		loadingUrl: targetUrl,
	});
	const [resources, setResources] = useState<QuotationPreviewResourceState>({
		displayed: null,
		prepared: null,
	});
	const displayedRef = useRef(resources.displayed);
	displayedRef.current = resources.displayed;
	const previousDisplayedObjectUrl = useRef<string | null>(null);
	const [failedUrl, setFailedUrl] = useState<string | null>(null);
	const [requestVersion, setRequestVersion] = useState(0);

	const revokeObjectUrl = useCallback((objectUrl: string) => {
		if (liveObjectUrls.current.delete(objectUrl)) {
			URL.revokeObjectURL(objectUrl);
		}
	}, []);

	useEffect(() => {
		const previous = previousDisplayedObjectUrl.current;
		const current = resources.displayed?.objectUrl ?? null;
		previousDisplayedObjectUrl.current = current;
		if (previous && previous !== current) {
			revokeObjectUrl(previous);
		}
	}, [resources.displayed, revokeObjectUrl]);

	useEffect(
		() => () => {
			for (const objectUrl of liveObjectUrls.current) {
				URL.revokeObjectURL(objectUrl);
			}
			liveObjectUrls.current.clear();
		},
		[],
	);

	useEffect(() => {
		setFailedUrl(null);
		setFrame((current) => syncQuotationPreviewTarget(current, targetUrl));
		setResources((current) => {
			if (
				current.prepared &&
				current.prepared.canonicalUrl !== targetUrl
			) {
				revokeObjectUrl(current.prepared.objectUrl);
				return { ...current, prepared: null };
			}
			return current;
		});
		if (displayedRef.current?.canonicalUrl === targetUrl) {
			return;
		}

		const controller = new AbortController();
		let cancelled = false;
		void fetchQuotationPdfBlob(targetUrl, controller.signal)
			.then((blob) => {
				if (
					!shouldAcceptQuotationPreviewResponse(
						targetUrl,
						targetUrlRef.current,
						cancelled || controller.signal.aborted,
					)
				) {
					return;
				}
				const objectUrl = URL.createObjectURL(blob);
				liveObjectUrls.current.add(objectUrl);
				setResources((current) => {
					if (targetUrlRef.current !== targetUrl) {
						revokeObjectUrl(objectUrl);
						return current;
					}
					if (
						current.prepared &&
						current.prepared.objectUrl !== objectUrl
					) {
						revokeObjectUrl(current.prepared.objectUrl);
					}
					return {
						...current,
						prepared: { canonicalUrl: targetUrl, objectUrl },
					};
				});
			})
			.catch(() => {
				if (
					!shouldAcceptQuotationPreviewResponse(
						targetUrl,
						targetUrlRef.current,
						cancelled || controller.signal.aborted,
					)
				) {
					return;
				}
				setFailedUrl(targetUrl);
				setFrame((current) =>
					current.loadingUrl === targetUrl
						? { ...current, loadingUrl: null }
						: current,
				);
			});
		return () => {
			cancelled = true;
			controller.abort();
		};
	}, [targetUrl, requestVersion, revokeObjectUrl]);

	const loading =
		frame.loadingUrl === targetUrl &&
		resources.displayed?.canonicalUrl !== targetUrl;
	const currentResources = {
		...resources,
		prepared:
			resources.prepared?.canonicalUrl === targetUrl
				? resources.prepared
				: null,
	};
	const previewResources = listQuotationPreviewResources(currentResources);

	return (
		<div
			className={`relative overflow-hidden rounded-lg border bg-muted/30 ${className}`}
		>
			{previewResources.map((resource) => {
				const displayed =
					resources.displayed?.objectUrl === resource.objectUrl;
				const prepared =
					resources.prepared?.objectUrl === resource.objectUrl &&
					resource.canonicalUrl === targetUrl;
				return (
					<iframe
						className={
							displayed
								? "absolute inset-0 h-full w-full bg-white opacity-100"
								: "pointer-events-none absolute inset-0 h-full w-full opacity-0"
						}
						key={resource.objectUrl}
						src={resource.objectUrl}
						title={
							displayed
								? "Quotation PDF preview"
								: "Preparing quotation PDF preview"
						}
						onError={
							prepared
								? () => {
										if (
											resource.canonicalUrl !==
											targetUrlRef.current
										) {
											return;
										}
										revokeObjectUrl(resource.objectUrl);
										setResources((current) => ({
											...current,
											prepared: null,
										}));
										setFailedUrl(targetUrl);
										setFrame((current) => ({
											...current,
											loadingUrl: null,
										}));
									}
								: undefined
						}
						onLoad={
							prepared
								? () => {
										if (
											resource.canonicalUrl !==
											targetUrlRef.current
										) {
											return;
										}
										setFrame((current) =>
											completeQuotationPreviewLoad(
												current,
												resource.canonicalUrl,
												targetUrl,
											),
										);
										setResources((current) =>
											promoteQuotationPreviewResource(
												current,
												resource.objectUrl,
												targetUrlRef.current,
											),
										);
									}
								: undefined
						}
					/>
				);
			})}
			{loading && (
				<div className="absolute inset-0 z-10 grid place-items-center bg-background/70 backdrop-blur-[1px]">
					<div className="flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-medium shadow-sm">
						<Loader2 className="size-4 animate-spin" />
						Preparing preview
					</div>
				</div>
			)}
			{failedUrl === targetUrl && !loading && (
				<div className="absolute inset-0 z-10 grid place-items-center bg-background/85">
					<div className="space-y-3 text-center">
						<p className="text-sm text-muted-foreground">
							Preview could not be loaded.
						</p>
						<Button
							onClick={() =>
								setRequestVersion((current) => current + 1)
							}
							size="sm"
							variant="outline"
						>
							Try again
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
