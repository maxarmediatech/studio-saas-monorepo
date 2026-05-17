"use client";

import type { whatsappAccountSummarySchema } from "@repo/api/modules/whatsapp/types";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@repo/ui/components/accordion";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Skeleton } from "@repo/ui/components/skeleton";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { whatsappApi, whatsappMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CheckCircle2Icon,
	CircleAlertIcon,
	CopyIcon,
	ExternalLinkIcon,
	EyeIcon,
	EyeOffIcon,
	MessageCircleIcon,
	PlugZapIcon,
	RefreshCwIcon,
	Trash2Icon,
	ZapIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
			description="Connect studio WhatsApp numbers through Meta Embedded Signup."
		>
			<div className="space-y-3 rounded-xl border border-border bg-card p-4">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="space-y-1">
						<p className="m-0 text-sm font-medium text-foreground">
							WhatsApp Business account
						</p>
						<p className="m-0 text-xs text-muted-foreground">
							One connected number per studio.
						</p>
					</div>
					<div className="flex shrink-0">
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
								display: "inline-flex",
								alignItems: "center",
								justifyContent: "center",
								flexShrink: 0,
								fontFamily: "Helvetica, Arial, sans-serif",
								fontSize: 16,
								fontWeight: "bold",
								height: 40,
								lineHeight: "40px",
								opacity: embeddedSignupMutation.isPending
									? 0.7
									: 1,
								padding: "0 24px",
								whiteSpace: "nowrap",
							}}
						>
							Login with Facebook
						</button>
					</div>
				</div>

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
					<div className="border-t border-border/70 pt-3">
						<p className="m-0 text-xs text-muted-foreground">
							No WhatsApp account connected.
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

type ConfigFormState = {
	name: string;
	phoneNumberId: string;
	wabaId: string;
	apiVersion: string;
	accessToken: string;
	appSecret: string;
	webhookVerifyToken: string;
};

type UpdateAccountInput = {
	accountId: string;
	name?: string;
	phoneNumberId?: string;
	wabaId?: string;
	accessToken?: string;
	appSecret?: string;
	apiVersion?: string;
	webhookVerifyToken?: string;
};

const setupSteps = [
	{
		title: "Create a Meta App",
		body: "Create or open a Meta developer app, then add WhatsApp Business as the use case.",
	},
	{
		title: "Add WhatsApp Product",
		body: "In the Meta app dashboard, add WhatsApp and connect the business portfolio that owns the phone number.",
	},
	{
		title: "Get API Credentials",
		body: "Copy the phone number ID, WhatsApp Business Account ID, app secret, and a permanent access token.",
	},
	{
		title: "Configure Webhooks",
		body: "Use the callback URL below, subscribe to messages, and keep the verify token in sync with this form.",
	},
] as const;

function buildInitialConfig(account: WhatsAppAccount | null): ConfigFormState {
	return {
		name: account?.name ?? "",
		phoneNumberId: account?.phoneNumberId ?? "",
		wabaId: account?.wabaId ?? "",
		apiVersion: account?.apiVersion ?? DEFAULT_CLOUD_API_VERSION,
		accessToken: "",
		appSecret: "",
		webhookVerifyToken: "",
	};
}

function maskSecret(isConfigured: boolean, emptyText: string) {
	return isConfigured ? "••••••••••••••••" : emptyText;
}

