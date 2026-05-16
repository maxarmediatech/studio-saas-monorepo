"use client";

import type { whatsappTemplateSummarySchema } from "@repo/api/modules/whatsapp/types";
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
import { Switch } from "@repo/ui/components/switch";
import { Textarea } from "@repo/ui/components/textarea";
import { useSession } from "@saas/auth/hooks/use-session";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
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
import { TestWhatsAppSetupPanel } from "./test-whatsapp-setup-panel";

const MANUAL_RECIPIENT_VALUE = "__manual_recipient__";
const TEST_ENV_HOSTS = new Set(["dev.stuwiz.com", "localhost", "127.0.0.1"]);
type WhatsAppTemplate = z.infer<typeof whatsappTemplateSummarySchema>;

function normalizeWhatsAppRecipient(value: string) {
	return value.replace(/[^\d+]/g, "").replace(/^\+/, "");
}

export function WhatsAppInboxPageClient() {
	const queryClient = useQueryClient();
	const { session } = useSession();
	const { activeOrganization } = useActiveOrganization();
	const [search, setSearch] = useState("");
	const [showUnreadOnly, setShowUnreadOnly] = useState(false);
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
	const [retryingMessageId, setRetryingMessageId] = useState<string | null>(
		null,
	);
	const [browserOrigin, setBrowserOrigin] = useState("");
	const deferredSearch = useDeferredValue(search);
	const autoMarkedConversationIdRef = useRef<string | null>(null);

	useEffect(() => {
		setBrowserOrigin(window.location.origin);
	}, []);

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
	const isTestEnvironment =
		browserOrigin.length > 0 &&
		TEST_ENV_HOSTS.has(new URL(browserOrigin).hostname);
	const shouldShowTestSetup =
		isTestEnvironment && !accountsQuery.isLoading && accounts.length === 0;

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
			search: deferredSearch.trim() || undefined,
		}),
		refetchOnWindowFocus: false,
	});

	const conversations = conversationsQuery.data?.data ?? [];
	const visibleConversations = useMemo(
		() =>
			showUnreadOnly
				? conversations.filter(
						(conversation) => conversation.unreadCount > 0,
					)
				: conversations,
		[conversations, showUnreadOnly],
	);
	const unreadCount = useMemo(
		() =>
			conversations.reduce(
				(total, conversation) => total + conversation.unreadCount,
				0,
			),
		[conversations],
	);

	useEffect(() => {
		if (!selectedConversationId && visibleConversations[0]) {
			setSelectedConversationId(visibleConversations[0].id);
			return;
		}

		if (
			selectedConversationId &&
			!visibleConversations.some(
				(conversation) => conversation.id === selectedConversationId,
			)
		) {
			setSelectedConversationId(visibleConversations[0]?.id ?? null);
		}
	}, [visibleConversations, selectedConversationId]);

	const selectedConversation = useMemo(
		() =>
			visibleConversations.find(
				(conversation) => conversation.id === selectedConversationId,
			) ?? null,
		[visibleConversations, selectedConversationId],
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
		onError: async (error) => {
			await queryClient.invalidateQueries({
				queryKey: orpc.whatsapp.key(),
			});
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
		onError: async (error) => {
			await queryClient.invalidateQueries({
				queryKey: orpc.whatsapp.key(),
			});
			toast.error(error.message || "Failed to queue media");
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
		onError: async (error) => {
			await queryClient.invalidateQueries({
				queryKey: orpc.whatsapp.key(),
			});
			toast.error(error.message || "Failed to queue template");
		},
	});

	const retryMessageMutation = useMutation({
		...whatsappMutations.retryMessage(),
		onSuccess: async (result) => {
			await queryClient.invalidateQueries({
				queryKey: orpc.whatsapp.key(),
			});
			toast.success(result.message);
		},
		onError: async (error) => {
			await queryClient.invalidateQueries({
				queryKey: orpc.whatsapp.key(),
			});
			toast.error(error.message || "Failed to retry message");
		},
		onSettled: () => {
			setRetryingMessageId(null);
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
			contactName: selectedRecipient?.name,
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

	const handleRetryMessage = (messageId: string) => {
		if (retryMessageMutation.isPending) {
			return;
		}

		setRetryingMessageId(messageId);
		retryMessageMutation.mutate({ messageId });
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

	const controls = (
		<Button
			type="button"
			size="sm"
			onClick={() => setNewMessageOpen(true)}
			disabled={accounts.length === 0 || shouldShowTestSetup}
		>
			<PlusIcon className="mr-1.5 size-4" />
			New message
		</Button>
	);

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-background">
			<header className="shrink-0 border-b">
				<div className="flex h-16 items-center justify-between gap-4 px-4 lg:px-6">
					<h1 className="inline-flex min-w-0 items-center gap-2 truncate text-lg font-semibold text-neutral-900">
						<MessageSquareIcon className="size-4 shrink-0 text-neutral-500" />
						Messages
					</h1>
					{controls}
				</div>
			</header>

			<main className="min-h-0 flex-1 overflow-hidden  bg-background">
				{shouldShowTestSetup ? (
					<TestWhatsAppSetupPanel
						origin={browserOrigin}
						onConnected={async () => {
							await accountsQuery.refetch();
							await conversationsQuery.refetch();
						}}
					/>
				) : null}

				{conversationsQuery.isError ? (
					<Alert
						variant="destructive"
						className="m-4 border-destructive/20 lg:m-6"
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

				<div
					className={
						shouldShowTestSetup
							? "hidden"
							: "grid h-full min-h-0 grid-cols-1 overflow-hidden bg-background md:grid-cols-[360px_minmax(0,1fr)]"
					}
				>
					<aside className="flex min-w-0 flex-col overflow-hidden border-r bg-neutral-50/80">
						<div className="flex shrink-0 flex-col gap-3.5 border-b bg-white p-4">
							<div className="flex w-full items-center justify-between">
								<div className="text-sm font-medium text-foreground">
									Inbox
								</div>
								<div className="flex items-center gap-2 text-sm">
									<span className="text-xs text-muted-foreground">
										Unread only
									</span>
									<Switch
										checked={showUnreadOnly}
										onCheckedChange={setShowUnreadOnly}
										className="shadow-none"
										aria-label="Show unread conversations only"
									/>
								</div>
							</div>
							<div className="relative">
								<SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									value={search}
									onChange={(event) =>
										setSearch(event.target.value)
									}
									placeholder="Type to search..."
									className="pl-9"
								/>
							</div>
							{unreadCount > 0 ? (
								<p className="m-0 text-xs text-muted-foreground">
									{unreadCount} unread across this view
								</p>
							) : null}
						</div>
						<WhatsAppConversationList
							conversations={visibleConversations}
							isLoading={conversationsQuery.isLoading}
							selectedConversationId={selectedConversationId}
							onSelectConversation={setSelectedConversationId}
							resolveAssigneeLabel={resolveAssigneeLabel}
						/>
					</aside>

					<div className="hidden min-w-0 overflow-hidden bg-white md:block">
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
							onRetryMessage={handleRetryMessage}
							isSending={sendTextMutation.isPending}
							isTemplateActionDisabled={!selectedConversation}
							retryingMessageId={retryingMessageId}
						/>
					</div>
				</div>
			</main>

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
		</div>
	);
}
