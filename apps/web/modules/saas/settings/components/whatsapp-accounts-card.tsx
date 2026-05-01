"use client";

import type { whatsappAccountSummarySchema } from "@repo/api/modules/whatsapp/types";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { whatsappApi, whatsappMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CheckCircle2Icon,
	CircleAlertIcon,
	MessageCircleIcon,
	PlugZapIcon,
	RefreshCwIcon,
	Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { useWhatsAppEmbeddedSignup } from "./use-whatsapp-embedded-signup";

type WhatsAppAccount = z.infer<typeof whatsappAccountSummarySchema>;
const DEFAULT_CLOUD_API_VERSION = "v22.0";

const formatDateTime = (value: Date | null) => {
	if (!value) {
		return null;
	}

	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
};

const getStatusBadgeVariant = (status: WhatsAppAccount["connectionStatus"]) => {
	switch (status) {
		case "connected":
			return "default" as const;
		case "banned":
			return "destructive" as const;
		default:
			return "outline" as const;
	}
};

const getStatusLabel = (status: WhatsAppAccount["connectionStatus"]) =>
	status.replace("_", " ");

function WhatsAppAccountRow({
	account,
	onTest,
	onSubscribe,
	onDisconnect,
	isTesting,
	isSubscribing,
	isDisconnecting,
}: {
	account: WhatsAppAccount;
	onTest: (accountId: string) => void;
	onSubscribe: (accountId: string) => void;
	onDisconnect: (accountId: string) => void;
	isTesting: boolean;
	isSubscribing: boolean;
	isDisconnecting: boolean;
}) {
	const lastValidatedAt = formatDateTime(account.lastValidatedAt);
	const lastEventAt = formatDateTime(account.lastEventAt);
	const missingWabaId = !account.wabaId;

	return (
		<div className="rounded-2xl border border-border/70 bg-card p-4">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div className="space-y-3">
					<div className="flex flex-wrap items-center gap-2">
						<p className="m-0 text-sm font-semibold text-foreground">
							{account.name}
						</p>
						<Badge
							variant={getStatusBadgeVariant(
								account.connectionStatus,
							)}
						>
							{getStatusLabel(account.connectionStatus)}
						</Badge>
						<Badge variant="outline">{account.provider}</Badge>
						{account.verifiedName ? (
							<Badge variant="outline">
								{account.verifiedName}
							</Badge>
						) : null}
					</div>

					<div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
						<div>
							<span className="font-medium text-foreground">
								Display number:
							</span>{" "}
							{account.displayPhoneNumber ??
								account.phoneNumber ??
								"Not returned yet"}
						</div>
						<div>
							<span className="font-medium text-foreground">
								Phone number ID:
							</span>{" "}
							{account.phoneNumberId ?? "Missing"}
						</div>
						<div>
							<span className="font-medium text-foreground">
								WABA:
							</span>{" "}
							{account.wabaId ?? "Missing"}
						</div>
						<div>
							<span className="font-medium text-foreground">
								Graph version:
							</span>{" "}
							{account.apiVersion ?? DEFAULT_CLOUD_API_VERSION}
						</div>
						<div>
							<span className="font-medium text-foreground">
								Last validated:
							</span>{" "}
							{lastValidatedAt ?? "Never"}
						</div>
						<div>
							<span className="font-medium text-foreground">
								Last event:
							</span>{" "}
							{lastEventAt ?? "No webhook activity yet"}
						</div>
						<div>
							<span className="font-medium text-foreground">
								App secret:
							</span>{" "}
							{account.hasAppSecret ? "Configured" : "Missing"}
						</div>
						<div>
							<span className="font-medium text-foreground">
								Quality:
							</span>{" "}
							{account.qualityRating ?? "Unknown"}
						</div>
					</div>

					{missingWabaId ? (
						<Alert className="border-amber-300/50 bg-amber-50 text-amber-950">
							<CircleAlertIcon />
							<AlertTitle>WABA ID missing</AlertTitle>
							<AlertDescription>
								<p>
									Subscribe stays blocked until this account
									has a valid WABA ID. Use Edit to fix it.
								</p>
							</AlertDescription>
						</Alert>
					) : null}

					{account.lastErrorMessage ? (
						<Alert
							variant="destructive"
							className="border-destructive/20"
						>
							<CircleAlertIcon />
							<AlertTitle>Last account error</AlertTitle>
							<AlertDescription>
								<p>{account.lastErrorMessage}</p>
							</AlertDescription>
						</Alert>
					) : null}
				</div>

				<div className="flex flex-wrap gap-2 lg:justify-end">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => onTest(account.id)}
						disabled={isTesting || isSubscribing || isDisconnecting}
					>
						<RefreshCwIcon className="mr-1.5 size-4" />
						{isTesting ? "Testing..." : "Test"}
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => onSubscribe(account.id)}
						disabled={
							isTesting ||
							isSubscribing ||
							isDisconnecting ||
							missingWabaId
						}
					>
						<PlugZapIcon className="mr-1.5 size-4" />
						{isSubscribing ? "Subscribing..." : "Subscribe"}
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => onDisconnect(account.id)}
						disabled={isTesting || isSubscribing || isDisconnecting}
					>
						<Trash2Icon className="mr-1.5 size-4" />
						{isDisconnecting ? "Disconnecting..." : "Disconnect"}
					</Button>
				</div>
			</div>
		</div>
	);
}

