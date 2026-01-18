"use client";

import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useAllRoles } from "@saas/organizations/hooks/use-all-roles";

export function OrganizationRoleSelect({
	value,
	onSelect,
	disabled,
}: {
	value: string;
	onSelect: (value: string) => void;
	disabled?: boolean;
}) {
	const { staticRoles, customRoles, isLoading, getRoleLabel } = useAllRoles();

	if (isLoading) {
		return <Skeleton className="h-10 w-32" />;
	}

	return (
		<Select value={value} onValueChange={onSelect} disabled={disabled}>
			<SelectTrigger className="w-[180px]">
				<SelectValue>{getRoleLabel(value)}</SelectValue>
			</SelectTrigger>
			<SelectContent>
				<SelectGroup>
					<SelectLabel>Static Roles</SelectLabel>
					{staticRoles.map((role) => (
						<SelectItem key={role.value} value={role.value}>
							{role.label}
						</SelectItem>
					))}
				</SelectGroup>
				{customRoles.length > 0 && (
					<SelectGroup>
						<SelectLabel>Custom Roles</SelectLabel>
						{customRoles.map((role) => (
							<SelectItem key={role.value} value={role.value}>
								<div className="flex items-center gap-2">
									{role.color && (
										<span
											className="h-2 w-2 rounded-full"
											style={{
												backgroundColor: role.color,
											}}
										/>
									)}
									{role.label}
								</div>
							</SelectItem>
						))}
					</SelectGroup>
				)}
			</SelectContent>
		</Select>
	);
}
