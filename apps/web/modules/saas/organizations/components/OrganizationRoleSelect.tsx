"use client";

import {
	coerceOrganizationRoles,
	hasAnyRole,
} from "@repo/auth/lib/permissions";
import { Badge } from "@repo/ui/components/badge";
import { MultiSelectCombobox } from "@repo/ui/components/multi-select-combobox";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useAllRoles } from "@saas/organizations/hooks/use-all-roles";
import { XIcon } from "lucide-react";

export function OrganizationRoleSelect({
	value,
	onSelect,
	disabled,
	excludeOwnerRole = false,
}: {
	value: string[];
	onSelect: (value: string[]) => void;
	disabled?: boolean;
	excludeOwnerRole?: boolean;
}) {
	const { staticRoles, customRoles, isLoading, getRoleLabel } = useAllRoles();
	const normalizedValue = coerceOrganizationRoles(value);
	const lockMemberRole = !hasAnyRole(normalizedValue, ["owner", "admin"]);

	if (isLoading) {
		return <Skeleton className="h-10 w-32" />;
	}

	const options = [
		...staticRoles
			.filter((role) => !(excludeOwnerRole && role.value === "owner"))
			.map((role) => ({
				value: role.value,
				label: role.label,
				color: undefined as string | undefined,
				isStatic: true,
			})),
		...customRoles.map((role) => ({
			value: role.value,
			label: role.label,
			color: role.color,
			isStatic: false,
		})),
	];

	return (
		<MultiSelectCombobox
			options={options}
			value={normalizedValue}
			onValueChange={(nextValue) =>
				onSelect(coerceOrganizationRoles(nextValue))
			}
			placeholder="Select roles..."
			searchPlaceholder="Search roles..."
			emptyText="No roles found."
			disabled={disabled}
			className="w-[220px]"
			renderOption={(option) => (
				<div className="flex items-center gap-2">
					{option.color && (
						<span
							className="h-2 w-2 rounded-full"
							style={{ backgroundColor: option.color }}
						/>
					)}
					<span>{option.label}</span>
				</div>
			)}
			renderSelectedItem={(option, onRemove) => {
				const lockRemove =
					disabled || (lockMemberRole && option.value === "member");
				return (
					<Badge
						variant="secondary"
						className="flex items-center gap-1 pr-1"
					>
						{option.color && (
							<span
								className="h-2 w-2 rounded-full"
								style={{ backgroundColor: option.color }}
							/>
						)}
						<span className="truncate">
							{getRoleLabel(option.value)}
						</span>
						{!lockRemove && (
							<button
								type="button"
								onClick={(event) => {
									event.stopPropagation();
									onRemove();
								}}
								className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
							>
								<XIcon className="size-3" />
								<span className="sr-only">
									Remove {option.label}
								</span>
							</button>
						)}
					</Badge>
				);
			}}
		/>
	);
}
