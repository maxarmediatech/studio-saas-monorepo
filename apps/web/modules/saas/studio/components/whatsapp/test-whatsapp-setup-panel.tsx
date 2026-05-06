"use client";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";
import { whatsappMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	CheckCircle2Icon,
	CopyIcon,
	MessageSquareTextIcon,
	PlugZapIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

function createVerifyToken() {
	const fallback = Math.random().toString(16).slice(2);
	const random =
		typeof crypto !== "undefined" && "randomUUID" in crypto
			? crypto.randomUUID().replaceAll("-", "")
			: fallback;

	return `wa_test_${random}`;
}

type TestWhatsAppSetupPanelProps = {
	origin: string;
	onConnected: () => Promise<void>;
};

export function TestWhatsAppSetupPanel({
	origin,
	onConnected,
}: TestWhatsAppSetupPanelProps) {
	const queryClient = useQueryClient();
	const [accountName, setAccountName] = useState("WhatsApp test number");
	const [phoneNumberId, setPhoneNumberId] = useState("");
	const [wabaId, setWabaId] = useState("");
	const [accessToken, setAccessToken] = useState("");
	const [displayPhoneNumber, setDisplayPhoneNumber] = useState("");
	const [apiVersion, setApiVersion] = useState("v25.0");
	const [webhookVerifyToken, setWebhookVerifyToken] =
		useState(createVerifyToken);

	const callbackUrl = useMemo(
		() =>
			`${origin.replace(/\/$/, "")}/api/webhooks/whatsapp/${webhookVerifyToken.trim()}`,
		[origin, webhookVerifyToken],
	);

	const connectMutation = useMutation({
		...whatsappMutations.connectCloudApi(),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: orpc.whatsapp.key(),
			});
			await onConnected();
			toast.success("Test WhatsApp account connected");
		},
		onError: (error) => {
			toast.error(
				error.message || "Failed to connect WhatsApp test account",
			);
		},
	});

	const copy = async (value: string, label: string) => {
		await navigator.clipboard.writeText(value);
		toast.success(`${label} copied`);
	};

	const handleSubmit = () => {
		connectMutation.mutate({
			name: accountName.trim(),
			phoneNumberId: phoneNumberId.trim(),
			wabaId: wabaId.trim(),
			accessToken: accessToken.trim(),
			apiVersion: apiVersion.trim(),
			displayPhoneNumber: displayPhoneNumber.trim() || undefined,
			webhookVerifyToken: webhookVerifyToken.trim(),
		});
	};

	return (
		<div className="mx-auto flex h-full max-w-5xl items-center px-4 py-8">
			<div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
				<section className="rounded-2xl border bg-white p-6 shadow-xs">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div>
							<div className="mb-3 flex items-center gap-2">
								<Badge variant="secondary">Dev only</Badge>
								<Badge variant="outline">
									Cloud API test number
								</Badge>
							</div>
							<h2 className="m-0 text-xl font-semibold">
								Set up WhatsApp testing
							</h2>
							<p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
								Paste the values from Meta API Setup. Stuwiz
								will create one visible test account and use it
								for outbound messages, webhooks, and replies.
							</p>
						</div>
						<PlugZapIcon className="size-5 text-neutral-500" />
					</div>

					<div className="mt-6 grid gap-4 md:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="wa-test-name">Account name</Label>
							<Input
								id="wa-test-name"
								value={accountName}
								onChange={(event) =>
									setAccountName(event.target.value)
								}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="wa-test-version">
								Graph API version
							</Label>
							<Input
								id="wa-test-version"
								value={apiVersion}
								onChange={(event) =>
									setApiVersion(event.target.value)
								}
								placeholder="v25.0"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="wa-test-phone-id">
								Phone number ID
							</Label>
							<Input
								id="wa-test-phone-id"
								value={phoneNumberId}
								onChange={(event) =>
									setPhoneNumberId(event.target.value)
								}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="wa-test-waba-id">WABA ID</Label>
							<Input
								id="wa-test-waba-id"
								value={wabaId}
								onChange={(event) =>
									setWabaId(event.target.value)
								}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="wa-test-display-phone">
								Display phone number
							</Label>
							<Input
								id="wa-test-display-phone"
								value={displayPhoneNumber}
								onChange={(event) =>
									setDisplayPhoneNumber(event.target.value)
								}
								placeholder="+1 555 ..."
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="wa-test-verify-token">
								Webhook verify token
							</Label>
							<Input
								id="wa-test-verify-token"
								value={webhookVerifyToken}
								onChange={(event) =>
									setWebhookVerifyToken(event.target.value)
								}
							/>
						</div>
						<div className="space-y-2 md:col-span-2">
							<Label htmlFor="wa-test-token">
								Temporary access token
							</Label>
							<Textarea
								id="wa-test-token"
								value={accessToken}
								onChange={(event) =>
									setAccessToken(event.target.value)
								}
								className="min-h-24 resize-none font-mono text-xs"
							/>
						</div>
					</div>

					<div className="mt-6 flex justify-end">
						<Button
							type="button"
							onClick={handleSubmit}
							disabled={
								connectMutation.isPending ||
								!accountName.trim() ||
								!phoneNumberId.trim() ||
								!wabaId.trim() ||
								!accessToken.trim() ||
								!webhookVerifyToken.trim()
							}
						>
							<CheckCircle2Icon className="mr-1.5 size-4" />
							{connectMutation.isPending
								? "Validating..."
								: "Save and validate"}
						</Button>
					</div>
				</section>

				<aside className="space-y-4 rounded-2xl border bg-neutral-50 p-5">
					<div>
						<h3 className="m-0 flex items-center gap-2 text-sm font-semibold">
							<MessageSquareTextIcon className="size-4" />
							Meta webhook values
						</h3>
						<p className="mt-2 text-sm leading-6 text-muted-foreground">
							After the account is saved, paste these into Meta
							Webhooks and subscribe to the messages field.
						</p>
					</div>

					<div className="space-y-2">
						<Label>Callback URL</Label>
						<div className="rounded-lg border bg-white p-3 text-xs break-all">
							{callbackUrl}
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => copy(callbackUrl, "Callback URL")}
						>
							<CopyIcon className="mr-1.5 size-3.5" />
							Copy callback URL
						</Button>
					</div>

					<div className="space-y-2">
						<Label>Verify token</Label>
						<div className="rounded-lg border bg-white p-3 text-xs break-all">
							{webhookVerifyToken}
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() =>
								copy(webhookVerifyToken, "Verify token")
							}
						>
							<CopyIcon className="mr-1.5 size-3.5" />
							Copy verify token
						</Button>
					</div>

					<Alert>
						<AlertTitle>Visible test path</AlertTitle>
						<AlertDescription>
							No account will be created from env values. Testers
							must save credentials here before sending messages.
						</AlertDescription>
					</Alert>
				</aside>
			</div>
		</div>
	);
}
