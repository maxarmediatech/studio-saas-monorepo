"use client";

import { staticRolesList } from "@repo/auth/lib/permissions";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Shield, ShieldCheck, ShieldPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DeleteRoleDialog } from "./delete-role-dialog";
import { PermissionMatrixDialog } from "./permission-matrix-dialog";
import { RoleCard } from "./role-card";

interface RolesListProps {
	organizationId: string;
	canManage: boolean;
}

interface CustomRole {
	id: string;
	role: string;
	permission: string;
	description: string | null;
	color: string | null;
	createdAt: Date;
	updatedAt: Date | null;
}

export function RolesList({ organizationId, canManage }: RolesListProps) {
	const queryClient = useQueryClient();
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
	const [deletingRole, setDeletingRole] = useState<CustomRole | null>(null);

	const { data: customRoles, isLoading } = useQuery(
		orpc.organizations.roles.list.queryOptions({}),
	);

	const deleteRoleMutation = useMutation({
		...orpc.organizations.roles.delete.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.organizations.roles.key(),
			});
			toast.success("Role deleted successfully");
			setDeletingRole(null);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete role");
		},
	});

	const handleEditRole = (role: CustomRole) => {
		setEditingRole(role);
	};

	const handleDeleteRole = (role: CustomRole) => {
		setDeletingRole(role);
	};

	const confirmDelete = () => {
		if (deletingRole) {
			deleteRoleMutation.mutate({ roleId: deletingRole.id });
		}
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<Shield className="h-5 w-5" />
								Role Management
							</CardTitle>
							<CardDescription>
								Manage roles and permissions for your
								organization. Static roles are predefined and
								cannot be modified.
							</CardDescription>
						</div>
						{canManage && (
							<Button onClick={() => setIsCreateDialogOpen(true)}>
								<Plus className="mr-2 h-4 w-4" />
								Create Role
							</Button>
						)}
					</div>
				</CardHeader>
				<CardContent>
					<div className="space-y-6">
						<div>
							<h3 className="mb-3 flex items-center gap-2 font-medium text-sm">
								<ShieldCheck className="h-4 w-4 text-muted-foreground" />
								Static Roles
								<Badge variant="secondary" className="text-xs">
									Read-only
								</Badge>
							</h3>
							<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{staticRolesList.map((role) => (
									<RoleCard
										key={role.key}
										role={{
											id: role.key,
											name: role.label,
											description: role.description,
											isStatic: true,
											permissions: {},
										}}
										canManage={false}
									/>
								))}
							</div>
						</div>

						<div>
							<h3 className="mb-3 flex items-center gap-2 font-medium text-sm">
								<ShieldPlus className="h-4 w-4 text-muted-foreground" />
								Custom Roles
								{customRoles && customRoles.length > 0 && (
									<Badge
										variant="outline"
										className="text-xs"
									>
										{customRoles.length}
									</Badge>
								)}
							</h3>
							{isLoading ? (
								<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
									{[1, 2, 3].map((i) => (
										<Skeleton
											key={i}
											className="h-24 w-full"
										/>
									))}
								</div>
							) : customRoles && customRoles.length > 0 ? (
								<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
									{customRoles.map((role) => (
										<RoleCard
											key={role.id}
											role={{
												id: role.id,
												name: role.role
													.replace(/_/g, " ")
													.replace(/\b\w/g, (c) =>
														c.toUpperCase(),
													),
												description:
													role.description ?? "",
												isStatic: false,
												permissions: JSON.parse(
													role.permission,
												),
												color: role.color ?? undefined,
											}}
											canManage={canManage}
											onEdit={() => handleEditRole(role)}
											onDelete={() =>
												handleDeleteRole(role)
											}
										/>
									))}
								</div>
							) : (
								<div className="rounded-lg border border-dashed p-8 text-center">
									<p className="text-muted-foreground text-sm">
										No custom roles yet.{" "}
										{canManage && (
											<>
												Click{" "}
												<button
													type="button"
													className="text-primary underline"
													onClick={() =>
														setIsCreateDialogOpen(
															true,
														)
													}
												>
													Create Role
												</button>{" "}
												to add one.
											</>
										)}
									</p>
								</div>
							)}
						</div>
					</div>
				</CardContent>
			</Card>

			<PermissionMatrixDialog
				open={isCreateDialogOpen}
				onOpenChange={setIsCreateDialogOpen}
				organizationId={organizationId}
				mode="create"
			/>

			{editingRole && (
				<PermissionMatrixDialog
					open={!!editingRole}
					onOpenChange={(open) => !open && setEditingRole(null)}
					organizationId={organizationId}
					mode="edit"
					role={{
						id: editingRole.id,
						name: editingRole.role,
						description: editingRole.description ?? undefined,
						permissions: JSON.parse(editingRole.permission),
					}}
				/>
			)}

			<DeleteRoleDialog
				open={!!deletingRole}
				onOpenChange={(open) => !open && setDeletingRole(null)}
				roleName={
					deletingRole?.role
						.replace(/_/g, " ")
						.replace(/\b\w/g, (c) => c.toUpperCase()) ?? ""
				}
				onConfirm={confirmDelete}
				isDeleting={deleteRoleMutation.isPending}
			/>
		</div>
	);
}
