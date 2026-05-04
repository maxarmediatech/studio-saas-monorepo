"use client";

import type {
	conversationItemSchema,
	whatsappTemplateSummarySchema,
} from "@repo/api/modules/whatsapp/types";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
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
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { useSession } from "@saas/auth/hooks/use-session";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { PageContent } from "@saas/studio";
import {
	clientsApi,
	crewsApi,
	whatsappApi,
	whatsappMutations,
} from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CircleAlertIcon,
	MessageSquareIcon,
	PlusIcon,
	RefreshCwIcon,
	SearchIcon,
} from "lucide-react";
import {
	startTransition,
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import type { z } from "zod";
import { WhatsAppConversationList } from "./conversation-list";
import { WhatsAppMediaComposeDialog } from "./media-compose-dialog";
import { WhatsAppMessageThread } from "./message-thread";
import { WhatsAppTemplatePickerDialog } from "./template-picker-dialog";
import { buildTemplateSendComponents } from "./template-send-payload";

const ALL_ACCOUNTS_VALUE = "__all_accounts__";
const ALL_ASSIGNMENTS_VALUE = "__all_assignments__";
const ALL_STATUSES_VALUE = "__all_statuses__";
const MANUAL_RECIPIENT_VALUE = "__manual_recipient__";
const MY_ASSIGNMENTS_VALUE = "__my_assignments__";
const UNASSIGNED_ASSIGNMENTS_VALUE = "__unassigned_assignments__";
type WhatsAppTemplate = z.infer<typeof whatsappTemplateSummarySchema>;
type WhatsAppConversationStatus = z.infer<
	typeof conversationItemSchema
>["status"];

function normalizeWhatsAppRecipient(value: string) {
	return value.replace(/[^\d+]/g, "").replace(/^\+/, "");
}

export function WhatsAppInboxPageClient() {
	const queryClient = useQueryClient();
	const { session } = useSession();
	const { activeOrganization } = useActiveOrganization();
	const [accountFilter, setAccountFilter] = useState(ALL_ACCOUNTS_VALUE);
	const [assignmentFilter, setAssignmentFilter] = useState(
		ALL_ASSIGNMENTS_VALUE,
	);
	const [statusFilter, setStatusFilter] = useState<
		typeof ALL_STATUSES_VALUE | WhatsAppConversationStatus
	>(ALL_STATUSES_VALUE);
	const [search, setSearch] = useState("");
	const [selectedConversationId, setSelectedConversationId] = useState<
		string | null
	>(null);
	const [composerValue, setComposerValue] = useState("");
	const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
	const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
	const [newMessageOpen, setNewMessageOpen] = useState(false);
	const [newMessageAccountId, setNewMessageAccountId] = useState("");
	const [newMessageRecipientValue, setNewMessageRecipientValue] =
		useState("");
	const [newMessagePhone, setNewMessagePhone] = useState("");
	const [newMessageText, setNewMessageText] = useState("");
	const deferredSearch = useDeferredValue(search);
	const autoMarkedConversationIdRef = useRef<string | null>(null);

	useEffect(() => {
		if (!activeOrganization?.id) {
			return;
		}

		const eventSource = new EventSource("/api/whatsapp/events");
		const handleRefresh = () => {
			startTransition(() => {
				void queryClient.invalidateQueries({
					queryKey: orpc.whatsapp.key(),
				});
			});
		};

		eventSource.addEventListener("refresh", handleRefresh);

		return () => {
			eventSource.removeEventListener("refresh", handleRefresh);
			eventSource.close();
		};
	}, [activeOrganization?.id, queryClient]);

	const accountsQuery = useQuery({
		...whatsappApi.listAccountsOptions(),
		refetchOnWindowFocus: false,
	});
	const accounts = accountsQuery.data?.data ?? [];

	const clientsQuery = useQuery({
		...clientsApi.listOptions({
			page: 1,
			limit: 100,
			sortBy: "name",
			sortDirection: "asc",
		}),
		enabled: newMessageOpen,
	});
	const crewsQuery = useQuery({
		...crewsApi.listOptions({
			page: 1,
			limit: 100,
			sortBy: "name",
			sortDirection: "asc",
		}),
		enabled: newMessageOpen,
	});

	const clientRecipients = useMemo(
		() =>
			(clientsQuery.data?.data ?? [])
				.filter((client) => Boolean(client.phoneNumber))
				.map((client) => ({
					value: `client:${client.id}`,
					name: client.name,
					phoneNumber: client.phoneNumber ?? "",
					type: "Client",
				})),
		[clientsQuery.data?.data],
	);
	const crewRecipients = useMemo(
		() =>
			(crewsQuery.data?.data ?? [])
				.filter((crew) => Boolean(crew.phoneNumber))
				.map((crew) => ({
					value: `crew:${crew.id}`,
					name: crew.name,
					phoneNumber: crew.phoneNumber ?? "",
					type: "Crew",
				})),
		[crewsQuery.data?.data],
	);
	const recipientOptions = useMemo(
		() => [...clientRecipients, ...crewRecipients],
		[clientRecipients, crewRecipients],
	);
	const selectedRecipient = recipientOptions.find(
		(recipient) => recipient.value === newMessageRecipientValue,
	);
	const newMessageRecipientPhone =
		selectedRecipient?.phoneNumber ?? newMessagePhone;

	useEffect(() => {
		if (!newMessageAccountId && accounts[0]) {
			setNewMessageAccountId(accounts[0].id);
		}
	}, [accounts, newMessageAccountId]);

	const conversationsQuery = useQuery({
		...whatsappApi.listConversationsOptions({
			limit: 50,
			accountId:
				accountFilter === ALL_ACCOUNTS_VALUE
					? undefined
					: accountFilter,
			assignment:
				assignmentFilter === MY_ASSIGNMENTS_VALUE
					? "mine"
					: assignmentFilter === UNASSIGNED_ASSIGNMENTS_VALUE
						? "unassigned"
						: undefined,
			status:
				statusFilter === ALL_STATUSES_VALUE ? undefined : statusFilter,
			search: deferredSearch.trim() || undefined,
		}),
		refetchOnWindowFocus: false,
	});

	const conversations = conversationsQuery.data?.data ?? [];

	useEffect(() => {
		if (!selectedConversationId && conversations[0]) {
			setSelectedConversationId(conversations[0].id);
			return;
		}

		if (
			selectedConversationId &&
			!conversations.some(
				(conversation) => conversation.id === selectedConversationId,
			)
		) {
			setSelectedConversationId(conversations[0]?.id ?? null);
		}
	}, [conversations, selectedConversationId]);

	const selectedConversation = useMemo(
		() =>
			conversations.find(
				(conversation) => conversation.id === selectedConversationId,
			) ?? null,
		[conversations, selectedConversationId],
	);

	const messagesQuery = useQuery({
		...whatsappApi.listMessagesOptions({
			conversationId: selectedConversationId ?? "",
			limit: 100,
		}),
		enabled: Boolean(selectedConversationId),
		refetchOnWindowFocus: false,
	});

	const templatesQuery = useQuery({
		...whatsappApi.listTemplatesOptions({
			accountId: selectedConversation?.accountId ?? "",
		}),
		enabled: Boolean(selectedConversation && templateDialogOpen),
		refetchOnWindowFocus: false,
	});

	const markReadMutation = useMutation({
		...whatsappMutations.markConversationRead(),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: orpc.whatsapp.key(),
			});
		},
	});

	useEffect(() => {
		if (!selectedConversation) {
			return;
		}

		if (selectedConversation.unreadCount === 0) {
			if (
				autoMarkedConversationIdRef.current === selectedConversation.id
			) {
				autoMarkedConversationIdRef.current = null;
			}
			return;
		}

		if (
			markReadMutation.isPending ||
			autoMarkedConversationIdRef.current === selectedConversation.id
		) {
			return;
		}

		autoMarkedConversationIdRef.current = selectedConversation.id;
		void markReadMutation
			.mutateAsync({
				conversationId: selectedConversation.id,
			})
			.catch(() => {
				autoMarkedConversationIdRef.current = null;
			});
	}, [markReadMutation, selectedConversation]);

	const sendTextMutation = useMutation({
		...whatsappMutations.sendText(),
		onSuccess: async () => {
			setComposerValue("");
			setNewMessageOpen(false);
			setNewMessageRecipientValue("");
			setNewMessagePhone("");
			setNewMessageText("");
			await queryClient.invalidateQueries({
				queryKey: orpc.whatsapp.key(),
			});
			toast.success("Message queued");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to queue message");
		},
	});

	const sendMediaMutation = useMutation({
		...whatsappMutations.sendMedia(),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: orpc.whatsapp.key(),
			});
			toast.success("Media queued");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to queue media");
		},
	});

	const assignConversationMutation = useMutation({
		...whatsappMutations.assignConversation(),
		onSuccess: async (result) => {
			await queryClient.invalidateQueries({
				queryKey: orpc.whatsapp.key(),
			});
			toast.success(result.message);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update assignment");
		},
	});

	const sendTemplateMutation = useMutation({
		...whatsappMutations.sendTemplate(),
		onSuccess: async () => {
			setTemplateDialogOpen(false);
			await queryClient.invalidateQueries({
				queryKey: orpc.whatsapp.key(),
			});
			toast.success("Template queued");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to queue template");
		},
	});

	const updateConversationStatusMutation = useMutation({
		...whatsappMutations.updateConversationStatus(),
		onSuccess: async (result) => {
			await queryClient.invalidateQueries({
				queryKey: orpc.whatsapp.key(),
			});
			toast.success(result.message);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update status");
		},
	});

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

	const handleSend = () => {
		if (!selectedConversation || composerValue.trim().length === 0) {
			return;
		}

		sendTextMutation.mutate({
			accountId: selectedConversation.accountId,
			to: selectedConversation.contact.waId,
			text: composerValue.trim(),
		});
	};

	const handleNewMessageSend = () => {
		const accountId = newMessageAccountId || accounts[0]?.id;
		const to = normalizeWhatsAppRecipient(newMessageRecipientPhone);
		const text = newMessageText.trim();

		if (!accountId || !to || !text) {
			toast.error("Choose an account, recipient, and message");
			return;
		}

		sendTextMutation.mutate({
			accountId,
			to,
			text,
		});
	};

	const handleTemplateSend = (
		template: WhatsAppTemplate,
		variableValues: Record<string, string>,
	) => {
		if (!selectedConversation) {
			return;
		}

		let components: ReturnType<typeof buildTemplateSendComponents>;
		try {
			components = buildTemplateSendComponents(template, variableValues);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Template variables are incomplete",
			);
			return;
		}

		sendTemplateMutation.mutate({
			accountId: selectedConversation.accountId,
			to: selectedConversation.contact.waId,
			templateName: template.name,
			language: template.language,
			components,
		});
	};

	const assigneeOptions = useMemo(
		() =>
			(activeOrganization?.members ?? []).map((member) => ({
				userId: member.userId,
				label: member.user?.name ?? member.user?.email ?? "Member",
			})),
		[activeOrganization?.members],
	);

	const assigneeLabelMap = useMemo(
		() =>
			new Map(
				assigneeOptions.map((option) => [option.userId, option.label]),
			),
		[assigneeOptions],
	);

	const resolveAssigneeLabel = (assignedToUserId: string | null) => {
		if (!assignedToUserId) {
			return null;
		}

		if (assignedToUserId === session?.userId) {
			return "You";
		}

		return assigneeLabelMap.get(assignedToUserId) ?? "Assigned";
	};

	const headerContent = (
		<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
			<div className="relative w-full lg:max-w-sm">
				<SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					placeholder="Search by name, phone, or WhatsApp ID"
					className="pl-9"
				/>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<Select value={accountFilter} onValueChange={setAccountFilter}>
					<SelectTrigger className="h-9 min-w-48">
						<SelectValue placeholder="All accounts" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ALL_ACCOUNTS_VALUE}>
							All accounts
						</SelectItem>
						{accounts.map((account) => (
							<SelectItem key={account.id} value={account.id}>
								{account.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					value={assignmentFilter}
					onValueChange={setAssignmentFilter}
				>
					<SelectTrigger className="h-9 min-w-40">
						<SelectValue placeholder="All assignments" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ALL_ASSIGNMENTS_VALUE}>
							All assignments
						</SelectItem>
						<SelectItem value={MY_ASSIGNMENTS_VALUE}>
							Mine
						</SelectItem>
						<SelectItem value={UNASSIGNED_ASSIGNMENTS_VALUE}>
							Unassigned
						</SelectItem>
					</SelectContent>
				</Select>
				<Select
					value={statusFilter}
					onValueChange={(value) =>
						setStatusFilter(
							value as
								| typeof ALL_STATUSES_VALUE
								| WhatsAppConversationStatus,
						)
					}
				>
					<SelectTrigger className="h-9 min-w-36">
						<SelectValue placeholder="All statuses" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ALL_STATUSES_VALUE}>
							All statuses
						</SelectItem>
						<SelectItem value="open">Open</SelectItem>
						<SelectItem value="closed">Closed</SelectItem>
						<SelectItem value="archived">Archived</SelectItem>
					</SelectContent>
				</Select>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => {
						accountsQuery.refetch();
						conversationsQuery.refetch();
						if (selectedConversationId) {
							messagesQuery.refetch();
						}
					}}
					disabled={
						accountsQuery.isFetching ||
						conversationsQuery.isFetching ||
						messagesQuery.isFetching
					}
				>
					<RefreshCwIcon className="mr-1.5 size-4" />
					Refresh
				</Button>
			</div>
		</div>
	);

	const controls = (
		<Button
			type="button"
			size="sm"
			onClick={() => setNewMessageOpen(true)}
			disabled={accounts.length === 0}
		>
			<PlusIcon className="mr-1.5 size-4" />
			New message
		</Button>
	);

	return (
		<PageContent
			title={
				<span className="inline-flex items-center gap-2">
					<MessageSquareIcon className="size-4 text-neutral-500" />
					Messages
				</span>
			}
			controls={controls}
			headerContent={headerContent}
			contentClassName="overflow-hidden pb-0 pt-3 lg:pt-3"
		>
			<div className="space-y-3">
				{conversationsQuery.isError ? (
					<Alert
						variant="destructive"
						className="border-destructive/20"
					>
						<CircleAlertIcon />
						<AlertTitle>WhatsApp failed to load</AlertTitle>
						<AlertDescription>
							<p>
								{conversationsQuery.error.message ||
									"Unable to fetch WhatsApp conversations."}
							</p>
						</AlertDescription>
					</Alert>
				) : null}

				<div className="grid min-h-[calc(100vh-13rem)] gap-3 rounded-2xl border border-neutral-200 bg-white p-2 lg:grid-cols-[340px_minmax(0,1fr)]">
					<div className="overflow-hidden rounded-xl border border-border/70 bg-neutral-50/70">
						<WhatsAppConversationList
							conversations={conversations}
							isLoading={conversationsQuery.isLoading}
							selectedConversationId={selectedConversationId}
							onSelectConversation={setSelectedConversationId}
							resolveAssigneeLabel={resolveAssigneeLabel}
						/>
					</div>

					<div className="overflow-hidden rounded-xl border border-border/70 bg-white">
						<WhatsAppMessageThread
							conversation={selectedConversation}
							messages={messagesQuery.data?.data ?? []}
							isLoading={messagesQuery.isLoading}
							composerValue={composerValue}
							onComposerChange={setComposerValue}
							onSendMessage={handleSend}
							onOpenMediaDialog={() => setMediaDialogOpen(true)}
							onOpenTemplateDialog={() =>
								setTemplateDialogOpen(true)
							}
							assigneeOptions={assigneeOptions}
							onAssignConversation={(assignedToUserId) => {
								if (!selectedConversation) {
									return;
								}

								assignConversationMutation.mutate({
									conversationId: selectedConversation.id,
									assignedToUserId,
								});
							}}
							onUpdateConversationStatus={(status) => {
								if (!selectedConversation) {
									return;
								}

								updateConversationStatusMutation.mutate({
									conversationId: selectedConversation.id,
									status,
								});
							}}
							isSending={sendTextMutation.isPending}
							isAssigning={assignConversationMutation.isPending}
							isUpdatingStatus={
								updateConversationStatusMutation.isPending
							}
							isTemplateActionDisabled={!selectedConversation}
						/>
					</div>
				</div>
			</div>

			<Dialog open={newMessageOpen} onOpenChange={setNewMessageOpen}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>New message</DialogTitle>
						<DialogDescription>
							Send through the WhatsApp channel for now.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="new-whatsapp-account">
								From account
							</Label>
							<Select
								value={newMessageAccountId}
								onValueChange={setNewMessageAccountId}
							>
								<SelectTrigger id="new-whatsapp-account">
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
						</div>

						<div className="space-y-2">
							<Label htmlFor="new-whatsapp-phone">
								Recipient
							</Label>
							<Select
								value={newMessageRecipientValue}
								onValueChange={(value) => {
									setNewMessageRecipientValue(value);
									if (value !== MANUAL_RECIPIENT_VALUE) {
										setNewMessagePhone("");
									}
								}}
							>
								<SelectTrigger
									id="new-whatsapp-phone"
									className="w-full"
								>
									<SelectValue placeholder="Select a client or crew" />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										<SelectLabel>Clients</SelectLabel>
										{clientRecipients.length > 0 ? (
											clientRecipients.map(
												(recipient) => (
													<SelectItem
														key={recipient.value}
														value={recipient.value}
													>
														{recipient.name} •{" "}
														{recipient.phoneNumber}
													</SelectItem>
												),
											)
										) : (
											<SelectItem
												value="__no_clients__"
												disabled
											>
												No clients with phone numbers
											</SelectItem>
										)}
									</SelectGroup>
									<SelectSeparator />
									<SelectGroup>
										<SelectLabel>Crew</SelectLabel>
										{crewRecipients.length > 0 ? (
											crewRecipients.map((recipient) => (
												<SelectItem
													key={recipient.value}
													value={recipient.value}
												>
													{recipient.name} •{" "}
													{recipient.phoneNumber}
												</SelectItem>
											))
										) : (
											<SelectItem
												value="__no_crew__"
												disabled
											>
												No crew with phone numbers
											</SelectItem>
										)}
									</SelectGroup>
									<SelectSeparator />
									<SelectItem value={MANUAL_RECIPIENT_VALUE}>
										Manual test number
									</SelectItem>
								</SelectContent>
							</Select>
							{newMessageRecipientValue ===
							MANUAL_RECIPIENT_VALUE ? (
								<Input
									value={newMessagePhone}
									onChange={(event) =>
										setNewMessagePhone(event.target.value)
									}
									placeholder="919876543210"
									inputMode="tel"
								/>
							) : null}
							<p className="m-0 text-xs text-muted-foreground">
								{clientsQuery.isLoading || crewsQuery.isLoading
									? "Loading clients and crew..."
									: "Choose a saved client or crew with country code in their phone number."}
							</p>
							{selectedRecipient ? (
								<p className="m-0 text-xs text-muted-foreground">
									Sending to {selectedRecipient.type}:{" "}
									{selectedRecipient.phoneNumber}
								</p>
							) : null}
						</div>

						<div className="space-y-2">
							<Label htmlFor="new-whatsapp-message">
								Message
							</Label>
							<Textarea
								id="new-whatsapp-message"
								value={newMessageText}
								onChange={(event) =>
									setNewMessageText(event.target.value)
								}
								placeholder="Type the first message..."
								className="min-h-28 resize-none"
							/>
							<p className="m-0 text-xs text-muted-foreground">
								For cold starts, use an approved template from
								an existing thread until template-first compose
								is added.
							</p>
						</div>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setNewMessageOpen(false)}
						>
							Cancel
						</Button>
						<Button
							type="button"
							onClick={handleNewMessageSend}
							disabled={
								sendTextMutation.isPending ||
								!newMessageAccountId ||
								!newMessageRecipientPhone.trim() ||
								!newMessageText.trim()
							}
						>
							{sendTextMutation.isPending
								? "Sending..."
								: "Send message"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<WhatsAppTemplatePickerDialog
				open={templateDialogOpen}
				onOpenChange={setTemplateDialogOpen}
				conversation={selectedConversation}
				templates={templatesQuery.data?.data ?? []}
				isLoading={templatesQuery.isLoading}
				isSyncing={syncTemplatesMutation.isPending}
				isSending={sendTemplateMutation.isPending}
				onSyncTemplates={() => {
					if (!selectedConversation) {
						return;
					}

					syncTemplatesMutation.mutate({
						accountId: selectedConversation.accountId,
					});
				}}
				onSendTemplate={handleTemplateSend}
			/>

			<WhatsAppMediaComposeDialog
				open={mediaDialogOpen}
				onOpenChange={setMediaDialogOpen}
				conversation={selectedConversation}
				isSending={sendMediaMutation.isPending}
				onSendMedia={async (payload) => {
					if (!selectedConversation) {
						return;
					}

					await sendMediaMutation.mutateAsync({
						accountId: selectedConversation.accountId,
						to: selectedConversation.contact.waId,
						mediaType: payload.mediaType,
						mediaKey: payload.mediaKey,
						mimeType: payload.mimeType,
						fileName: payload.fileName,
						caption: payload.caption,
					});
				}}
			/>
		</PageContent>
	);
}
