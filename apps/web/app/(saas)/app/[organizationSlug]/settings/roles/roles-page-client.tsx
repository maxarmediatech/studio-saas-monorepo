"use client";

import { Button } from "@repo/ui/components/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { RolesList } from "./_components/roles-list";

export function RolesPageClient({ canManage }: { canManage: boolean }) {
	const [createSignal, setCreateSignal] = useState(0);

	return (
		<>
			{canManage && (
				<div className="mb-4 flex justify-end">
					<Button
						size="sm"
						onClick={() => setCreateSignal((signal) => signal + 1)}
					>
						<Plus className="mr-2 h-4 w-4" />
						Create Role
					</Button>
				</div>
			)}
			<RolesList canManage={canManage} createSignal={createSignal} />
		</>
	);
}
