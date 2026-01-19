"use client";

import {
	AnyAction,
	AppRole,
	appRoles,
	checkStaticRolePermission,
	getPermissionMatrix,
	Resource,
} from "@repo/auth/lib/permissions";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface RoleData {
	id: string;
	name: string;
	description?: string;
	permissions: Record<string, string[]>;
}

interface CustomRoleRecord {
	id: string;
	role: string;
	permission: string;
	description: string | null;
	color: string | null;
	createdAt: Date;
	updatedAt: Date | null;
}

interface PermissionMatrixPanelProps {
	mode: "create" | "edit" | "view";
	role?: RoleData;
	onCancel?: () => void;
	onEdit?: () => void;
	onCreated?: (role: CustomRoleRecord) => void;
	onUpdated?: () => void;
	onDelete?: () => void;
}

const RESOURCE_LABELS: Partial<Record<Resource, string>> = {
	organization: "Organization",
	member: "Members",
	invitation: "Invitations",
	team: "Team",
	dashboard: "Dashboard",
	booking: "Bookings",
	client: "Clients",
	shoot: "Shoots",
	deliverable: "Deliverables",
	task: "Tasks",
	expense: "Expenses",
	payment: "Payments",
	crew: "Crew",
	review: "Review Queue",
	configuration: "Configuration",
	settings: "Settings",
	invites: "Invites",
};

function getResourceLabel(resource: Resource): string {
	return (
		RESOURCE_LABELS[resource] ??
		resource.charAt(0).toUpperCase() + resource.slice(1)
	);
}

const ACTION_LABELS: Record<AnyAction, string> = {
	create: "Create",
	read: "Read",
	update: "Update",
	delete: "Delete",
	list: "List",
	assign: "Assign",
	submit: "Submit",
	review: "Review",
	approve: "Approve",
	claim: "Claim",
};

function toRoleKey(displayName: string): string {
	return displayName.toLowerCase().replace(/\s+/g, "_");
}

