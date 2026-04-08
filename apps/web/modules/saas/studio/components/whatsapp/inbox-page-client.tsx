"use client";

import type { whatsappTemplateSummarySchema } from "@repo/api/modules/whatsapp/types";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { useSession } from "@saas/auth/hooks/use-session";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { PageContent } from "@saas/studio";
import { whatsappApi, whatsappMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CircleAlertIcon,
	InboxIcon,
	RefreshCwIcon,
	SearchIcon,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { z } from "zod";
import { WhatsAppConversationList } from "./conversation-list";
import { WhatsAppMessageThread } from "./message-thread";
import { WhatsAppTemplatePickerDialog } from "./template-picker-dialog";
import { buildTemplateSendComponents } from "./template-send-payload";

const ALL_ACCOUNTS_VALUE = "__all_accounts__";
const ALL_ASSIGNMENTS_VALUE = "__all_assignments__";
const MY_ASSIGNMENTS_VALUE = "__my_assignments__";
const UNASSIGNED_ASSIGNMENTS_VALUE = "__unassigned_assignments__";
type WhatsAppTemplate = z.infer<typeof whatsappTemplateSummarySchema>;

export function WhatsAppInboxPageClient() {
	const queryClient = useQueryClient();
	const { session } = useSession();
	const { activeOrganization } = useActiveOrganization();
	const [accountFilter, setAccountFilter] = useState(ALL_ACCOUNTS_VALUE);
	const [assignmentFilter, setAssignmentFilter] = useState(
		ALL_ASSIGNMENTS_VALUE,
	);
	const [search, setSearch] = useState("");
	const [selectedConversationId, setSelectedConversationId] = useState<
		string | null
	>(null);
	const [composerValue, setComposerValue] = useState("");
	const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
	const deferredSearch = useDeferredValue(search);
	const autoMarkedConversationIdRef = useRef<string | null>(null);

	const accountsQuery = useQuery({
		...whatsappApi.listAccountsOptions(),
		refetchOnWindowFocus: false,
	});

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
			await queryClient.invalidateQueries({
				queryKey: orpc.whatsapp.key(),
			});
			toast.success("Message queued");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to queue message");
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
		<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
			<div className="relative w-full max-w-md">
				<SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					placeholder="Search by name, phone, or WhatsApp ID"
					className="pl-9"
				/>
			</div>
			<div className="flex items-center gap-2">
				<Select value={accountFilter} onValueChange={setAccountFilter}>
					<SelectTrigger className="min-w-52">
						<SelectValue placeholder="All accounts" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ALL_ACCOUNTS_VALUE}>
							All accounts
						</SelectItem>
						{(accountsQuery.data?.data ?? []).map((account) => (
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
					<SelectTrigger className="min-w-44">
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

	return (
		<PageContent
			title="Inbox"
			headerContent={headerContent}
			contentClassName="overflow-hidden pb-0 pt-4 lg:pt-4"
		>
			<div className="space-y-4">
				<Alert className="border-border/70 bg-background">
					<InboxIcon />
					<AlertTitle>Minimal inbox shell</AlertTitle>
					<AlertDescription>
						<p>
							List, thread, mark-read, send text, and inbound
							attachments are live. Template send and assignment
							are live too. Realtime next.
						</p>
					</AlertDescription>
				</Alert>

				{conversationsQuery.isError ? (
					<Alert
						variant="destructive"
						className="border-destructive/20"
					>
						<CircleAlertIcon />
						<AlertTitle>Inbox failed to load</AlertTitle>
						<AlertDescription>
							<p>
								{conversationsQuery.error.message ||
									"Unable to fetch WhatsApp conversations."}
							</p>
						</AlertDescription>
					</Alert>
				) : null}

				<div className="grid min-h-[720px] gap-4 rounded-3xl border border-neutral-200 bg-white p-3 lg:grid-cols-[340px_minmax(0,1fr)]">
					<div className="overflow-hidden rounded-3xl border border-border/70 bg-neutral-50/70">
						<WhatsAppConversationList
							conversations={conversations}
							isLoading={conversationsQuery.isLoading}
							selectedConversationId={selectedConversationId}
							onSelectConversation={setSelectedConversationId}
							resolveAssigneeLabel={resolveAssigneeLabel}
						/>
					</div>

					<div className="overflow-hidden rounded-3xl border border-border/70 bg-white">
						<WhatsAppMessageThread
							conversation={selectedConversation}
							messages={messagesQuery.data?.data ?? []}
							isLoading={messagesQuery.isLoading}
							composerValue={composerValue}
							onComposerChange={setComposerValue}
							onSendMessage={handleSend}
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
							isSending={sendTextMutation.isPending}
							isAssigning={assignConversationMutation.isPending}
							isTemplateActionDisabled={!selectedConversation}
						/>
					</div>
				</div>
			</div>

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
		</PageContent>
	);
}
