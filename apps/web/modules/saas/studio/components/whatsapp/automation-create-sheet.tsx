"use client";

import type { automationActionSchema } from "@repo/api/modules/whatsapp/types";
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
import {
	Sheet,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { Textarea } from "@repo/ui/components/textarea";
import { whatsappApi, whatsappMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { z } from "zod";

type AutomationAction = z.infer<typeof automationActionSchema>;
type TriggerType = "keyword" | "first_inbound";

const DEFAULT_ACTION: AutomationAction = {
	type: "send_text",
	text: "Thanks for messaging us. We will get back to you shortly.",
};

export function AutomationCreateSheet({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const [accountId, setAccountId] = useState("");
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [triggerType, setTriggerType] = useState<TriggerType>("keyword");
	const [keywords, setKeywords] = useState("");
	const [actions, setActions] = useState<AutomationAction[]>([
		DEFAULT_ACTION,
	]);

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

	const mutation = useMutation({
		...whatsappMutations.createAutomation(),
		onSuccess: async (result) => {
			await queryClient.invalidateQueries({
				queryKey: orpc.whatsapp.key(),
			});
			toast.success(result.message);
			onOpenChange(false);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to create automation");
		},
	});

	function updateAction(index: number, next: AutomationAction) {
		setActions((current) =>
			current.map((action, actionIndex) =>
				actionIndex === index ? next : action,
			),
		);
	}

	function submit(status: "draft" | "published") {
		const triggerKeywords = keywords
			.split(",")
			.map((keyword) => keyword.trim())
			.filter(Boolean);

		mutation.mutate({
			accountId,
			name: name.trim(),
			...(description.trim() ? { description: description.trim() } : {}),
			status,
			triggerType,
			triggerKeywords: triggerType === "keyword" ? triggerKeywords : [],
			flowData: { actions },
		});
	}

	const canSubmit =
		Boolean(accountId) &&
		name.trim().length > 0 &&
		(triggerType === "first_inbound" || keywords.trim().length > 0) &&
		actions.length > 0 &&
		!mutation.isPending;

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-full overflow-hidden p-0 sm:max-w-2xl">
				<SheetHeader className="border-b px-6 py-5">
					<SheetTitle>New Automation</SheetTitle>
				</SheetHeader>
				<ScrollArea className="min-h-0 flex-1">
					<div className="grid gap-6 p-6">
						<div className="grid gap-3 md:grid-cols-2">
							<div className="grid gap-2">
								<Label>Name</Label>
								<Input
									value={name}
									onChange={(event) =>
										setName(event.target.value)
									}
									placeholder="Lead welcome"
								/>
							</div>
							<div className="grid gap-2">
								<Label>WhatsApp account</Label>
								<Select
									value={accountId}
									onValueChange={setAccountId}
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

						<div className="grid gap-3">
							<Label>Trigger</Label>
							<Select
								value={triggerType}
								onValueChange={(value) =>
									setTriggerType(value as TriggerType)
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="keyword">
										Keyword trigger
									</SelectItem>
									<SelectItem value="first_inbound">
										First inbound message
									</SelectItem>
								</SelectContent>
							</Select>
							{triggerType === "keyword" ? (
								<Input
									value={keywords}
									onChange={(event) =>
										setKeywords(event.target.value)
									}
									placeholder="price, package, availability"
								/>
							) : null}
						</div>

						<div className="grid gap-3">
							<div className="flex items-center justify-between">
								<Label>Actions</Label>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() =>
										setActions((current) => [
											...current,
											DEFAULT_ACTION,
										])
									}
								>
									<PlusIcon className="mr-1.5 size-4" />
									Add action
								</Button>
							</div>
							<div className="space-y-3">
								{actions.map((action, index) => (
									<div
										key={index}
										className="rounded-lg border p-3"
									>
										<div className="mb-3 flex items-center gap-2">
											<Select
												value={action.type}
												onValueChange={(value) => {
													const type =
														value as AutomationAction["type"];
													updateAction(
														index,
														type === "send_text"
															? {
																	type,
																	text: "",
																}
															: type ===
																	"send_template"
																? {
																		type,
																		templateName:
																			"",
																		language:
																			"en_US",
																	}
																: type ===
																		"add_tag"
																	? {
																			type,
																			tag: "",
																		}
																	: type ===
																			"assign_conversation"
																		? {
																				type,
																				userId: "",
																			}
																		: type ===
																				"wait"
																			? {
																					type,
																					durationMinutes: 60,
																				}
																			: {
																					type,
																				},
													);
												}}
											>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="send_text">
														Send message
													</SelectItem>
													<SelectItem value="send_template">
														Send template
													</SelectItem>
													<SelectItem value="add_tag">
														Add tag
													</SelectItem>
													<SelectItem value="assign_conversation">
														Assign conversation
													</SelectItem>
													<SelectItem value="wait">
														Wait
													</SelectItem>
													<SelectItem value="close_conversation">
														Close conversation
													</SelectItem>
												</SelectContent>
											</Select>
											<Button
												type="button"
												variant="ghost"
												size="icon"
												onClick={() =>
													setActions((current) =>
														current.filter(
															(_, actionIndex) =>
																actionIndex !==
																index,
														),
													)
												}
											>
												<Trash2Icon className="size-4" />
											</Button>
										</div>
										<ActionFields
											action={action}
											onChange={(next) =>
												updateAction(index, next)
											}
										/>
									</div>
								))}
							</div>
						</div>
					</div>
				</ScrollArea>
				<SheetFooter className="border-t px-6 py-4 sm:flex-row sm:justify-end">
					<Button
						type="button"
						variant="outline"
						disabled={!canSubmit}
						onClick={() => submit("draft")}
					>
						Save Draft
					</Button>
					<Button
						type="button"
						disabled={!canSubmit}
						onClick={() => submit("published")}
					>
						Publish
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}

function ActionFields({
	action,
	onChange,
}: {
	action: AutomationAction;
	onChange: (action: AutomationAction) => void;
}) {
	if (action.type === "send_text") {
		return (
			<Textarea
				value={action.text}
				onChange={(event) =>
					onChange({ ...action, text: event.target.value })
				}
				placeholder="Message text"
			/>
		);
	}

	if (action.type === "send_template") {
		return (
			<div className="grid gap-2 md:grid-cols-2">
				<Input
					value={action.templateName}
					onChange={(event) =>
						onChange({
							...action,
							templateName: event.target.value,
						})
					}
					placeholder="template_name"
				/>
				<Input
					value={action.language}
					onChange={(event) =>
						onChange({ ...action, language: event.target.value })
					}
					placeholder="en_US"
				/>
			</div>
		);
	}

	if (action.type === "add_tag") {
		return (
			<Input
				value={action.tag}
				onChange={(event) =>
					onChange({ ...action, tag: event.target.value })
				}
				placeholder="qualified-lead"
			/>
		);
	}

	if (action.type === "assign_conversation") {
		return (
			<Input
				value={action.userId}
				onChange={(event) =>
					onChange({ ...action, userId: event.target.value })
				}
				placeholder="User id"
			/>
		);
	}

	if (action.type === "wait") {
		return (
			<Input
				type="number"
				min={1}
				value={action.durationMinutes}
				onChange={(event) =>
					onChange({
						...action,
						durationMinutes: Number(event.target.value),
					})
				}
				placeholder="Minutes"
			/>
		);
	}

	return null;
}