export function PermissionMatrixPanel({
	mode,
	role,
	onCancel,
	onEdit,
	onCreated,
	onUpdated,
	onDelete,
}: PermissionMatrixPanelProps) {
	const queryClient = useQueryClient();
	const [name, setName] = useState(role?.name ?? "");
	const [description, setDescription] = useState(role?.description ?? "");
	const [permissions, setPermissions] = useState<Record<string, string[]>>(
		role?.permissions ?? {},
	);
	const [templateRole, setTemplateRole] = useState<AppRole | "">("");

	const permissionMatrix = useMemo(
		() => getPermissionMatrix().filter(({ resource }) => resource !== "ac"),
		[],
	);

	const resetForm = () => {
		setName(role?.name ?? "");
		setDescription(role?.description ?? "");
		setPermissions(role?.permissions ?? {});
		setTemplateRole("");
	};

	useEffect(() => {
		resetForm();
	}, [role, mode]);

	const createMutation = useMutation({
		...orpc.organizations.roles.create.mutationOptions(),
		onSuccess: (data) => {
			queryClient.invalidateQueries({
				queryKey: orpc.organizations.roles.key(),
			});
			toast.success("Role created successfully");
			onCreated?.(data as CustomRoleRecord);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to create role");
		},
	});

	const updateMutation = useMutation({
		...orpc.organizations.roles.update.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.organizations.roles.key(),
			});
			toast.success("Role updated successfully");
			onUpdated?.();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update role");
		},
	});

	const handleTemplateChange = (roleKey: AppRole) => {
		setTemplateRole(roleKey);
		const newPermissions: Record<string, string[]> = {};
		for (const { resource, actions } of permissionMatrix) {
			const allowedActions: string[] = [];
			for (const action of actions) {
				if (
					checkStaticRolePermission(
						roleKey,
						resource,
						action as AnyAction,
					)
				) {
					allowedActions.push(action);
				}
			}
			if (allowedActions.length > 0) {
				newPermissions[resource] = allowedActions;
			}
		}
		setPermissions(newPermissions);
	};

	const togglePermission = (resource: Resource, action: string) => {
		setPermissions((prev) => {
			const current = prev[resource] ?? [];
			if (current.includes(action)) {
				const filtered = current.filter((a) => a !== action);
				if (filtered.length === 0) {
					const { [resource]: _, ...rest } = prev;
					return rest;
				}
				return { ...prev, [resource]: filtered };
			}
			return { ...prev, [resource]: [...current, action] };
		});
	};

	const hasPermission = (resource: Resource, action: string) => {
		return permissions[resource]?.includes(action) ?? false;
	};

	const handleSave = async () => {
		const roleKey = toRoleKey(name);

		if (mode === "create") {
			createMutation.mutate({
				role: roleKey,
				permission: permissions,
				description: description || undefined,
			});
		} else if (mode === "edit" && role?.id) {
			updateMutation.mutate({
				roleId: role.id,
				role: roleKey,
				permission: permissions,
				description: description || null,
			});
		}
	};

	const isViewOnly = mode === "view";
	const isSaving = createMutation.isPending || updateMutation.isPending;
	const isEditable = !isViewOnly;
	const title =
		mode === "create"
			? "Create Custom Role"
			: mode === "edit"
				? "Edit Role"
				: "Role Overview";
	const descriptionText =
		mode === "create"
			? "Define a new role and its permissions."
			: mode === "edit"
				? "Adjust what this role can access."
				: "System roles are read-only. Review the permissions below.";

	if (!role && mode !== "create") {
		return null;
	}

	return (
		<Card className="h-full rounded-md shadow-none">
			<CardHeader>
				<div className="flex items-start justify-between gap-4">
					<div>
						<CardTitle className="flex items-center gap-2">
							{title}
							{isViewOnly && (
								<Badge variant="secondary">System</Badge>
							)}
						</CardTitle>
						<CardDescription>{descriptionText}</CardDescription>
					</div>
					{isEditable ? (
						<div className="flex items-center gap-2">
							{onDelete && mode === "edit" && (
								<Button
									variant="ghost"
									size="icon"
									className="text-destructive hover:text-destructive"
									onClick={onDelete}
								>
									<Trash2 className="h-4 w-4" />
									<span className="sr-only">Delete role</span>
								</Button>
							)}
							<Button
								variant="ghost"
								onClick={() => {
									resetForm();
									onCancel?.();
								}}
								disabled={isSaving}
							>
								Cancel
							</Button>
							<Button
								onClick={handleSave}
								disabled={isSaving || !name.trim()}
							>
								{isSaving ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Saving...
									</>
								) : mode === "create" ? (
									"Create Role"
								) : (
									"Save Changes"
								)}
							</Button>
						</div>
					) : (
						<div className="flex items-center gap-2">
							{onDelete && (
								<Button
									variant="ghost"
									size="icon"
									className="text-destructive hover:text-destructive"
									onClick={onDelete}
								>
									<Trash2 className="h-4 w-4" />
									<span className="sr-only">Delete role</span>
								</Button>
							)}
							{onEdit && (
								<Button onClick={onEdit}>Edit</Button>
							)}
						</div>
					)}
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid gap-4 lg:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="name">Role Name</Label>
						<Input
							id="name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g., Project Manager"
							disabled={!isEditable || isSaving}
						/>
						{isEditable && (
							<p className="text-muted-foreground text-xs">
								Will be saved as: {toRoleKey(name) || "..."}
							</p>
						)}
					</div>
					{isEditable && (
						<div className="space-y-2">
							<Label htmlFor="template">Start from Template</Label>
							<Select
								value={templateRole}
								onValueChange={(v) =>
									handleTemplateChange(v as AppRole)
								}
								disabled={isSaving}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select a role template..." />
								</SelectTrigger>
								<SelectContent>
									{Object.keys(appRoles).map((roleKey) => (
										<SelectItem
											key={roleKey}
											value={roleKey}
										>
											{roleKey
												.replace(/_/g, " ")
												.replace(/\b\w/g, (c) =>
													c.toUpperCase(),
												)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}
					<div className="space-y-2 lg:col-span-2">
						<Label htmlFor="description">Description</Label>
						<Input
							id="description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Brief description of this role..."
							disabled={!isEditable || isSaving}
						/>
					</div>
				</div>

				<div className="space-y-2">
					<Label>Permissions</Label>
					<ScrollArea className="h-[520px] rounded-md border">
						<div className="p-4">
							<div className="min-w-[900px] overflow-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b">
											<th className="pb-2 text-left font-medium">
												Resource
											</th>
											{Object.keys(ACTION_LABELS).map(
												(action) => (
													<th
														key={action}
														className="pb-2 text-center font-medium"
													>
														<span className="text-xs">
															{
																ACTION_LABELS[
																	action as AnyAction
																]
															}
														</span>
													</th>
												),
											)}
										</tr>
									</thead>
									<tbody>
										{permissionMatrix.map(
											({ resource, actions }) => (
												<tr
													key={resource}
													className="border-b last:border-0"
												>
													<td className="py-2 font-medium">
														{getResourceLabel(resource)}
													</td>
													{Object.keys(ACTION_LABELS).map(
														(action) => {
															const isAvailable =
																actions.includes(
																	action as AnyAction,
																);
															if (!isAvailable) {
																return (
																	<td
																		key={action}
																		className="py-2 text-center text-muted-foreground"
																	>
																		—
																	</td>
																);
															}
															return (
																<td key={action} className="py-2 text-center">
																	<Checkbox
																		checked={hasPermission(
																			resource,
																			action,
																		)}
																		onCheckedChange={() =>
																			togglePermission(
																				resource,
																				action,
																			)
																		}
																		disabled={!isEditable || isSaving}
																	/>
																</td>
															);
														},
													)}
												</tr>
											),
										)}
									</tbody>
								</table>
							</div>
						</div>
					</ScrollArea>
				</div>
			</CardContent>
		</Card>
	);
}
