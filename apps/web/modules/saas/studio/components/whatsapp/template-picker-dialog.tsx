"use client";

import type {
	conversationItemSchema,
	whatsappTemplateSummarySchema,
} from "@repo/api/modules/whatsapp/types";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { cn } from "@repo/ui/lib/utils";
import {
	CheckCircle2Icon,
	CircleAlertIcon,
	RefreshCwIcon,
	SearchIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { z } from "zod";

type ConversationItem = z.infer<typeof conversationItemSchema>;
type WhatsAppTemplate = z.infer<typeof whatsappTemplateSummarySchema>;

function getConversationLabel(conversation: ConversationItem) {
	return (
		conversation.contact.name ||
		conversation.contact.pushName ||
		conversation.contact.phoneNumber
	);
}

function getStatusVariant(status: string) {
	return status.toLowerCase() === "approved" ? "default" : "outline";
}

export function WhatsAppTemplatePickerDialog({
	open,
	onOpenChange,
	conversation,
	templates,
	isLoading,
	isSyncing,
	isSending,
	onSyncTemplates,
	onSendTemplate,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	conversation: ConversationItem | null;
	templates: WhatsAppTemplate[];
	isLoading: boolean;
	isSyncing: boolean;
	isSending: boolean;
	onSyncTemplates: () => void;
	onSendTemplate: (
		template: WhatsAppTemplate,
		variableValues: Record<string, string>,
	) => void;
}) {
	const [search, setSearch] = useState("");
	const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
		null,
	);
	const [variableValues, setVariableValues] = useState<
		Record<string, string>
	>({});

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
		if (!open) {
			setSearch("");
			return;
		}

		if (
			selectedTemplateId &&
			templates.some((template) => template.id === selectedTemplateId)
		) {
			return;
		}

		const preferredTemplate =
			templates.find(
				(template) =>
					template.status.toLowerCase() === "approved" &&
					template.isSupported,
			) ??
			templates.find(
				(template) => template.status.toLowerCase() === "approved",
			) ??
			templates[0] ??
			null;

		setSelectedTemplateId(preferredTemplate?.id ?? null);
	}, [open, selectedTemplateId, templates]);

	useEffect(() => {
		if (!selectedTemplate) {
			setVariableValues({});
			return;
		}

		setVariableValues((current) =>
			Object.fromEntries(
				selectedTemplate.variables.map((variable) => [
					variable.key,
					current[variable.key] ?? "",
				]),
			),
		);
	}, [selectedTemplate]);

	const missingVariables = selectedTemplate
		? selectedTemplate.variables.some(
				(variable) => !variableValues[variable.key]?.trim(),
			)
		: false;

	const sendBlocked =
		!selectedTemplate ||
		selectedTemplate.status.toLowerCase() !== "approved" ||
		!selectedTemplate.isSupported ||
		missingVariables;
	const isReadyToSend = selectedTemplate
		? selectedTemplate.status.toLowerCase() === "approved" &&
			selectedTemplate.isSupported
		: false;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] overflow-hidden p-0 sm:max-w-5xl">
				<div className="grid min-h-[680px] grid-rows-[auto_minmax(0,1fr)_auto]">
					<div className="border-b border-border/70 px-6 py-5">
						<DialogHeader>
							<DialogTitle>Send template</DialogTitle>
							<DialogDescription>
								Pick a synced template for{" "}
								{conversation
									? getConversationLabel(conversation)
									: "this conversation"}
								. Approved templates only.
							</DialogDescription>
						</DialogHeader>
					</div>

					<div className="grid min-h-0 gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
						<div className="border-r border-border/70 bg-neutral-50/70">
							<div className="space-y-3 border-b border-border/70 px-4 py-4">
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
									onClick={onSyncTemplates}
									disabled={isSyncing}
								>
									<RefreshCwIcon className="mr-1.5 size-4" />
									{isSyncing
										? "Syncing..."
										: "Sync from Meta"}
								</Button>
							</div>

							<ScrollArea className="h-full max-h-[470px] lg:max-h-none">
								<div className="space-y-2 p-3">
									{isLoading ? (
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
											<AlertTitle>
												No templates yet
											</AlertTitle>
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
														: "border-border/70 bg-white hover:border-border hover:bg-white",
												)}
											>
												<div className="flex items-start justify-between gap-3">
													<div className="min-w-0">
														<p className="m-0 truncate text-sm font-semibold text-foreground">
															{template.name}
														</p>
														<p className="mt-1 text-xs text-muted-foreground">
															{template.language}{" "}
															•{" "}
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
						</div>

						<div className="min-h-0 bg-white">
							<ScrollArea className="h-full max-h-[560px]">
								<div className="space-y-5 px-6 py-5">
									{selectedTemplate ? (
										<>
											<div className="flex flex-wrap items-center gap-2">
												<h3 className="m-0 text-lg font-semibold text-foreground">
													{selectedTemplate.name}
												</h3>
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
														Fills the same approved
														template Meta already
														knows for this account.
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
																"This template needs capabilities the inbox sender does not support yet.")}
													</AlertDescription>
												</Alert>
											)}

											{selectedTemplate.unsupportedReason ? (
												<Alert
													variant="destructive"
													className="border-destructive/20"
												>
													<CircleAlertIcon />
													<AlertTitle>
														Unsupported template
													</AlertTitle>
													<AlertDescription>
														{
															selectedTemplate.unsupportedReason
														}
													</AlertDescription>
												</Alert>
											) : null}

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
																		key={
																			label
																		}
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
												<div>
													<p className="m-0 text-sm font-semibold text-foreground">
														Variables
													</p>
													<p className="mt-1 text-sm text-muted-foreground">
														Leave blank only when
														the template has no
														placeholders.
													</p>
												</div>

												{selectedTemplate.variables
													.length === 0 ? (
													<p className="m-0 text-sm text-muted-foreground">
														No variables needed.
													</p>
												) : (
													<div className="grid gap-4 md:grid-cols-2">
														{selectedTemplate.variables.map(
															(variable) => (
																<div
																	key={
																		variable.key
																	}
																	className="space-y-2"
																>
																	<Label
																		htmlFor={
																			variable.key
																		}
																	>
																		{
																			variable.label
																		}
																	</Label>
																	<Input
																		id={
																			variable.key
																		}
																		value={
																			variableValues[
																				variable
																					.key
																			] ??
																			""
																		}
																		onChange={(
																			event,
																		) =>
																			setVariableValues(
																				(
																					current,
																				) => ({
																					...current,
																					[variable.key]:
																						event
																							.target
																							.value,
																				}),
																			)
																		}
																		placeholder="Enter value"
																	/>
																</div>
															),
														)}
													</div>
												)}
											</div>
										</>
									) : (
										<Alert className="border-border/70 bg-background">
											<CircleAlertIcon />
											<AlertTitle>
												Select a template
											</AlertTitle>
											<AlertDescription>
												Pick one from the left rail
												after sync.
											</AlertDescription>
										</Alert>
									)}
								</div>
							</ScrollArea>
						</div>
					</div>

					<DialogFooter className="border-t border-border/70 px-6 py-4">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button
							type="button"
							onClick={() => {
								if (!selectedTemplate) {
									return;
								}

								onSendTemplate(
									selectedTemplate,
									variableValues,
								);
							}}
							disabled={isSending || sendBlocked}
						>
							{isSending ? "Sending..." : "Send template"}
						</Button>
					</DialogFooter>
				</div>
			</DialogContent>
		</Dialog>
	);
}
