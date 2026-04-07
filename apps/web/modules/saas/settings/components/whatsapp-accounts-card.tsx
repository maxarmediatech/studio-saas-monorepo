"use client";

import type { whatsappAccountSummarySchema } from "@repo/api/modules/whatsapp/types";
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
import { Skeleton } from "@repo/ui/components/skeleton";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { whatsappApi, whatsappMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CheckCircle2Icon,
	CircleAlertIcon,
	CopyIcon,
	Link2Icon,
	MessageCircleIcon,
	PencilIcon,
	PlugZapIcon,
	RefreshCwIcon,
	Trash2Icon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { z } from "zod";

type WhatsAppAccount = z.infer<typeof whatsappAccountSummarySchema>;
type DialogMode = "connect" | "edit" | null;

type AccountFormState = {
	name: string;
	phoneNumberId: string;
	wabaId: string;
	accessToken: string;
	appSecret: string;
	apiVersion: string;
	webhookVerifyToken: string;
};

type WebhookSetupState = {
	accountName: string;
	webhookUrl: string;
	webhookVerifyToken: string;
};

const DEFAULT_CLOUD_API_VERSION = "v22.0";

const createWebhookToken = () => {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return `wa_${crypto.randomUUID().replace(/-/g, "")}`;
	}

	return `wa_${Math.random().toString(36).slice(2, 14)}`;
};

const createInitialFormState = (): AccountFormState => ({
	name: "",
	phoneNumberId: "",
	wabaId: "",
	accessToken: "",
	appSecret: "",
	apiVersion: DEFAULT_CLOUD_API_VERSION,
	webhookVerifyToken: createWebhookToken(),
});

const createEditFormState = (account: WhatsAppAccount): AccountFormState => ({
	name: account.name,
	phoneNumberId: account.phoneNumberId ?? "",
	wabaId: account.wabaId ?? "",
	accessToken: "",
	appSecret: "",
	apiVersion: account.apiVersion ?? DEFAULT_CLOUD_API_VERSION,
	webhookVerifyToken: "",
});

const formatDateTime = (value: Date | null) => {
	if (!value) {
		return null;
	}

	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
};

