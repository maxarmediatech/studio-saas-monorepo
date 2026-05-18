"use client";

import type { whatsappTemplateSummarySchema } from "@repo/api/modules/whatsapp/types";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
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
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { Textarea } from "@repo/ui/components/textarea";
import { cn } from "@repo/ui/lib/utils";
import { whatsappApi, whatsappMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClockIcon, SaveIcon, SendIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { z } from "zod";

type Template = z.infer<typeof whatsappTemplateSummarySchema>;
type LinkType = "all" | "linked" | "unlinked" | "client" | "crew";
type SubmitAction = "draft" | "send" | "schedule";

const ALL_TAGS = "__all_tags__";

function renderBody(template: Template | null, values: Record<string, string>) {
	if (!template?.bodyText) {
		return "No body preview available.";
	}

	return template.bodyText.replace(/\{\{(\d+)\}\}/g, (_, index: string) => {
		const value = values[`body:${index}`]?.trim();
		return value ? value : `{{${index}}}`;
	});
}

function pickTemplate(templates: Template[]) {
	return (
		templates.find(
			(template) =>
				template.status.toLowerCase() === "approved" &&
				template.isSupported,
		) ?? null
	);
}

function toLocalDateTime(value: Date) {
	const offset = value.getTimezoneOffset();
	const local = new Date(value.getTime() - offset * 60_000);
	return local.toISOString().slice(0, 16);
}

export function BroadcastWizardSheet({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [accountId, setAccountId] = useState("");
	const [templateKey, setTemplateKey] = useState("");
	const [tag, setTag] = useState(ALL_TAGS);
	const [linkType, setLinkType] = useState<LinkType>("all");
	const [excludeOptedOut, setExcludeOptedOut] = useState(true);
	const [excludeBlocked, setExcludeBlocked] = useState(true);
	const [scheduledAt, setScheduledAt] = useState(() =>
		toLocalDateTime(new Date(Date.now() + 60 * 60_000)),
	);
	const [variableValues, setVariableValues] = useState<
		Record<string, string>
	>({});

	const accountsQuery = useQuery({
		...whatsappApi.listAccountsOptions(),
		refetchOnWindowFocus: false,
	});
	const accounts = accountsQuery.data?.data ?? [];

	useEffect(() => {
		if (!accountId && accounts[0]) {
			setAccountId(accounts[0].id);
		}
	}, [accountId, accounts]);

	const templatesQuery = useQuery({
		...whatsappApi.listTemplatesOptions({
			accountId,
			status: "APPROVED",
		}),
		enabled: Boolean(accountId),
		refetchOnWindowFocus: false,
	});
	const approvedTemplates = useMemo(
		() =>
			(templatesQuery.data?.data ?? []).filter(
				(template) =>
					template.status.toLowerCase() === "approved" &&
					template.isSupported,
			),
		[templatesQuery.data?.data],
	);

	useEffect(() => {
		const selectedStillExists = approvedTemplates.some(
			(template) =>
				`${template.name}:${template.language}` === templateKey,
		);
		if (!selectedStillExists) {
			const nextTemplate = pickTemplate(approvedTemplates);
			setTemplateKey(
				nextTemplate
					? `${nextTemplate.name}:${nextTemplate.language}`
					: "",
			);
			setVariableValues({});
		}
	}, [approvedTemplates, templateKey]);

	const selectedTemplate = approvedTemplates.find(
		(template) => `${template.name}:${template.language}` === templateKey,
	);

	const tagsQuery = useQuery({
		...whatsappApi.listContactTagsOptions(),
		refetchOnWindowFocus: false,
	});

	const contactsQuery = useQuery({
		...whatsappApi.listContactsOptions({
			accountId,
			limit: 100,
			...(tag !== ALL_TAGS ? { tag } : {}),
			...(linkType !== "all" ? { linkType } : {}),
			...(excludeOptedOut ? { optedOut: false } : {}),
			...(excludeBlocked ? { blocked: false } : {}),
		}),
		enabled: Boolean(accountId),
		refetchOnWindowFocus: false,
	});
	const previewContacts = contactsQuery.data?.data ?? [];

	const mutation = useMutation({
		...whatsappMutations.createCampaign(),
		onSuccess: async (result) => {
			await queryClient.invalidateQueries({
				queryKey: orpc.whatsapp.key(),
			});
			toast.success(result.message);
			onOpenChange(false);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to create broadcast");
		},
	});

	const canSubmit =
		Boolean(accountId) &&
		Boolean(selectedTemplate) &&
		name.trim().length > 0 &&
		!mutation.isPending;

	function submit(action: SubmitAction) {
		if (!selectedTemplate) {
			toast.error("Choose an approved template");
			return;
		}

		mutation.mutate({
			accountId,
			name: name.trim(),
			...(description.trim() ? { description: description.trim() } : {}),
			templateName: selectedTemplate.name,
			language: selectedTemplate.language,
			variableValues,
			audienceFilter: {
				...(tag !== ALL_TAGS ? { tag } : {}),
				linkType,
				excludeOptedOut,
				excludeBlocked,
			},
			action,
			...(action === "schedule"
				? { scheduledAt: new Date(scheduledAt) }
				: {}),
		});
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-full overflow-hidden p-0 sm:max-w-3xl">
				<SheetHeader className="border-b px-6 py-5">
					<SheetTitle>New Broadcast</SheetTitle>
					<SheetDescription>
						Template, audience, variables, then draft, schedule, or
						send.
					</SheetDescription>
				</SheetHeader>
				<ScrollArea className="min-h-0 flex-1">
					<div className="grid gap-6 p-6">
						<section className="grid gap-3">
							<h3 className="font-medium text-sm">Broadcast</h3>
							<div className="grid gap-3 md:grid-cols-2">
								<div className="grid gap-2">
									<Label htmlFor="broadcast-name">Name</Label>
									<Input
										id="broadcast-name"
										value={name}
										onChange={(event) =>
											setName(event.target.value)
										}
										placeholder="May offer follow-up"
									/>
								</div>
								<div className="grid gap-2">
									<Label>WhatsApp account</Label>
									<Select
										value={accountId}
										onValueChange={(value) => {
											setAccountId(value);
											setTemplateKey("");
										}}
									>
										<SelectTrigger>
											<SelectValue placeholder="Choose account" />
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
								</div>
							</div>
							<Textarea
								value={description}
								onChange={(event) =>
									setDescription(event.target.value)
								}
								placeholder="Internal note"
							/>
						</section>

						<section className="grid gap-3">
							<h3 className="font-medium text-sm">
								Approved template
							</h3>
							<Select
								value={templateKey}
								onValueChange={setTemplateKey}
								disabled={
									!accountId || templatesQuery.isLoading
								}
							>
								<SelectTrigger>
									<SelectValue placeholder="Choose approved template" />
								</SelectTrigger>
								<SelectContent>
									{approvedTemplates.map((template) => (
										<SelectItem
											key={`${template.name}:${template.language}`}
											value={`${template.name}:${template.language}`}
										>
											{template.name} ·{" "}
											{template.language}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<div className="rounded-md border bg-muted/20 p-4">
								<div className="mb-3 flex items-center gap-2">
									<Badge variant="outline">
										{selectedTemplate?.category ??
											"Template"}
									</Badge>
									<Badge variant="outline">
										{selectedTemplate?.language ??
											"Language"}
									</Badge>
								</div>
								<p className="whitespace-pre-wrap text-sm leading-6">
									{renderBody(
										selectedTemplate ?? null,
										variableValues,
									)}
								</p>
							</div>
						</section>

						<section className="grid gap-3">
							<h3 className="font-medium text-sm">Audience</h3>
							<div className="grid gap-3 md:grid-cols-2">
								<Select value={tag} onValueChange={setTag}>
									<SelectTrigger>
										<SelectValue placeholder="All tags" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={ALL_TAGS}>
											All tags
										</SelectItem>
										{(tagsQuery.data?.data ?? []).map(
											(item) => (
												<SelectItem
													key={item.name}
													value={item.name}
												>
													{item.name} (
													{item.contactCount})
												</SelectItem>
											),
										)}
									</SelectContent>
								</Select>
								<Select
									value={linkType}
									onValueChange={(value) =>
										setLinkType(value as LinkType)
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="CRM link" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">
											All links
										</SelectItem>
										<SelectItem value="linked">
											Linked
										</SelectItem>
										<SelectItem value="unlinked">
											Unlinked
										</SelectItem>
										<SelectItem value="client">
											Clients
										</SelectItem>
										<SelectItem value="crew">
											Crew
										</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="flex flex-wrap gap-4">
								<Label
									htmlFor="exclude-opt-outs"
									className="flex items-center gap-2 text-sm"
								>
									<Checkbox
										id="exclude-opt-outs"
										checked={excludeOptedOut}
										onCheckedChange={(checked) =>
											setExcludeOptedOut(checked === true)
										}
									/>
									Exclude opt-outs
								</Label>
								<Label
									htmlFor="exclude-blocked"
									className="flex items-center gap-2 text-sm"
								>
									<Checkbox
										id="exclude-blocked"
										checked={excludeBlocked}
										onCheckedChange={(checked) =>
											setExcludeBlocked(checked === true)
										}
									/>
									Exclude blocked
								</Label>
							</div>
							<div className="rounded-md border p-3 text-sm">
								<span className="font-medium">
									{previewContacts.length}
								</span>{" "}
								contacts previewed
								{contactsQuery.data?.nextCursor
									? " (100+)"
									: ""}
							</div>
						</section>

						<section className="grid gap-3">
							<h3 className="font-medium text-sm">Variables</h3>
							<div
								className={cn(
									"grid gap-3",
									selectedTemplate?.variables.length
										? "md:grid-cols-2"
										: "",
								)}
							>
								{selectedTemplate?.variables.length ? (
									selectedTemplate.variables.map(
										(variable) => (
											<div
												key={variable.key}
												className="grid gap-2"
											>
												<Label htmlFor={variable.key}>
													{variable.label}
												</Label>
												<Input
													id={variable.key}
													value={
														variableValues[
															variable.key
														] ?? ""
													}
													onChange={(event) =>
														setVariableValues(
															(current) => ({
																...current,
																[variable.key]:
																	event.target
																		.value,
															}),
														)
													}
													placeholder={`Value for {{${variable.index}}}`}
												/>
											</div>
										),
									)
								) : (
									<p className="text-muted-foreground text-sm">
										This template has no variables to map.
									</p>
								)}
							</div>
						</section>

						<section className="grid gap-2">
							<Label htmlFor="schedule-at">Schedule time</Label>
							<Input
								id="schedule-at"
								type="datetime-local"
								value={scheduledAt}
								onChange={(event) =>
									setScheduledAt(event.target.value)
								}
							/>
						</section>
					</div>
				</ScrollArea>
				<SheetFooter className="border-t px-6 py-4 sm:flex-row sm:justify-end">
					<Button
						type="button"
						variant="outline"
						disabled={!canSubmit}
						onClick={() => submit("draft")}
					>
						<SaveIcon className="mr-1.5 size-4" />
						Save Draft
					</Button>
					<Button
						type="button"
						variant="outline"
						disabled={!canSubmit}
						onClick={() => submit("schedule")}
					>
						<CalendarClockIcon className="mr-1.5 size-4" />
						Schedule
					</Button>
					<Button
						type="button"
						disabled={!canSubmit}
						onClick={() => submit("send")}
					>
						<SendIcon className="mr-1.5 size-4" />
						Send Now
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
