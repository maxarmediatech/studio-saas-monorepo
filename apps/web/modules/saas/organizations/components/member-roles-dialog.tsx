"use client";

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
import { Badge } from "@repo/ui/components/badge";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useAllRoles } from "@saas/organizations/hooks/use-all-roles";
import { useEffect, useState } from "react";

interface MemberRolesDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	member?: {
		name: string;
		email: string;
		roles: string[];
	};
	onSave: (roles: string[]) => void;
}

export function MemberRolesDialog({
	open,
	onOpenChange,
	member,
	onSave,
}: MemberRolesDialogProps) {
	const [roles, setRoles] = useState<string[]>([]);
	const { roles: roleOptions, isLoading } = useAllRoles({ enabled: open });

	useEffect(() => {
		if (open) {
			setRoles(member?.roles ?? ["member"]);
		}
	}, [open, member]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[480px]">
				<DialogHeader>
					<DialogTitle>Update Roles</DialogTitle>
					<DialogDescription>
						Choose which roles to assign to this member.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-3">
					<div>
						<p className="font-medium text-sm">{member?.name}</p>
						<p className="text-muted-foreground text-sm">
							{member?.email}
						</p>
					</div>
					<div className="space-y-2">
						{isLoading ? (
							<div className="space-y-2">
								{[1, 2, 3].map((item) => (
									<Skeleton key={item} className="h-5 w-full" />
								))}
							</div>
						) : (
							roleOptions.map((role) => (
								<label
									key={role.value}
									htmlFor={`member-role-${role.value}`}
									className="flex items-center gap-2 text-sm"
								>
									<Checkbox
										id={`member-role-${role.value}`}
										checked={roles.includes(role.value)}
										onCheckedChange={(checked) => {
											setRoles((current) =>
												checked
													? [...current, role.value]
													: current.filter(
															(value) =>
																value !==
																role.value,
														),
											);
										}}
									/>
									<span>{role.label}</span>
									{role.isStatic && (
										<Badge
											variant="outline"
											className="text-[10px]"
										>
											System
										</Badge>
									)}
								</label>
							))
						)}
					</div>
				</div>
				<DialogFooter>
					<Button
						variant="ghost"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						onClick={() => {
							onSave(roles);
							onOpenChange(false);
						}}
					>
						Save Changes
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