export function WhatsAppAccountsCard() {
	const queryClient = useQueryClient();

	const accountsQuery = useQuery({
		...whatsappApi.listAccountsOptions(),
		refetchOnWindowFocus: false,
	});

	const embeddedSignupMutation = useMutation(
		whatsappMutations.completeEmbeddedSignup(),
	);

	const testMutation = useMutation({
		...whatsappMutations.testAccount(),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: orpc.whatsapp.key(),
			});
			toast.success("WhatsApp account validated");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to validate WhatsApp account");
		},
	});

	const subscribeMutation = useMutation({
		...whatsappMutations.subscribeAccount(),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: orpc.whatsapp.key(),
			});
			toast.success("Webhook subscription requested");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to subscribe account");
		},
	});

	const deleteMutation = useMutation({
		...whatsappMutations.deleteAccount(),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: orpc.whatsapp.key(),
			});
			toast.success("WhatsApp account disconnected");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to disconnect account");
		},
	});

	const accounts = accountsQuery.data?.data ?? [];

	const invalidateWhatsAppQueries = async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.whatsapp.key(),
		});
	};

	const embeddedSignup = useWhatsAppEmbeddedSignup({
		onComplete: async (input) => {
			try {
				const result = await embeddedSignupMutation.mutateAsync(input);
				await invalidateWhatsAppQueries();
				toast.success(result.message);
			} catch (error) {
				toast.error(
					error instanceof Error
						? error.message
						: "Failed to connect WhatsApp account",
				);
				throw error;
			}
		},
	});

	return (
		<SettingsItem
			title={
				<span className="inline-flex items-center gap-2">
					<MessageCircleIcon className="size-4 text-primary/60" />
					WhatsApp Accounts
				</span>
			}
			description="Each studio gets its own WhatsApp line. Connect the Cloud API account here, validate it, then subscribe webhooks before the inbox goes live."
		>
			<div className="space-y-4 rounded-2xl border border-border bg-card p-5">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div className="space-y-1">
						<p className="m-0 text-sm font-medium text-foreground">
							Studio-owned WhatsApp infrastructure
						</p>
						<p className="m-0 text-sm text-muted-foreground">
							Use one unique business number per studio. We route
							by phone number ID, not by a shared platform inbox.
						</p>
					</div>
					<div className="flex flex-wrap gap-2 sm:justify-end">
						<button
							type="button"
							onClick={embeddedSignup.launch}
							disabled={embeddedSignupMutation.isPending}
							style={{
								backgroundColor: "#1877f2",
								border: 0,
								borderRadius: 4,
								color: "#fff",
								cursor: embeddedSignupMutation.isPending
									? "not-allowed"
									: "pointer",
								fontFamily: "Helvetica, Arial, sans-serif",
								fontSize: 16,
								fontWeight: "bold",
								height: 40,
								opacity: embeddedSignupMutation.isPending
									? 0.7
									: 1,
								padding: "0 24px",
							}}
						>
							Login with Facebook
						</button>
					</div>
				</div>

				<Alert className="border-border/70 bg-background">
					<CheckCircle2Icon />
					<AlertTitle>WhatsApp Embedded Signup</AlertTitle>
					<AlertDescription>
						<p>
							Studios can create or link their WhatsApp Business
							account through Meta Embedded Signup.
						</p>
					</AlertDescription>
				</Alert>

				{embeddedSignup.configured ? null : (
					<Alert className="border-amber-300/50 bg-amber-50 text-amber-950">
						<CircleAlertIcon />
						<AlertTitle>
							Embedded signup env is incomplete
						</AlertTitle>
						<AlertDescription>
							<p>
								Set NEXT_PUBLIC_META_APP_ID and
								NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID
								before using Login with Facebook. Restart the
								Next dev server after changing .env.local.
							</p>
						</AlertDescription>
					</Alert>
				)}

				{accountsQuery.isLoading ? (
					<div className="space-y-3">
						<Skeleton className="h-28 w-full rounded-2xl" />
						<Skeleton className="h-28 w-full rounded-2xl" />
					</div>
				) : accountsQuery.isError ? (
					<Alert
						variant="destructive"
						className="border-destructive/20"
					>
						<CircleAlertIcon />
						<AlertTitle>
							Unable to load WhatsApp accounts
						</AlertTitle>
						<AlertDescription>
							<p>
								{accountsQuery.error.message ||
									"Check the API connection and try again."}
							</p>
							<div className="pt-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => accountsQuery.refetch()}
								>
									Retry
								</Button>
							</div>
						</AlertDescription>
					</Alert>
				) : accounts.length === 0 ? (
					<div className="rounded-2xl border border-dashed border-border/80 bg-background px-4 py-8 text-center">
						<p className="m-0 text-sm font-medium text-foreground">
							No WhatsApp accounts connected yet.
						</p>
						<p className="mt-2 text-sm text-muted-foreground">
							Start with one studio number, validate it, then
							subscribe webhook events.
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{accounts.map((account) => (
							<WhatsAppAccountRow
								key={account.id}
								account={account}
								onTest={(accountId) =>
									testMutation.mutate({ accountId })
								}
								onSubscribe={(accountId) =>
									subscribeMutation.mutate({ accountId })
								}
								onDisconnect={(accountId) =>
									deleteMutation.mutate({ accountId })
								}
								isTesting={
									testMutation.isPending &&
									testMutation.variables?.accountId ===
										account.id
								}
								isSubscribing={
									subscribeMutation.isPending &&
									subscribeMutation.variables?.accountId ===
										account.id
								}
								isDisconnecting={
									deleteMutation.isPending &&
									deleteMutation.variables?.accountId ===
										account.id
								}
							/>
						))}
					</div>
				)}
			</div>
		</SettingsItem>
	);
}
