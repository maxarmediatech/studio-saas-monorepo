"use client";

import { Button } from "@repo/ui/components/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { SettingsHeaderPortal } from "../_components/settings-header-portal";
import { RolesList } from "./_components/roles-list";

export function RolesPageClient({ canManage }: { canManage: boolean }) {
	const [createSignal, setCreateSignal] = useState(0);

	return (
		<>
			{canManage && (
				<SettingsHeaderPortal>
					<Button
						size="sm"
						onClick={() => setCreateSignal((signal) => signal + 1)}
					>
						<Plus className="mr-2 h-4 w-4" />
						Create Role
					</Button>
				</SettingsHeaderPortal>
			)}
			<RolesList canManage={canManage} createSignal={createSignal} />
		</>
	);
}
