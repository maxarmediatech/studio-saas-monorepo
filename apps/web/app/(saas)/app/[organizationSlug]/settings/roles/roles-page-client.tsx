"use client";

import { Button } from "@repo/ui/components/button";
import { PageContent } from "@saas/studio";
import { Plus } from "lucide-react";
import { useState } from "react";
import { RolesList } from "./_components/roles-list";

export function RolesPageClient({ canManage }: { canManage: boolean }) {
	const [createSignal, setCreateSignal] = useState(0);

	return (
		<PageContent
			title="Roles"
			contentClassName="lg:pt-0"
			controls={
				canManage ? (
					<Button
						onClick={() => setCreateSignal((signal) => signal + 1)}
					>
						<Plus className="mr-2 h-4 w-4" />
						Create Role
					</Button>
				) : null
			}
		>
			<RolesList canManage={canManage} createSignal={createSignal} />
		</PageContent>
	);
}
