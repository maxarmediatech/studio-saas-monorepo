"use client";

import type { whatsappTemplateSummarySchema } from "@repo/api/modules/whatsapp/types";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
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
	VariableIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { z } from "zod";

type WhatsAppTemplate = z.infer<typeof whatsappTemplateSummarySchema>;

const ALL_FILTER_VALUE = "all";
const DEFAULT_STATUSES = ["APPROVED", "PENDING", "REJECTED", "PAUSED"];
const DEFAULT_CATEGORIES = ["MARKETING", "UTILITY", "AUTHENTICATION"];

function getStatusVariant(status: string) {
	return status.toLowerCase() === "approved" ? "default" : "outline";
}

function getUniqueValues(
	templates: WhatsAppTemplate[],
	key: "status" | "category" | "language",
	fallback: string[] = [],
) {
	return Array.from(
		new Set([
			...fallback,
			...templates.map((template) => template[key]).filter(Boolean),
		]),
	).sort((left, right) => left.localeCompare(right));
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

function buildListInput({
	accountId,
	status,
	category,
	language,
	search,
}: {
	accountId: string;
	status?: string;
	category?: string;
	language?: string;
	search?: string;
}) {
	return {
		accountId,
		...(status && status !== ALL_FILTER_VALUE ? { status } : {}),
		...(category && category !== ALL_FILTER_VALUE ? { category } : {}),
		...(language && language !== ALL_FILTER_VALUE ? { language } : {}),
		...(search?.trim() ? { search: search.trim() } : {}),
	};
}

function renderPreviewText(
	value: string,
	variables: WhatsAppTemplate["variables"],
) {
	const variableKeys = new Set(
		variables
			.filter((variable) => variable.componentType !== "button")
			.map((variable) => variable.index),
	);

	return value.split(/({{\s*\d+\s*}})/g).map((part, index) => {
		const match = part.match(/{{\s*(\d+)\s*}}/);
		if (!match) {
			return part;
		}

		const variableIndex = Number(match[1]);
		const isKnownVariable = variableKeys.has(variableIndex);

		return (
			<mark
				key={`${part}-${index}`}
				className={cn(
					"rounded px-1 py-0.5 font-medium",
					isKnownVariable
						? "bg-blue-100 text-blue-900"
						: "bg-amber-100 text-amber-900",
				)}
			>
				{part}
			</mark>
		);
	});
}

function formatSyncedAt(value: Date) {
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(value);
}

export function WhatsAppTemplatesPageClient() {
	const queryClient = useQueryClient();
	const [accountId, setAccountId] = useState("");
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState(ALL_FILTER_VALUE);
	const [category, setCategory] = useState(ALL_FILTER_VALUE);
	const [language, setLanguage] = useState(ALL_FILTER_VALUE);
	const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
		null,
	);

	const accountsQuery = useQuery({
		...whatsappApi.listAccountsOptions(),
		refetchOnWindowFocus: false,
	});
	const accounts = accountsQuery.data?.data ?? [];
	const selectedAccount = accounts.find(
		(account) => account.id === accountId,
	);

	useEffect(() => {
		if (!accountId && accounts[0]) {
			setAccountId(accounts[0].id);
		}
	}, [accountId, accounts]);

	const allTemplatesQuery = useQuery({
		...whatsappApi.listTemplatesOptions({ accountId }),
		enabled: Boolean(accountId),
		refetchOnWindowFocus: false,
	});
	const allTemplates = allTemplatesQuery.data?.data ?? [];

	const templatesQuery = useQuery({
		...whatsappApi.listTemplatesOptions(
			buildListInput({ accountId, status, category, language, search }),
		),
		enabled: Boolean(accountId),
		refetchOnWindowFocus: false,
	});
	const templates = templatesQuery.data?.data ?? [];

	const statuses = useMemo(
		() => getUniqueValues(allTemplates, "status", DEFAULT_STATUSES),
		[allTemplates],
	);
	const categories = useMemo(
		() => getUniqueValues(allTemplates, "category", DEFAULT_CATEGORIES),
		[allTemplates],
	);
	const languages = useMemo(
		() => getUniqueValues(allTemplates, "language"),
		[allTemplates],
	);

	const selectedTemplate = useMemo(
		() =>
			templates.find((template) => template.id === selectedTemplateId) ??
			allTemplates.find(
				(template) => template.id === selectedTemplateId,
			) ??
			null,
		[allTemplates, selectedTemplateId, templates],
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
	const hasActiveFilters =
		Boolean(search.trim()) ||
		status !== ALL_FILTER_VALUE ||
		category !== ALL_FILTER_VALUE ||
		language !== ALL_FILTER_VALUE;

	return (
		<div className="flex min-h-[calc(100vh-9rem)] flex-col bg-background">
			<div className="border-b bg-white px-4 py-4 lg:px-6">
				<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
					<div>
						<h2 className="m-0 text-base font-semibold text-foreground">
							Template manager
						</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							Sync approved Meta templates, filter them, and
							inspect variables before using them in broadcasts.
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						{accounts.length > 1 ? (
							<Select
								value={accountId}
								onValueChange={setAccountId}
							>
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
						<Button
							type="button"
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
				</div>
			</div>

			<div className="grid min-h-0 flex-1 lg:grid-cols-[390px_minmax(0,1fr)]">
				<aside className="min-h-0 border-r bg-neutral-50/70">
					<div className="space-y-3 border-b bg-white px-4 py-3">
						<div className="relative">
							<SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								value={search}
								onChange={(event) =>
									setSearch(event.target.value)
								}
								placeholder="Search name or category"
								className="pl-9"
							/>
						</div>

						<div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
							<div className="min-w-0">
								<Select
									value={status}
									onValueChange={setStatus}
								>
									<SelectTrigger className="h-9 w-full text-xs">
										<SelectValue placeholder="Status" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={ALL_FILTER_VALUE}>
											All statuses
										</SelectItem>
										{statuses.map((value) => (
											<SelectItem
												key={value}
												value={value}
											>
												{value.toLowerCase()}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="min-w-0">
								<Select
									value={category}
									onValueChange={setCategory}
								>
									<SelectTrigger className="h-9 w-full text-xs">
										<SelectValue placeholder="Category" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={ALL_FILTER_VALUE}>
											All categories
										</SelectItem>
										{categories.map((value) => (
											<SelectItem
												key={value}
												value={value}
											>
												{value.toLowerCase()}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="min-w-0">
								<Select
									value={language}
									onValueChange={setLanguage}
								>
									<SelectTrigger className="h-9 w-full text-xs">
										<SelectValue placeholder="Language" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={ALL_FILTER_VALUE}>
											All languages
										</SelectItem>
										{languages.map((value) => (
											<SelectItem
												key={value}
												value={value}
											>
												{value}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
						{hasActiveFilters ? (
							<div className="-mt-1">
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-7 justify-start px-0 text-muted-foreground text-xs"
									onClick={() => {
										setSearch("");
										setStatus(ALL_FILTER_VALUE);
										setCategory(ALL_FILTER_VALUE);
										setLanguage(ALL_FILTER_VALUE);
									}}
								>
									Clear filters
								</Button>
							</div>
						) : null}
					</div>

					<ScrollArea className="h-[calc(100vh-17rem)]">
						<div className="space-y-2 p-3">
							{templatesQuery.isLoading ||
							allTemplatesQuery.isLoading ||
							accountsQuery.isLoading ? (
								Array.from({ length: 6 }).map((_, index) => (
									<div
										key={`template-skeleton-${index + 1}`}
										className="rounded-xl border border-border/70 bg-white p-4"
									>
										<div className="h-4 w-32 animate-pulse rounded bg-neutral-200" />
										<div className="mt-2 h-3 w-24 animate-pulse rounded bg-neutral-200" />
									</div>
								))
							) : !accountId ? (
								<Alert className="border-border/70 bg-background">
									<CircleAlertIcon />
									<AlertTitle>
										No account connected
									</AlertTitle>
									<AlertDescription>
										Connect a Cloud API WhatsApp account
										before syncing templates.
									</AlertDescription>
								</Alert>
							) : templates.length === 0 ? (
								<Alert className="border-border/70 bg-background">
									<CircleAlertIcon />
									<AlertTitle>
										{hasActiveFilters
											? "No matching templates"
											: "No templates yet"}
									</AlertTitle>
									<AlertDescription>
										{hasActiveFilters
											? "Clear filters or sync again after changing templates in Meta."
											: "Run sync after this account has templates in Meta."}
									</AlertDescription>
								</Alert>
							) : (
								templates.map((template) => (
									<button
										type="button"
										key={template.id}
										onClick={() =>
											setSelectedTemplateId(template.id)
										}
										className={cn(
											"w-full rounded-xl border p-4 text-left transition",
											selectedTemplateId === template.id
												? "border-neutral-900 bg-white shadow-xs"
												: "border-border/70 bg-white hover:border-neutral-300",
										)}
									>
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<p className="m-0 truncate text-sm font-semibold text-foreground">
													{template.name}
												</p>
												<p className="mt-1 text-xs text-muted-foreground">
													{template.language} •{" "}
													{template.category.toLowerCase()}
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
										<div className="mt-3 flex flex-wrap gap-2">
											{template.variables.length > 0 ? (
												<Badge variant="outline">
													<VariableIcon className="mr-1 size-3" />
													{template.variables.length}{" "}
													variable
													{template.variables
														.length === 1
														? ""
														: "s"}
												</Badge>
											) : null}
											{!template.isSupported ? (
												<Badge variant="destructive">
													Unsupported
												</Badge>
											) : null}
										</div>
									</button>
								))
							)}
						</div>
					</ScrollArea>
				</aside>

				<section className="min-h-0 overflow-hidden bg-white">
					<ScrollArea className="h-full">
						<div className="space-y-5 px-4 py-5 lg:px-6">
							{selectedTemplate ? (
								<>
									<div className="flex flex-col gap-3 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
										<div>
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
											</div>
											<div className="mt-2 flex flex-wrap gap-2">
												<Badge variant="outline">
													{selectedTemplate.language}
												</Badge>
												<Badge variant="outline">
													{selectedTemplate.category.toLowerCase()}
												</Badge>
												<Badge variant="outline">
													Synced{" "}
													{formatSyncedAt(
														selectedTemplate.lastSyncedAt,
													)}
												</Badge>
											</div>
										</div>
									</div>

									{isReadyToSend ? (
										<Alert className="border-emerald-300/50 bg-emerald-50 text-emerald-950">
											<CheckCircle2Icon />
											<AlertTitle>
												Ready to use
											</AlertTitle>
											<AlertDescription>
												This approved template is
												supported by our sender and can
												be used in outbound flows.
											</AlertDescription>
										</Alert>
									) : (
										<Alert className="border-amber-300/50 bg-amber-50 text-amber-950">
											<CircleAlertIcon />
											<AlertTitle>
												Requires attention
											</AlertTitle>
											<AlertDescription>
												{selectedTemplate.isSupported
													? `This template is ${selectedTemplate.status.toLowerCase()}. Meta approval is required before sending.`
													: (selectedTemplate.unsupportedReason ??
														"This template includes message parts our sender does not support yet.")}
											</AlertDescription>
										</Alert>
									)}

									<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
										<div className="space-y-4 rounded-xl border border-border/70 bg-neutral-50/60 p-4">
											<p className="m-0 text-sm font-semibold text-foreground">
												Preview
											</p>
											{selectedTemplate.headerText ? (
												<div>
													<p className="m-0 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
														Header
													</p>
													<p className="mt-2 text-sm text-foreground">
														{renderPreviewText(
															selectedTemplate.headerText,
															selectedTemplate.variables,
														)}
													</p>
												</div>
											) : null}
											{selectedTemplate.bodyText ? (
												<div>
													<p className="m-0 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
														Body
													</p>
													<p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
														{renderPreviewText(
															selectedTemplate.bodyText,
															selectedTemplate.variables,
														)}
													</p>
												</div>
											) : null}
											{selectedTemplate.footerText ? (
												<div>
													<p className="m-0 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
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
													<p className="m-0 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
														Buttons
													</p>
													<div className="mt-2 flex flex-wrap gap-2">
														{selectedTemplate.buttonLabels.map(
															(label, index) => (
																<Badge
																	key={`${label}-${index}`}
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

										<div className="space-y-4">
											<div className="rounded-xl border border-border/70 bg-white p-4">
												<p className="m-0 text-sm font-semibold text-foreground">
													Variables
												</p>
												{selectedTemplate.variables
													.length === 0 ? (
													<p className="mt-2 text-sm text-muted-foreground">
														No variables required.
													</p>
												) : (
													<div className="mt-3 space-y-3">
														{selectedTemplate.variables.map(
															(variable) => (
																<div
																	key={
																		variable.key
																	}
																	className="rounded-lg border bg-neutral-50 p-3"
																>
																	<Label className="text-xs">
																		{
																			variable.label
																		}
																	</Label>
																	<Input
																		readOnly
																		value={`{{${variable.index}}}`}
																		className="mt-2 h-8 bg-white font-mono text-xs"
																	/>
																	<p className="mt-2 text-muted-foreground text-xs">
																		{
																			variable.componentType
																		}
																		{variable.buttonIndex !==
																		null
																			? ` button ${variable.buttonIndex + 1}`
																			: ""}
																	</p>
																</div>
															),
														)}
													</div>
												)}
											</div>

											{!selectedTemplate.isSupported ? (
												<div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
													<p className="m-0 text-sm font-semibold">
														Unsupported parts
													</p>
													<p className="mt-2 text-sm">
														{selectedTemplate.unsupportedReason ??
															"This template includes parts that are not supported yet."}
													</p>
												</div>
											) : null}
										</div>
									</div>
								</>
							) : (
								<Alert className="border-border/70 bg-background">
									<CircleAlertIcon />
									<AlertTitle>Select a template</AlertTitle>
									<AlertDescription>
										Pick one from the list after syncing
										from Meta.
									</AlertDescription>
								</Alert>
							)}
						</div>
					</ScrollArea>
				</section>
			</div>
		</div>
	);
}
