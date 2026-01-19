"use client";

import { AppRole, appRoles, staticRolesList } from "@repo/auth/lib/permissions";
import { Badge } from "@repo/ui/components/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DeleteRoleDialog } from "./delete-role-dialog";
import { PermissionMatrixPanel } from "./permission-matrix-panel";

interface RolesListProps {
	canManage: boolean;
	createSignal?: number;
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

interface RoleListItem {
	key: string;
	name: string;
	description: string;
	type: "static" | "custom";
	color?: string | null;
	permissions: Record<string, string[]>;
	data?: CustomRole;
}

interface RoleEditorRole {
	id: string;
	name: string;
	description?: string;
	permissions: Record<string, string[]>;
}

interface SelectedRoleState {
	mode: "create" | "edit" | "view";
	role?: RoleEditorRole;
	customData?: CustomRole;
}

const DEFAULT_ROLE_KEY = `static:${
	staticRolesList.find((role) => role.key === "member")?.key ??
	staticRolesList[0]?.key ??
	"member"
}`;

function formatRoleName(roleKey: string): string {
	return roleKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function parsePermissions(value: string): Record<string, string[]> {
	try {
		return JSON.parse(value) as Record<string, string[]>;
	} catch {
		return {};
	}
}

export function RolesList({ canManage, createSignal }: RolesListProps) {
	const queryClient = useQueryClient();
	const [isCreateMode, setIsCreateMode] = useState(false);
	const [selectedRoleKey, setSelectedRoleKey] =
		useState<string>(DEFAULT_ROLE_KEY);
	const [previousRoleKey, setPreviousRoleKey] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [deletingRole, setDeletingRole] = useState<CustomRole | null>(null);
	const lastCreateSignal = useRef(createSignal);

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
			setIsCreateMode(false);
			setSelectedRoleKey(DEFAULT_ROLE_KEY);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete role");
		},
	});

	const roleItems = useMemo(() => {
		const staticItems: RoleListItem[] = staticRolesList.map((role) => ({
			key: `static:${role.key}`,
			name: role.label,
			description: role.description,
			type: "static",
			permissions: appRoles[role.key as AppRole].statements as Record<
				string,
				string[]
			>,
		}));

		const customItems: RoleListItem[] = (customRoles ?? []).map((role) => ({
			key: `custom:${role.id}`,
			name: formatRoleName(role.role),
			description: role.description ?? "Custom role",
			type: "custom",
			color: role.color,
			permissions: parsePermissions(role.permission),
			data: role,
		}));

		return { staticItems, customItems };
	}, [customRoles]);

	useEffect(() => {
		if (selectedRoleKey.startsWith("custom:")) {
			const exists = roleItems.customItems.some(
				(role) => role.key === selectedRoleKey,
			);
			if (!exists) {
				setSelectedRoleKey(DEFAULT_ROLE_KEY);
			}
		}
	}, [roleItems.customItems, selectedRoleKey]);

	const filteredItems = useMemo(() => {
		const query = search.trim().toLowerCase();
		if (!query) {
			return roleItems;
		}

		const filterList = (items: RoleListItem[]) =>
			items.filter((role) =>
				[role.name, role.description]
					.join(" ")
					.toLowerCase()
					.includes(query),
			);

		return {
			staticItems: filterList(roleItems.staticItems),
			customItems: filterList(roleItems.customItems),
		};
	}, [roleItems, search]);

	const selectedRole: SelectedRoleState = useMemo(() => {
		if (isCreateMode) {
			return { mode: "create" as const, role: undefined };
		}

		const staticMatch = roleItems.staticItems.find(
			(role) => role.key === selectedRoleKey,
		);
		if (staticMatch) {
			return {
				mode: "view" as const,
				role: {
					id: staticMatch.key,
					name: staticMatch.name,
					description: staticMatch.description,
					permissions: staticMatch.permissions,
				},
			};
		}

		const customMatch = roleItems.customItems.find(
			(role) => role.key === selectedRoleKey,
		);
		if (customMatch) {
			return {
				mode: "edit" as const,
				role: {
					id: customMatch.data?.id ?? customMatch.key,
					name: customMatch.name,
					description: customMatch.data?.description ?? "",
					permissions: customMatch.permissions,
				},
				customData: customMatch.data,
			};
		}

		return { mode: "view" as const, role: undefined };
	}, [isCreateMode, roleItems.customItems, roleItems.staticItems, selectedRoleKey]);

	const handleCreateRole = () => {
		setPreviousRoleKey(selectedRoleKey || DEFAULT_ROLE_KEY);
		setSelectedRoleKey("");
		setIsCreateMode(true);
	};

	useEffect(() => {
		if (createSignal === undefined) {
			return;
		}

		if (createSignal !== lastCreateSignal.current) {
			lastCreateSignal.current = createSignal;
			if (canManage) {
				handleCreateRole();
			}
		}
	}, [canManage, createSignal]);

	const handleCancelEdit = () => {
		if (isCreateMode) {
			setIsCreateMode(false);
			setSelectedRoleKey(previousRoleKey ?? DEFAULT_ROLE_KEY);
			setPreviousRoleKey(null);
		}
	};

	const handleRoleSelect = (key: string) => {
		setIsCreateMode(false);
		setSelectedRoleKey(key);
	};

	const handleDelete = () => {
		if (selectedRole?.customData) {
			setDeletingRole(selectedRole.customData);
		}
	};

	const confirmDelete = () => {
		if (deletingRole) {
			deleteRoleMutation.mutate({ roleId: deletingRole.id });
		}
	};

	return (
		<div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
			<Card className="h-fit rounded-md shadow-none">
				<CardHeader>
					<CardTitle>Roles</CardTitle>
					<CardDescription>
						Manage access by assigning custom roles. System roles are
						locked.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<Input
						placeholder="Search roles..."
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>

					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<h3 className="text-sm font-medium">System roles</h3>
							<Badge variant="secondary" className="text-xs">
								Read-only
							</Badge>
						</div>
						<div className="space-y-2">
							{filteredItems.staticItems.map((role) => (
								<button
									key={role.key}
									type="button"
									onClick={() => handleRoleSelect(role.key)}
									className={cn(
										"w-full rounded-md border px-3 py-2 text-left transition",
										selectedRoleKey === role.key && !isCreateMode
											? "border-primary bg-primary/5"
											: "hover:bg-muted",
									)}
									aria-pressed={selectedRoleKey === role.key && !isCreateMode}
								>
									<div className="flex items-center justify-between">
										<span className="font-medium text-sm">
											{role.name}
										</span>
										<Badge variant="outline" className="text-[10px]">
											System
										</Badge>
									</div>
									<p className="mt-1 text-muted-foreground text-xs">
										{role.description}
									</p>
								</button>
							))}
						</div>
					</div>

					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<h3 className="text-sm font-medium">Custom roles</h3>
							{roleItems.customItems.length > 0 && (
								<Badge variant="outline" className="text-xs">
									{roleItems.customItems.length}
								</Badge>
							)}
						</div>
						{isLoading ? (
							<div className="space-y-2">
								{[1, 2, 3].map((i) => (
									<Skeleton key={i} className="h-16 w-full" />
								))}
							</div>
						) : filteredItems.customItems.length > 0 ? (
							<div className="space-y-2">
								{filteredItems.customItems.map((role) => (
									<button
										key={role.key}
										type="button"
										onClick={() => handleRoleSelect(role.key)}
										className={cn(
											"w-full rounded-md border px-3 py-2 text-left transition",
											selectedRoleKey === role.key && !isCreateMode
												? "border-primary bg-primary/5"
												: "hover:bg-muted",
										)}
										aria-pressed={
											selectedRoleKey === role.key && !isCreateMode
										}
									>
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2">
												{role.color && (
													<span
														className="h-2.5 w-2.5 rounded-full"
														style={{ backgroundColor: role.color }}
													/>
												)}
												<span className="font-medium text-sm">
													{role.name}
												</span>
											</div>
											<Badge variant="outline" className="text-[10px]">
												Custom
											</Badge>
										</div>
										<p className="mt-1 text-muted-foreground text-xs">
											{role.description}
										</p>
									</button>
								))}
							</div>
						) : (
							<div className="rounded-md border border-dashed p-4 text-center text-muted-foreground text-xs">
								No custom roles yet. Use "Create Role" to add one.
							</div>
						)}
					</div>
				</CardContent>
			</Card>

			<div className="min-h-[600px]">
				<PermissionMatrixPanel
					mode={selectedRole.mode}
					role={selectedRole.role}
					onCancel={handleCancelEdit}
					onCreated={(role) => {
						setIsCreateMode(false);
						setSelectedRoleKey(`custom:${role.id}`);
						setPreviousRoleKey(null);
					}}
					onUpdated={() => {
						setIsCreateMode(false);
					}}
					onDelete={handleDelete}
				/>
			</div>

			<DeleteRoleDialog
				open={!!deletingRole}
				onOpenChange={(open) => !open && setDeletingRole(null)}
				roleName={
					deletingRole?.role
						? formatRoleName(deletingRole.role)
						: ""
				}
				onConfirm={confirmDelete}
				isDeleting={deleteRoleMutation.isPending}
			/>
		</div>
	);
}
