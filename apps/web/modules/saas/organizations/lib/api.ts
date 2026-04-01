import type { OrganizationMetadata } from "@repo/auth";
import { authClient } from "@repo/auth/client";
import { orpcClient } from "@shared/lib/orpc-client";
import { useMutation, useQuery } from "@tanstack/react-query";

export const organizationListQueryKey = ["user", "organizations"] as const;
export const useOrganizationListQuery = () => {
	return useQuery({
		queryKey: organizationListQueryKey,
		queryFn: async () => {
			const { data, error } = await authClient.organization.list();

			if (error) {
				throw new Error(
					error.message || "Failed to fetch organizations",
				);
			}

			return data;
		},
	});
};

export const activeOrganizationQueryKey = (slug: string) =>
	["user", "activeOrganization", slug] as const;
export const useActiveOrganizationQuery = (
	slug: string,
	options?: {
		enabled?: boolean;
	},
) => {
	return useQuery({
		queryKey: activeOrganizationQueryKey(slug),
		queryFn: async () => {
			const { data, error } =
				await authClient.organization.getFullOrganization({
					query: {
						organizationSlug: slug,
					},
				});

			if (error) {
				throw new Error(
					error.message || "Failed to fetch active organization",
				);
			}

			return data;
		},
		enabled: options?.enabled,
	});
};

export const fullOrganizationQueryKey = (id: string) =>
	["fullOrganization", id] as const;
export const useFullOrganizationQuery = (id: string) => {
	return useQuery({
		queryKey: fullOrganizationQueryKey(id),
		queryFn: async () => {
			const { data, error } =
				await authClient.organization.getFullOrganization({
					query: {
						organizationId: id,
					},
				});

			if (error) {
				throw new Error(
					error.message || "Failed to fetch full organization",
				);
			}

			return data;
		},
	});
};

export const organizationTeamsQueryKey = (id: string) =>
	["organizationTeams", id] as const;
export const useOrganizationTeamsQuery = (
	id: string,
	options?: { enabled?: boolean },
) => {
	return useQuery({
		queryKey: organizationTeamsQueryKey(id),
		queryFn: async () => {
			const { data, error } = await authClient.organization.listTeams({
				query: {
					organizationId: id,
				},
			});

			if (error) {
				throw new Error(error.message || "Failed to fetch teams");
			}

			return data;
		},
		enabled: options?.enabled,
	});
};

export const teamMembersQueryKey = (teamId: string) =>
	["teamMembers", teamId] as const;
export const useTeamMembersQuery = (
	teamId: string,
	options?: { enabled?: boolean },
) => {
	return useQuery({
		queryKey: teamMembersQueryKey(teamId),
		queryFn: async () => {
			try {
				return await orpcClient.organizations.teams.listMembers({
					teamId,
				});
			} catch (error) {
				throw new Error(
					error instanceof Error
						? error.message
						: "Failed to fetch team members",
				);
			}
		},
		enabled: options?.enabled,
	});
};

export const bulkInviteMembersMutationKey = ["bulk-invite-members"] as const;
export const useBulkInviteMembersMutation = () => {
	return useMutation({
		mutationKey: bulkInviteMembersMutationKey,
		mutationFn: async (input: {
			emails: string[];
			role: string[];
			teamId?: string | null;
		}) => {
			return await orpcClient.organizations.invites.bulkCreate(input);
		},
	});
};

/*
 * Create organization
 */
export const createOrganizationMutationKey = ["create-organization"] as const;
export const useCreateOrganizationMutation = () => {
	return useMutation({
		mutationKey: createOrganizationMutationKey,
		mutationFn: async ({
			name,
			metadata,
		}: {
			name: string;
			metadata?: OrganizationMetadata;
		}) => {
			const { slug } = await orpcClient.organizations.generateSlug({
				name,
			});

			const { error, data } = await authClient.organization.create({
				name,
				slug,
				metadata,
			});

			if (error) {
				throw error;
			}

			return data;
		},
	});
};

/*
 * Update organization
 */
export const updateOrganizationMutationKey = ["update-organization"] as const;
export const useUpdateOrganizationMutation = () => {
	return useMutation({
		mutationKey: updateOrganizationMutationKey,
		mutationFn: async ({
			id,
			name,
			metadata,
			updateSlug,
		}: {
			id: string;
			name: string;
			metadata?: OrganizationMetadata;
			updateSlug?: boolean;
		}) => {
			const slug = updateSlug
				? (
						await orpcClient.organizations.generateSlug({
							name,
						})
					).slug
				: undefined;

			const { error, data } = await authClient.organization.update({
				organizationId: id,
				data: {
					name,
					slug,
					metadata,
				},
			});

			if (error) {
				throw error;
			}

			return data;
		},
	});
};
