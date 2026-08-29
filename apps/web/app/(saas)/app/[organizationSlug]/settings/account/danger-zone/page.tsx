import { DeleteAccountForm } from "@saas/settings/components/DeleteAccountForm";
import { SettingsList } from "@saas/shared/components/SettingsList";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Danger zone" };

export default function AccountDangerZonePage() {
	return (
		<SettingsList>
			<DeleteAccountForm />
		</SettingsList>
	);
}
