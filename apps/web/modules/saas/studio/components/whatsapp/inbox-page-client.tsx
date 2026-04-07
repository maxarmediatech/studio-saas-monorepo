"use client";

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
import { WhatsAppConversationList } from "./conversation-list";
import { WhatsAppMessageThread } from "./message-thread";

const ALL_ACCOUNTS_VALUE = "__all_accounts__";

export function WhatsAppInboxPageClient() {
	const queryClient = useQueryClient();
	const [accountFilter, setAccountFilter] = useState(ALL_ACCOUNTS_VALUE);
	const [search, setSearch] = useState("");
	const [selectedConversationId, setSelectedConversationId] = useState<
		string | null
	>(null);
	const [composerValue, setComposerValue] = useState("");
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
							This first slice covers list, thread, mark-read, and
							send text. Media, templates, assignment, and
							realtime are next.
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
							isSending={sendTextMutation.isPending}
						/>
					</div>
				</div>
			</div>
		</PageContent>
	);
}