const getWebhookUrl = (token: string) => {
	if (typeof window === "undefined") {
		return `/api/webhooks/whatsapp/${token}`;
	}

	return `${window.location.origin}/api/webhooks/whatsapp/${token}`;
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

async function copyToClipboard(value: string, label: string) {
	try {
		await navigator.clipboard.writeText(value);
		toast.success(`${label} copied`);
	} catch {
		toast.error(`Failed to copy ${label.toLowerCase()}`);
	}
}

function WhatsAppAccountRow({
	account,
	onEdit,
	onTest,
	onSubscribe,
	onDisconnect,
	isEditing,
	isTesting,
	isSubscribing,
	isDisconnecting,
}: {
	account: WhatsAppAccount;
	onEdit: (account: WhatsAppAccount) => void;
	onTest: (accountId: string) => void;
	onSubscribe: (accountId: string) => void;
	onDisconnect: (accountId: string) => void;
	isEditing: boolean;
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
						onClick={() => onEdit(account)}
						disabled={
							isEditing ||
							isTesting ||
							isSubscribing ||
							isDisconnecting
						}
					>
						<PencilIcon className="mr-1.5 size-4" />
						{isEditing ? "Opening..." : "Edit"}
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => onTest(account.id)}
						disabled={
							isEditing ||
							isTesting ||
							isSubscribing ||
							isDisconnecting
						}
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
							isEditing ||
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
						disabled={
							isEditing ||
							isTesting ||
							isSubscribing ||
							isDisconnecting
						}
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
	const [dialogMode, setDialogMode] = useState<DialogMode>(null);
	const [form, setForm] = useState<AccountFormState>(createInitialFormState);
	const [editingAccount, setEditingAccount] =
		useState<WhatsAppAccount | null>(null);
	const [webhookSetup, setWebhookSetup] = useState<WebhookSetupState | null>(
		null,
	);

	const accountsQuery = useQuery({
		...whatsappApi.listAccountsOptions(),
		refetchOnWindowFocus: false,
	});

	const connectMutation = useMutation(whatsappMutations.connectCloudApi());
	const updateMutation = useMutation(whatsappMutations.updateAccount());

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
	const dialogOpen = dialogMode !== null;
	const isEditMode = dialogMode === "edit";
	const isDialogPending =
		connectMutation.isPending || updateMutation.isPending;

	const webhookUrl = useMemo(
		() =>
			form.webhookVerifyToken
				? getWebhookUrl(form.webhookVerifyToken)
				: null,
		[form.webhookVerifyToken],
	);

	const invalidateWhatsAppQueries = async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.whatsapp.key(),
		});
	};

	const resetDialog = () => {
		setDialogMode(null);
		setEditingAccount(null);
		setWebhookSetup(null);
		setForm(createInitialFormState());
	};

	const openConnectDialog = () => {
		setDialogMode("connect");
		setEditingAccount(null);
		setWebhookSetup(null);
		setForm(createInitialFormState());
	};

	const openEditDialog = (account: WhatsAppAccount) => {
		setDialogMode("edit");
		setEditingAccount(account);
		setWebhookSetup(null);
		setForm(createEditFormState(account));
	};

	const handleDialogOpenChange = (open: boolean) => {
		if (!open && webhookSetup) {
			return;
		}

		if (!open) {
			resetDialog();
		}
	};

	const handleConnectSubmit = async (
		event: React.FormEvent<HTMLFormElement>,
	) => {
		event.preventDefault();

		const submittedToken = form.webhookVerifyToken.trim();
		const submittedName = form.name.trim();
		const submittedWabaId = form.wabaId.trim();

		if (!submittedWabaId) {
			toast.error("WABA ID is required to connect a WhatsApp account");
			return;
		}

		try {
			await connectMutation.mutateAsync({
				name: submittedName,
				phoneNumberId: form.phoneNumberId.trim(),
				wabaId: submittedWabaId,
				accessToken: form.accessToken.trim(),
				appSecret: form.appSecret.trim() || undefined,
				apiVersion: form.apiVersion.trim() || undefined,
				webhookVerifyToken: submittedToken,
			});

			await invalidateWhatsAppQueries();
			setWebhookSetup({
				accountName: submittedName,
				webhookUrl: getWebhookUrl(submittedToken),
				webhookVerifyToken: submittedToken,
			});
			toast.success("WhatsApp account connected");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to connect WhatsApp account",
			);
		}
	};

	const handleEditSubmit = async (
		event: React.FormEvent<HTMLFormElement>,
	) => {
		event.preventDefault();

		if (!editingAccount) {
			return;
		}

		const submittedWebhookToken = form.webhookVerifyToken.trim();

		try {
			const result = await updateMutation.mutateAsync({
				accountId: editingAccount.id,
				name: form.name.trim(),
				phoneNumberId: form.phoneNumberId.trim() || undefined,
				wabaId: form.wabaId.trim() || undefined,
				accessToken: form.accessToken.trim() || undefined,
				appSecret: form.appSecret.trim() || undefined,
				apiVersion: form.apiVersion.trim() || undefined,
				webhookVerifyToken: submittedWebhookToken || undefined,
			});

			await invalidateWhatsAppQueries();

			if (submittedWebhookToken) {
				setWebhookSetup({
					accountName: result.data.name,
					webhookUrl: getWebhookUrl(submittedWebhookToken),
					webhookVerifyToken: submittedWebhookToken,
				});
				toast.success("WhatsApp account updated");
				return;
			}

			toast.success("WhatsApp account updated");
			resetDialog();
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to update WhatsApp account",
			);
		}
	};

	return (
		<>
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
								Use one unique business number per studio. We
								route by phone number ID, not by a shared
								platform inbox.
							</p>
						</div>
						<Button type="button" onClick={openConnectDialog}>
							<Link2Icon className="mr-1.5 size-4" />
							Connect account
						</Button>
					</div>

					<Alert className="border-border/70 bg-background">
						<CheckCircle2Icon />
						<AlertTitle>What the studio needs</AlertTitle>
						<AlertDescription>
							<p>
								Phone Number ID, WABA ID, permanent access
								token, and ideally an app secret. WABA ID is a
								hard requirement for new accounts now, so
								studios do not get stuck before webhook
								subscription. We keep the webhook token visible
								after save until someone explicitly closes the
								setup dialog.
							</p>
						</AlertDescription>
					</Alert>

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
									onEdit={openEditDialog}
									onTest={(accountId) =>
										testMutation.mutate({ accountId })
									}
									onSubscribe={(accountId) =>
										subscribeMutation.mutate({ accountId })
									}
									onDisconnect={(accountId) =>
										deleteMutation.mutate({ accountId })
									}
									isEditing={
										dialogMode === "edit" &&
										editingAccount?.id === account.id
									}
									isTesting={
										testMutation.isPending &&
										testMutation.variables?.accountId ===
											account.id
									}
									isSubscribing={
										subscribeMutation.isPending &&
										subscribeMutation.variables
											?.accountId === account.id
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

			<Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
				<DialogContent
					className="sm:max-w-2xl"
					showCloseButton={!webhookSetup}
				>
					{webhookSetup ? (
						<>
							<DialogHeader>
								<DialogTitle>Webhook setup details</DialogTitle>
								<DialogDescription>
									Copy these now. The verify token is only
									visible during this setup step.
								</DialogDescription>
							</DialogHeader>

							<div className="space-y-4">
								<Alert className="border-emerald-300/50 bg-emerald-50 text-emerald-950">
									<CheckCircle2Icon />
									<AlertTitle>
										{webhookSetup.accountName} is saved
									</AlertTitle>
									<AlertDescription>
										<p>
											Use the webhook URL and verify token
											below in the Meta app settings
											before closing this dialog.
										</p>
									</AlertDescription>
								</Alert>

								<div className="rounded-xl border border-border/70 bg-background p-4">
									<div className="flex items-start justify-between gap-3">
										<div className="space-y-2">
											<p className="m-0 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
												Webhook URL
											</p>
											<p className="m-0 break-all text-sm text-foreground">
												{webhookSetup.webhookUrl}
											</p>
										</div>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() =>
												copyToClipboard(
													webhookSetup.webhookUrl,
													"Webhook URL",
												)
											}
										>
											<CopyIcon className="mr-1.5 size-4" />
											Copy
										</Button>
									</div>
								</div>

								<div className="rounded-xl border border-border/70 bg-background p-4">
									<div className="flex items-start justify-between gap-3">
										<div className="space-y-2">
											<p className="m-0 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
												Verify token
											</p>
											<p className="m-0 break-all text-sm text-foreground">
												{
													webhookSetup.webhookVerifyToken
												}
											</p>
										</div>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() =>
												copyToClipboard(
													webhookSetup.webhookVerifyToken,
													"Verify token",
												)
											}
										>
											<CopyIcon className="mr-1.5 size-4" />
											Copy
										</Button>
									</div>
								</div>
							</div>

							<DialogFooter>
								<Button
									type="button"
									variant="outline"
									onClick={() =>
										copyToClipboard(
											`${webhookSetup.webhookUrl}\n${webhookSetup.webhookVerifyToken}`,
											"Webhook setup details",
										)
									}
								>
									<CopyIcon className="mr-1.5 size-4" />
									Copy both
								</Button>
								<Button type="button" onClick={resetDialog}>
									Done
								</Button>
							</DialogFooter>
						</>
					) : (
						<>
							<DialogHeader>
								<DialogTitle>
									{isEditMode
										? "Edit WhatsApp account"
										: "Connect WhatsApp Cloud API"}
								</DialogTitle>
								<DialogDescription>
									{isEditMode
										? "Fix metadata, rotate secrets, or add the missing WABA ID without recreating the account."
										: "Save the studio account, validate the credentials, then use the webhook URL and token in Meta."}
								</DialogDescription>
							</DialogHeader>

							<form
								className="space-y-4"
								onSubmit={
									isEditMode
										? handleEditSubmit
										: handleConnectSubmit
								}
							>
								{isEditMode ? (
									<Alert className="border-border/70 bg-background">
										<CircleAlertIcon />
										<AlertTitle>
											Secrets are write-only
										</AlertTitle>
										<AlertDescription>
											<p>
												Leave access token and app
												secret blank to keep the current
												values. Enter a new webhook
												token only if you want to rotate
												it.
											</p>
										</AlertDescription>
									</Alert>
								) : (
									<Alert className="border-border/70 bg-background">
										<CircleAlertIcon />
										<AlertTitle>
											WABA ID is required here
										</AlertTitle>
										<AlertDescription>
											<p>
												Validation can work without it,
												but webhook subscription cannot.
												We require it in the connect
												flow so studios do not end up
												with a half-connected account.
											</p>
										</AlertDescription>
									</Alert>
								)}

								<div className="grid gap-4 md:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="wa-name">
											Account name
										</Label>
										<Input
											id="wa-name"
											value={form.name}
											onChange={(event) =>
												setForm((current) => ({
													...current,
													name: event.target.value,
												}))
											}
											placeholder="Studio front desk"
											required
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="wa-api-version">
											Graph version
										</Label>
										<Input
											id="wa-api-version"
											value={form.apiVersion}
											onChange={(event) =>
												setForm((current) => ({
													...current,
													apiVersion:
														event.target.value,
												}))
											}
											placeholder={
												DEFAULT_CLOUD_API_VERSION
											}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="wa-phone-number-id">
											Phone number ID
										</Label>
										<Input
											id="wa-phone-number-id"
											value={form.phoneNumberId}
											onChange={(event) =>
												setForm((current) => ({
													...current,
													phoneNumberId:
														event.target.value,
												}))
											}
											required
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="wa-waba-id">
											WABA ID
										</Label>
										<Input
											id="wa-waba-id"
											value={form.wabaId}
											onChange={(event) =>
												setForm((current) => ({
													...current,
													wabaId: event.target.value,
												}))
											}
											required={!isEditMode}
											placeholder="Required for subscribe"
										/>
									</div>
								</div>

								<div className="space-y-2">
									<Label htmlFor="wa-access-token">
										Permanent access token
									</Label>
									<Input
										id="wa-access-token"
										type="password"
										value={form.accessToken}
										onChange={(event) =>
											setForm((current) => ({
												...current,
												accessToken: event.target.value,
											}))
										}
										required={!isEditMode}
										placeholder={
											isEditMode
												? "Leave blank to keep current token"
												: undefined
										}
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="wa-app-secret">
										App secret
									</Label>
									<Input
										id="wa-app-secret"
										type="password"
										value={form.appSecret}
										onChange={(event) =>
											setForm((current) => ({
												...current,
												appSecret: event.target.value,
											}))
										}
										placeholder={
											isEditMode
												? "Leave blank to keep current secret"
												: "Recommended for signature verification"
										}
									/>
								</div>

								<div className="grid gap-4 md:grid-cols-[1fr_auto]">
									<div className="space-y-2">
										<Label htmlFor="wa-webhook-token">
											{isEditMode
												? "New webhook verify token"
												: "Webhook verify token"}
										</Label>
										<Input
											id="wa-webhook-token"
											value={form.webhookVerifyToken}
											onChange={(event) =>
												setForm((current) => ({
													...current,
													webhookVerifyToken:
														event.target.value,
												}))
											}
											required={!isEditMode}
											placeholder={
												isEditMode
													? "Leave blank to keep current token"
													: undefined
											}
										/>
									</div>
									<div className="flex items-end">
										<Button
											type="button"
											variant="outline"
											onClick={() =>
												setForm((current) => ({
													...current,
													webhookVerifyToken:
														createWebhookToken(),
												}))
											}
										>
											{isEditMode
												? "Generate new token"
												: "Regenerate"}
										</Button>
									</div>
								</div>

								{webhookUrl ? (
									<div className="rounded-xl border border-border/70 bg-background p-3">
										<p className="m-0 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
											Webhook URL
										</p>
										<p className="mt-2 break-all text-sm text-foreground">
											{webhookUrl}
										</p>
									</div>
								) : null}

								<DialogFooter>
									<Button
										type="button"
										variant="outline"
										onClick={resetDialog}
										disabled={isDialogPending}
									>
										Cancel
									</Button>
									<Button
										type="submit"
										disabled={isDialogPending}
									>
										{isDialogPending
											? isEditMode
												? "Saving..."
												: "Connecting..."
											: isEditMode
												? "Save changes"
												: "Save and validate"}
									</Button>
								</DialogFooter>
							</form>
						</>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}
