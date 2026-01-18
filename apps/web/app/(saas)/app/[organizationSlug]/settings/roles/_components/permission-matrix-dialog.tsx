"use client";

import {
	type AnyAction,
	type AppRole,
	appRoles,
	checkStaticRolePermission,
	getPermissionMatrix,
	type Resource,
} from "@repo/auth/lib/permissions";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
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
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface PermissionMatrixDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	organizationId: string;
	mode: "create" | "edit" | "view";
	role?: {
		id: string;
		name: string;
		description?: string;
		permissions: Record<string, string[]>;
	};
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

export function PermissionMatrixDialog({
	open,
	onOpenChange,
	organizationId,
	mode,
	role,
}: PermissionMatrixDialogProps) {
	const queryClient = useQueryClient();
	const [name, setName] = useState(role?.name ?? "");
	const [description, setDescription] = useState(role?.description ?? "");
	const [permissions, setPermissions] = useState<Record<string, string[]>>(
		role?.permissions ?? {},
	);
	const [templateRole, setTemplateRole] = useState<AppRole | "">("");

	useEffect(() => {
		if (open) {
			setName(role?.name ?? "");
			setDescription(role?.description ?? "");
			setPermissions(role?.permissions ?? {});
			setTemplateRole("");
		}
	}, [open, role]);

	const createMutation = useMutation({
		...orpc.organizations.roles.create.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.organizations.roles.key(),
			});
			toast.success("Role created successfully");
			onOpenChange(false);
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
			onOpenChange(false);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update role");
		},
	});

	const permissionMatrix = getPermissionMatrix().filter(
		({ resource }) => resource !== "ac",
	);

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
	const title =
		mode === "create"
			? "Create Custom Role"
			: mode === "edit"
				? "Edit Role"
				: "View Role Permissions";

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-4xl">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>
						{mode === "create"
							? "Create a new role with custom permissions. You can start from a template."
							: mode === "edit"
								? "Modify the permissions for this role."
								: "View the permissions assigned to this role."}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{!isViewOnly && (
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="name">Role Name</Label>
								<Input
									id="name"
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="e.g., Project Manager"
									disabled={isSaving}
								/>
								<p className="text-muted-foreground text-xs">
									Will be saved as: {toRoleKey(name) || "..."}
								</p>
							</div>
							<div className="space-y-2">
								<Label htmlFor="template">
									Start from Template
								</Label>
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
										{Object.keys(appRoles).map(
											(roleKey) => (
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
											),
										)}
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2 sm:col-span-2">
								<Label htmlFor="description">Description</Label>
								<Input
									id="description"
									value={description}
									onChange={(e) =>
										setDescription(e.target.value)
									}
									placeholder="Brief description of this role..."
									disabled={isSaving}
								/>
							</div>
						</div>
					)}

					<div className="space-y-2">
						<Label>Permissions</Label>
						<ScrollArea className="h-[400px] rounded-md border">
							<div className="p-4">
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
														{getResourceLabel(
															resource,
														)}
													</td>
													{Object.keys(
														ACTION_LABELS,
													).map((action) => {
														const isAvailable =
															actions.includes(
																action,
															);
														const isChecked =
															hasPermission(
																resource,
																action,
															);
														return (
															<td
																key={action}
																className="py-2 text-center"
															>
																{isAvailable ? (
																	<Checkbox
																		checked={
																			isChecked
																		}
																		onCheckedChange={() =>
																			!isViewOnly &&
																			!isSaving &&
																			togglePermission(
																				resource,
																				action,
																			)
																		}
																		disabled={
																			isViewOnly ||
																			isSaving
																		}
																	/>
																) : (
																	<span className="text-muted-foreground">
																		—
																	</span>
																)}
															</td>
														);
													})}
												</tr>
											),
										)}
									</tbody>
								</table>
							</div>
						</ScrollArea>
					</div>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isSaving}
					>
						{isViewOnly ? "Close" : "Cancel"}
					</Button>
					{!isViewOnly && (
						<Button
							onClick={handleSave}
							disabled={!name.trim() || isSaving}
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
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
