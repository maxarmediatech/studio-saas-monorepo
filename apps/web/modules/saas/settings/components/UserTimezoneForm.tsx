"use client";

import { authClient } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { useSession } from "@saas/auth/hooks/use-session";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

function isValidTimeZone(value: string): boolean {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: value }).format(
			new Date(),
		);
		return true;
	} catch {
		return false;
	}
}

const subscribeToBrowserTimeZone = () => () => {};
const getServerTimeZone = () => null;
const getBrowserTimeZone = () =>
	Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";

export function UserTimezoneForm() {
	const t = useTranslations();
	const { user, reloadSession } = useSession();

	const browserTimeZone = useSyncExternalStore(
		subscribeToBrowserTimeZone,
		getBrowserTimeZone,
		getServerTimeZone,
	);
	const [editedTimezone, setEditedTimezone] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const timezone = editedTimezone ?? user?.timezone ?? browserTimeZone ?? "";

	const save = async (nextTimeZone: string) => {
		const trimmed = nextTimeZone.trim();
		if (!trimmed) {
			return;
		}
		if (!isValidTimeZone(trimmed)) {
			toast.error(t("settings.account.timezone.notifications.invalid"));
			return;
		}

		setIsSaving(true);
		try {
			const { error } = await authClient.updateUser({
				timezone: trimmed,
			});
			if (error) {
				toast.error(t("settings.account.timezone.notifications.error"));
				return;
			}
			await reloadSession();
			setEditedTimezone(trimmed);
			toast.success(t("settings.account.timezone.notifications.success"));
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<SettingsItem
			title={t("settings.account.timezone.title")}
			description={t("settings.account.timezone.description", {
				detected: browserTimeZone ?? "…",
			})}
		>
			<div className="flex flex-col gap-3">
				<Input
					value={timezone}
					onChange={(e) => setEditedTimezone(e.target.value)}
					size="sm"
					disabled={isSaving}
					autoCapitalize="none"
					autoCorrect="off"
					spellCheck={false}
				/>
				<div className="flex items-center justify-end gap-2">
					<Button
						type="button"
						variant="outline"
						disabled={isSaving || !browserTimeZone}
						onClick={() => {
							if (!browserTimeZone) {
								return;
							}
							setEditedTimezone(browserTimeZone);
							void save(browserTimeZone);
						}}
					>
						{t("settings.account.timezone.useBrowser")}
					</Button>
					<Button
						type="button"
						disabled={
							isSaving ||
							timezone.trim() === (user?.timezone ?? "").trim()
						}
						onClick={() => void save(timezone)}
					>
						{t("settings.save")}
					</Button>
				</div>
			</div>
		</SettingsItem>
	);
}
