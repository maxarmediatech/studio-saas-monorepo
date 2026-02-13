"use client";

import { authClient } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";
import { OrganizationTeamsList } from "@saas/organizations/components/OrganizationTeamsList";
import { TeamDialog } from "@saas/organizations/components/team-dialog";
import { fullOrganizationQueryKey } from "@saas/organizations/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SettingsHeaderPortal } from "../_components/settings-header-portal";

interface TeamsPageClientProps {
	organizationId: string;
	canManage: boolean;
}

export function TeamsPageClient({
	organizationId,
	canManage,
}: TeamsPageClientProps) {
	const queryClient = useQueryClient();
	const [createOpen, setCreateOpen] = useState(false);

	const createTeamMutation = useMutation({
		mutationFn: async (name: string) => {
			const { error } = await authClient.organization.createTeam({
				name,
				organizationId,
			});

			if (error) {
				throw error;
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: fullOrganizationQueryKey(organizationId),
			});
			toast.success("Team created");
			setCreateOpen(false);
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to create team");
		},
	});

	return (
		<>
			{canManage && (
				<SettingsHeaderPortal>
					<Button size="sm" onClick={() => setCreateOpen(true)}>
						<Plus className="mr-2 h-4 w-4" />
						Create Team
					</Button>
				</SettingsHeaderPortal>
			)}
			<OrganizationTeamsList organizationId={organizationId} />

			<TeamDialog
				open={createOpen}
				onOpenChange={setCreateOpen}
				mode="create"
				isSaving={createTeamMutation.isPending}
				onSave={(name) => createTeamMutation.mutate(name)}
			/>
		</>
	);
}