export function WhatsAppConfigSettingsPanel() {
	const queryClient = useQueryClient();
	const [showAccessToken, setShowAccessToken] = useState(false);
	const [origin, setOrigin] = useState("");

	const accountsQuery = useQuery({
		...whatsappApi.listAccountsOptions(),
		refetchOnWindowFocus: false,
	});
	const accounts = accountsQuery.data?.data ?? [];
	const account = accounts[0] ?? null;
	const [form, setForm] = useState<ConfigFormState>(() =>
		buildInitialConfig(account),
	);

	useEffect(() => {
		setOrigin(window.location.origin);
	}, []);

	useEffect(() => {
		setForm(buildInitialConfig(account));
	}, [account]);

	const webhookUrl = useMemo(() => {
		const base = origin || "http://localhost:3000";
		return `${base}/api/whatsapp/webhook/${account?.id ?? "YOUR_WEBHOOK_TOKEN"}`;
	}, [account?.id, origin]);

	const embeddedSignupMutation = useMutation(
		whatsappMutations.completeEmbeddedSignup(),
	);
	const updateMutation = useMutation({
		...whatsappMutations.updateAccount(),
		onSuccess: async (result) => {
			await queryClient.invalidateQueries({
				queryKey: orpc.whatsapp.key(),
			});
			toast.success(result.message);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to save configuration");
		},
	});
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

	const embeddedSignup = useWhatsAppEmbeddedSignup({
		onComplete: async (input) => {
			const result = await embeddedSignupMutation.mutateAsync(input);
			await queryClient.invalidateQueries({
				queryKey: orpc.whatsapp.key(),
			});
			toast.success(result.message);
		},
	});

	const updateField =
		(field: keyof ConfigFormState) =>
		(event: React.ChangeEvent<HTMLInputElement>) => {
			setForm((current) => ({
				...current,
				[field]: event.target.value,
			}));
		};

	const saveConfiguration = () => {
		if (!account) {
			toast.error("Connect a WhatsApp account first");
			return;
		}

		const input: UpdateAccountInput = { accountId: account.id };
		if (form.name.trim() && form.name.trim() !== account.name) {
			input.name = form.name.trim();
		}
		if (
			form.phoneNumberId.trim() &&
			form.phoneNumberId.trim() !== (account.phoneNumberId ?? "")
		) {
			input.phoneNumberId = form.phoneNumberId.trim();
		}
		if (
			form.wabaId.trim() &&
			form.wabaId.trim() !== (account.wabaId ?? "")
		) {
			input.wabaId = form.wabaId.trim();
		}
		if (
			form.apiVersion.trim() &&
			form.apiVersion.trim() !==
				(account.apiVersion ?? DEFAULT_CLOUD_API_VERSION)
		) {
			input.apiVersion = form.apiVersion.trim();
		}
		if (form.accessToken.trim()) {
			input.accessToken = form.accessToken.trim();
		}
		if (form.appSecret.trim()) {
			input.appSecret = form.appSecret.trim();
		}
		if (form.webhookVerifyToken.trim()) {
			input.webhookVerifyToken = form.webhookVerifyToken.trim();
		}

		if (Object.keys(input).length === 1) {
			toast.info("No configuration changes to save");
			return;
		}

		updateMutation.mutate(input);
	};

	const isConnected = account?.connectionStatus === "connected";

	return (
		<div className="grid gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-6">
			<div className="space-y-5">
				<Alert
					className={
						isConnected
							? "border-emerald-300/50 bg-emerald-50 text-emerald-950"
							: "border-amber-300/50 bg-amber-50 text-amber-950"
					}
				>
					{isConnected ? <CheckCircle2Icon /> : <CircleAlertIcon />}
					<AlertTitle>
						{isConnected ? "Connected" : "Not connected"}
					</AlertTitle>
					<AlertDescription>
						{isConnected
							? "Your WhatsApp Business API is connected and ready to send/receive messages."
							: "Connect a WhatsApp Business account before sending or receiving messages."}
					</AlertDescription>
				</Alert>

				<div className="rounded-xl border border-border bg-card p-5">
					<div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<h2 className="m-0 text-base font-semibold text-foreground">
								API Credentials
							</h2>
							<p className="m-0 text-sm text-muted-foreground">
								Values from Meta Embedded Signup show here as
								editable configuration.
							</p>
						</div>
						<button
							type="button"
							onClick={embeddedSignup.launch}
							disabled={embeddedSignupMutation.isPending}
							className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-[#1877f2] px-5 font-bold text-white text-sm disabled:cursor-not-allowed disabled:opacity-70"
						>
							Login with Facebook
						</button>
					</div>

					{embeddedSignup.configured ? null : (
						<Alert className="mt-4 border-amber-300/50 bg-amber-50 text-amber-950">
							<CircleAlertIcon />
							<AlertTitle>
								Embedded signup env is incomplete
							</AlertTitle>
							<AlertDescription>
								Set NEXT_PUBLIC_META_APP_ID and
								NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID,
								then restart dev.
							</AlertDescription>
						</Alert>
					)}

					{accountsQuery.isLoading ? (
						<div className="mt-5 space-y-3">
							<Skeleton className="h-11 w-full" />
							<Skeleton className="h-11 w-full" />
							<Skeleton className="h-11 w-full" />
						</div>
					) : (
						<div className="mt-5 grid gap-4">
							<div className="grid gap-2">
								<Label htmlFor="wa-name">Account name</Label>
								<Input
									id="wa-name"
									value={form.name}
									onChange={updateField("name")}
									placeholder="WhatsApp Business account"
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="wa-phone-number-id">
									Phone Number ID
								</Label>
								<Input
									id="wa-phone-number-id"
									value={form.phoneNumberId}
									onChange={updateField("phoneNumberId")}
									placeholder="1019354467938210"
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="wa-waba-id">
									WhatsApp Business Account ID
								</Label>
								<Input
									id="wa-waba-id"
									value={form.wabaId}
									onChange={updateField("wabaId")}
									placeholder="2434354430342784"
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="wa-api-version">
									Graph API Version
								</Label>
								<Input
									id="wa-api-version"
									value={form.apiVersion}
									onChange={updateField("apiVersion")}
									placeholder={DEFAULT_CLOUD_API_VERSION}
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="wa-access-token">
									Permanent Access Token
								</Label>
								<div className="flex gap-2">
									<Input
										id="wa-access-token"
										type={
											showAccessToken
												? "text"
												: "password"
										}
										value={form.accessToken}
										onChange={updateField("accessToken")}
										placeholder={maskSecret(
											account?.hasAccessToken ?? false,
											"Paste permanent access token",
										)}
									/>
									<Button
										type="button"
										variant="outline"
										size="icon"
										onClick={() =>
											setShowAccessToken(
												(value) => !value,
											)
										}
									>
										{showAccessToken ? (
											<EyeOffIcon className="size-4" />
										) : (
											<EyeIcon className="size-4" />
										)}
									</Button>
								</div>
								<p className="m-0 text-xs text-muted-foreground">
									Token is hidden for security. Re-enter it
									only when rotating credentials.
								</p>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="wa-app-secret">
									Meta App Secret
								</Label>
								<Input
									id="wa-app-secret"
									type="password"
									value={form.appSecret}
									onChange={updateField("appSecret")}
									placeholder={maskSecret(
										account?.hasAppSecret ?? false,
										"Paste app secret",
									)}
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="wa-verify-token">
									Webhook Verify Token
								</Label>
								<Input
									id="wa-verify-token"
									value={form.webhookVerifyToken}
									onChange={updateField("webhookVerifyToken")}
									placeholder="Create a custom verify token"
								/>
								<p className="m-0 text-xs text-muted-foreground">
									Must match the token set in Meta webhook
									settings.
								</p>
							</div>
						</div>
					)}
				</div>

				<div className="rounded-xl border border-border bg-card p-5">
					<h2 className="m-0 text-base font-semibold text-foreground">
						Webhook Configuration
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						Use this URL as your webhook callback in the Meta App
						Dashboard.
					</p>
					<div className="mt-4 grid gap-2">
						<Label htmlFor="wa-webhook-url">
							Webhook Callback URL
						</Label>
						<div className="flex gap-2">
							<Input
								id="wa-webhook-url"
								value={webhookUrl}
								readOnly
							/>
							<Button
								type="button"
								variant="outline"
								size="icon"
								onClick={async () => {
									await navigator.clipboard.writeText(
										webhookUrl,
									);
									toast.success("Webhook URL copied");
								}}
							>
								<CopyIcon className="size-4" />
							</Button>
						</div>
					</div>
				</div>

				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						onClick={saveConfiguration}
						disabled={!account || updateMutation.isPending}
					>
						{updateMutation.isPending
							? "Saving..."
							: "Save Configuration"}
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={() =>
							account &&
							testMutation.mutate({ accountId: account.id })
						}
						disabled={!account || testMutation.isPending}
					>
						<ZapIcon className="mr-1.5 size-4" />
						{testMutation.isPending
							? "Testing..."
							: "Test API Connection"}
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={() =>
							account &&
							subscribeMutation.mutate({ accountId: account.id })
						}
						disabled={
							!account ||
							subscribeMutation.isPending ||
							!account.wabaId
						}
					>
						<PlugZapIcon className="mr-1.5 size-4" />
						{subscribeMutation.isPending
							? "Subscribing..."
							: "Subscribe Webhook"}
					</Button>
					<Button
						type="button"
						variant="destructive"
						onClick={() =>
							account &&
							deleteMutation.mutate({ accountId: account.id })
						}
						disabled={!account || deleteMutation.isPending}
					>
						<Trash2Icon className="mr-1.5 size-4" />
						{deleteMutation.isPending
							? "Resetting..."
							: "Reset Configuration"}
					</Button>
				</div>
			</div>

			<aside className="h-fit rounded-xl border border-border bg-card p-5">
				<h2 className="m-0 text-base font-semibold text-foreground">
					Setup Instructions
				</h2>
				<p className="mt-1 text-sm text-muted-foreground">
					Follow these steps to connect your WhatsApp Business API.
				</p>
				<Accordion type="single" collapsible className="mt-5">
					{setupSteps.map((step, index) => (
						<AccordionItem
							key={step.title}
							value={`step-${index + 1}`}
						>
							<AccordionTrigger>
								<span className="flex items-center gap-3 text-left">
									<span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
										{index + 1}
									</span>
									{step.title}
								</span>
							</AccordionTrigger>
							<AccordionContent>{step.body}</AccordionContent>
						</AccordionItem>
					))}
				</Accordion>
				<a
					href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
					target="_blank"
					rel="noreferrer"
					className="mt-5 inline-flex items-center gap-2 text-primary text-sm"
				>
					<ExternalLinkIcon className="size-4" />
					Meta WhatsApp API Documentation
				</a>
			</aside>
		</div>
	);
}
