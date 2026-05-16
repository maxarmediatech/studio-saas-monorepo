"use client";

import type { whatsappTemplateSummarySchema } from "@repo/api/modules/whatsapp/types";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { cn } from "@repo/ui/lib/utils";
import { whatsappApi, whatsappMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CheckCircle2Icon,
	CircleAlertIcon,
	RefreshCwIcon,
	SearchIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { z } from "zod";

type WhatsAppTemplate = z.infer<typeof whatsappTemplateSummarySchema>;

function getStatusVariant(status: string) {
	return status.toLowerCase() === "approved" ? "default" : "outline";
}

function pickDefaultTemplate(templates: WhatsAppTemplate[]) {
	return (
		templates.find(
			(template) =>
				template.status.toLowerCase() === "approved" &&
				template.isSupported,
		) ??
		templates.find(
			(template) => template.status.toLowerCase() === "approved",
		) ??
		templates[0] ??
		null
	);
}

export function WhatsAppTemplatesPageClient() {
	const queryClient = useQueryClient();
	const [accountId, setAccountId] = useState("");
	const [search, setSearch] = useState("");
	const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
		null,
	);

	const accountsQuery = useQuery({
		...whatsappApi.listAccountsOptions(),
		refetchOnWindowFocus: false,
	});
	const accounts = accountsQuery.data?.data ?? [];
	const selectedAccount = accounts.find((account) => account.id === accountId);

	useEffect(() => {
		if (!accountId && accounts[0]) {
			setAccountId(accounts[0].id);
		}
	}, [accountId, accounts]);

	const templatesQuery = useQuery({
		...whatsappApi.listTemplatesOptions({
			accountId,
		}),
		enabled: Boolean(accountId),
		refetchOnWindowFocus: false,
	});
	const templates = templatesQuery.data?.data ?? [];

	const filteredTemplates = useMemo(() => {
		const normalizedSearch = search.trim().toLowerCase();

		if (!normalizedSearch) {
			return templates;
		}

		return templates.filter((template) =>
			[
				template.name,
				template.category,
				template.language,
				template.bodyText ?? "",
				template.headerText ?? "",
			].some((value) => value.toLowerCase().includes(normalizedSearch)),
		);
	}, [search, templates]);

	const selectedTemplate = useMemo(
		() =>
			filteredTemplates.find(
				(template) => template.id === selectedTemplateId,
			) ??
			templates.find((template) => template.id === selectedTemplateId) ??
			null,
		[filteredTemplates, selectedTemplateId, templates],
	);

	useEffect(() => {
		if (
			selectedTemplateId &&
			templates.some((template) => template.id === selectedTemplateId)
		) {
			return;
		}

		setSelectedTemplateId(pickDefaultTemplate(templates)?.id ?? null);
	}, [selectedTemplateId, templates]);

	const syncTemplatesMutation = useMutation({
		...whatsappMutations.syncTemplates(),
		onSuccess: async (result) => {
			await queryClient.invalidateQueries({
				queryKey: orpc.whatsapp.key(),
			});
			toast.success(result.message);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to sync templates");
		},
	});

	const isReadyToSend = selectedTemplate
		? selectedTemplate.status.toLowerCase() === "approved" &&
			selectedTemplate.isSupported
		: false;

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-background">
			<header className="shrink-0 border-b">
				<div className="flex h-16 items-center justify-between gap-4 px-4 lg:px-6">
					<h1 className="text-lg font-semibold text-neutral-900">
						Templates
					</h1>
					{accounts.length > 1 ? (
						<Select value={accountId} onValueChange={setAccountId}>
							<SelectTrigger className="w-[260px]">
								<SelectValue placeholder="Select account" />
							</SelectTrigger>
							<SelectContent>
								{accounts.map((account) => (
									<SelectItem
										key={account.id}
										value={account.id}
									>
										{account.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					) : null}
				</div>
			</header>

			<main className="min-h-0 flex-1 overflow-hidden bg-background">
				<div className="grid h-full min-h-0 gap-0 lg:grid-cols-[360px_minmax(0,1fr)]">
					<aside className="min-h-0 border-r bg-neutral-50/70">
						<div className="space-y-3 border-b bg-white px-4 py-4">
							<div className="relative">
								<SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									value={search}
									onChange={(event) =>
										setSearch(event.target.value)
									}
									placeholder="Search templates"
									className="pl-9"
								/>
							</div>
							<Button
								type="button"
								variant="outline"
								className="w-full"
								onClick={() => {
									if (!accountId) {
										return;
									}
									syncTemplatesMutation.mutate({ accountId });
								}}
								disabled={
									!accountId ||
									syncTemplatesMutation.isPending ||
									selectedAccount?.provider !== "cloud_api"
								}
							>
								<RefreshCwIcon className="mr-1.5 size-4" />
								{syncTemplatesMutation.isPending
									? "Syncing..."
									: "Sync from Meta"}
							</Button>
						</div>

						<ScrollArea className="h-[calc(100vh-14rem)]">
							<div className="space-y-2 p-3">
								{templatesQuery.isLoading ||
								accountsQuery.isLoading ? (
									Array.from({ length: 6 }).map(
										(_, index) => (
											<div
												key={`template-skeleton-${index + 1}`}
												className="rounded-2xl border border-border/70 bg-white p-4"
											>
												<div className="h-4 w-32 animate-pulse rounded bg-neutral-200" />
												<div className="mt-2 h-3 w-24 animate-pulse rounded bg-neutral-200" />
											</div>
										),
									)
								) : filteredTemplates.length === 0 ? (
									<Alert className="border-border/70 bg-background">
										<CircleAlertIcon />
										<AlertTitle>No templates yet</AlertTitle>
										<AlertDescription>
											Run sync after the account has
											approved templates in Meta.
										</AlertDescription>
									</Alert>
								) : (
									filteredTemplates.map((template) => (
										<button
											type="button"
											key={template.id}
											onClick={() =>
												setSelectedTemplateId(
													template.id,
												)
											}
											className={cn(
												"w-full rounded-2xl border p-4 text-left transition",
												selectedTemplateId ===
													template.id
													? "border-emerald-400 bg-emerald-50 shadow-xs"
													: "border-border/70 bg-white hover:border-border",
											)}
										>
											<div className="flex items-start justify-between gap-3">
												<div className="min-w-0">
													<p className="m-0 truncate text-sm font-semibold text-foreground">
														{template.name}
													</p>
													<p className="mt-1 text-xs text-muted-foreground">
														{template.language} •{" "}
														{template.category}
													</p>
												</div>
												<Badge
													variant={getStatusVariant(
														template.status,
													)}
												>
													{template.status.toLowerCase()}
												</Badge>
											</div>
											{template.bodyText ? (
												<p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
													{template.bodyText}
												</p>
											) : null}
										</button>
									))
								)}
							</div>
						</ScrollArea>
					</aside>

					<section className="min-h-0 overflow-hidden bg-white">
						<ScrollArea className="h-full">
							<div className="space-y-5 px-6 py-5">
								{selectedTemplate ? (
									<>
										<div className="flex flex-wrap items-center gap-2">
											<h2 className="m-0 text-lg font-semibold text-foreground">
												{selectedTemplate.name}
											</h2>
											<Badge
												variant={getStatusVariant(
													selectedTemplate.status,
												)}
											>
												{selectedTemplate.status.toLowerCase()}
											</Badge>
											<Badge variant="outline">
												{selectedTemplate.language}
											</Badge>
											<Badge variant="outline">
												{selectedTemplate.category}
											</Badge>
										</div>

										{isReadyToSend ? (
											<Alert className="border-emerald-300/50 bg-emerald-50 text-emerald-950">
												<CheckCircle2Icon />
												<AlertTitle>
													Ready to send
												</AlertTitle>
												<AlertDescription>
													Approved template synced
													from Meta for this account.
												</AlertDescription>
											</Alert>
										) : (
											<Alert className="border-amber-300/50 bg-amber-50 text-amber-950">
												<CircleAlertIcon />
												<AlertTitle>
													Not sendable yet
												</AlertTitle>
												<AlertDescription>
													{selectedTemplate.isSupported
														? `This template is ${selectedTemplate.status.toLowerCase()}. Meta approval required before sending.`
														: (selectedTemplate.unsupportedReason ??
															"This template uses unsupported message parts.")}
												</AlertDescription>
											</Alert>
										)}

										<div className="space-y-3 rounded-3xl border border-border/70 bg-neutral-50/60 p-4">
											{selectedTemplate.headerText ? (
												<div>
													<p className="m-0 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
														Header
													</p>
													<p className="mt-2 text-sm text-foreground">
														{
															selectedTemplate.headerText
														}
													</p>
												</div>
											) : null}
											{selectedTemplate.bodyText ? (
												<div>
													<p className="m-0 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
														Body
													</p>
													<p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
														{
															selectedTemplate.bodyText
														}
													</p>
												</div>
											) : null}
											{selectedTemplate.footerText ? (
												<div>
													<p className="m-0 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
														Footer
													</p>
													<p className="mt-2 text-sm text-muted-foreground">
														{
															selectedTemplate.footerText
														}
													</p>
												</div>
											) : null}
											{selectedTemplate.buttonLabels
												.length > 0 ? (
												<div>
													<p className="m-0 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
														Buttons
													</p>
													<div className="mt-2 flex flex-wrap gap-2">
														{selectedTemplate.buttonLabels.map(
															(label) => (
																<Badge
																	key={label}
																	variant="outline"
																>
																	{label}
																</Badge>
															),
														)}
													</div>
												</div>
											) : null}
										</div>

										<div>
											<p className="m-0 text-sm font-semibold text-foreground">
												Variables
											</p>
											<p className="mt-2 text-sm text-muted-foreground">
												{selectedTemplate.variables
													.length === 0
													? "No variables needed."
													: `${selectedTemplate.variables.length} variable fields required before sending.`}
											</p>
										</div>
									</>
								) : (
									<Alert className="border-border/70 bg-background">
										<CircleAlertIcon />
										<AlertTitle>Select a template</AlertTitle>
										<AlertDescription>
											Pick one from the left rail after
											sync.
										</AlertDescription>
									</Alert>
								)}
							</div>
						</ScrollArea>
					</section>
				</div>
			</main>
		</div>
	);
}
