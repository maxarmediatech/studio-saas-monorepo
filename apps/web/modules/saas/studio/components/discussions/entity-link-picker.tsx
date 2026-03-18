"use client";

import type { DiscussionLinkEntityType } from "@repo/api/modules/discussions/schemas";
import { Button } from "@repo/ui/components/button";
import { Combobox, type ComboboxOption } from "@repo/ui/components/combobox";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import {
	bookingsApi,
	deliverablesApi,
	expensesApi,
	shootsApi,
	studioPaymentsApi,
	tasksApi,
} from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import {
	CalendarIcon,
	CheckSquareIcon,
	CreditCardIcon,
	FileOutputIcon,
	Link2Icon,
	PlusIcon,
	ReceiptIcon,
	XIcon,
} from "lucide-react";
import { useMemo } from "react";
import { useStudioCapabilities } from "../studio-capabilities-context";

export interface EntityLink {
	entityType: DiscussionLinkEntityType;
	entityId: string;
	label?: string;
}

interface EntityLinkPickerProps {
	value: EntityLink[];
	onChange: (links: EntityLink[]) => void;
	disabled?: boolean;
}

const ENTITY_TYPE_CONFIG: Record<
	DiscussionLinkEntityType,
	{ label: string; icon: React.ReactNode; color: string }
> = {
	booking: {
		label: "Booking",
		icon: <CalendarIcon className="size-4" />,
		color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
	},
	shoot: {
		label: "Shoot",
		icon: <CalendarIcon className="size-4" />,
		color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
	},
	deliverable: {
		label: "Deliverable",
		icon: <FileOutputIcon className="size-4" />,
		color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
	},
	task: {
		label: "Task",
		icon: <CheckSquareIcon className="size-4" />,
		color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
	},
	payment_schedule: {
		label: "Payment",
		icon: <CreditCardIcon className="size-4" />,
		color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
	},
	expense: {
		label: "Expense",
		icon: <ReceiptIcon className="size-4" />,
		color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
	},
};

const ENTITY_TYPES: DiscussionLinkEntityType[] = [
	"booking",
	"shoot",
	"deliverable",
	"task",
	"payment_schedule",
	"expense",
];

export function EntityLinkPicker({
	value,
	onChange,
	disabled = false,
}: EntityLinkPickerProps) {
	const {
		bookingReadOrList,
		shootReadOrList,
		deliverableReadOrList,
		taskReadOrList,
		expenseReadOrReference,
		paymentReadOrReference,
	} = useStudioCapabilities();
	const availableEntityTypes = useMemo(
		() =>
			ENTITY_TYPES.filter((type) => {
				switch (type) {
					case "booking":
						return bookingReadOrList;
					case "shoot":
						return shootReadOrList;
					case "deliverable":
						return deliverableReadOrList;
					case "task":
						return taskReadOrList;
					case "payment_schedule":
						return paymentReadOrReference;
					case "expense":
						return expenseReadOrReference;
					default:
						return false;
				}
			}),
		[
			bookingReadOrList,
			deliverableReadOrList,
			expenseReadOrReference,
			paymentReadOrReference,
			shootReadOrList,
			taskReadOrList,
		],
	);
	const selectableEntityTypes = useMemo(
		() =>
			Array.from(
				new Set([
					...availableEntityTypes,
					...value.map((link) => link.entityType),
				]),
			),
		[availableEntityTypes, value],
	);
	const { data: bookingsData } = useQuery({
		...bookingsApi.listMinimalOptions({}),
		staleTime: 30000,
		enabled: bookingReadOrList,
	});
	const { data: shootsData } = useQuery({
		...shootsApi.listMinimalOptions({}),
		staleTime: 30000,
		enabled: shootReadOrList,
	});
	const { data: deliverablesData } = useQuery({
		...deliverablesApi.listMinimalOptions({}),
		staleTime: 30000,
		enabled: deliverableReadOrList,
	});
	const { data: tasksData } = useQuery({
		...tasksApi.listMinimalOptions({}),
		staleTime: 30000,
		enabled: taskReadOrList,
	});
	const { data: schedulesData } = useQuery({
		...studioPaymentsApi.listSchedulesMinimalOptions({}),
		staleTime: 30000,
		enabled: paymentReadOrReference,
	});
	const { data: expensesData } = useQuery({
		...expensesApi.listMinimalOptions({}),
		staleTime: 30000,
		enabled: expenseReadOrReference,
	});

	const optionsByType = useMemo((): Record<
		DiscussionLinkEntityType,
		ComboboxOption[]
	> => {
		return {
			booking: (bookingsData?.data ?? []).map((b) => ({
				value: b.id,
				label: b.name,
				description: b.referenceNumber,
			})),
			shoot: (shootsData?.data ?? []).map((s) => ({
				value: s.id,
				label: s.name,
				description: s.shootType,
			})),
			deliverable: (deliverablesData?.data ?? []).map((d) => ({
				value: d.id,
				label: d.name,
				description: d.status,
			})),
			task: (tasksData?.data ?? []).map((t) => ({
				value: t.id,
				label: t.name,
				description: t.status,
			})),
			payment_schedule: (schedulesData?.data ?? []).map((s) => ({
				value: s.id,
				label: s.name,
				description: s.status,
			})),
			expense: (expensesData?.data ?? []).map((e) => ({
				value: e.id,
				label: e.description,
				description: e.category ?? undefined,
			})),
		};
	}, [
		bookingsData,
		shootsData,
		deliverablesData,
		tasksData,
		schedulesData,
		expensesData,
	]);

	const handleAddRow = () => {
		const defaultEntityType = availableEntityTypes[0];
		if (!defaultEntityType) {
			return;
		}

		onChange([
			...value,
			{ entityType: defaultEntityType, entityId: "", label: "" },
		]);
	};

	const handleRemoveRow = (index: number) => {
		const newValue = [...value];
		newValue.splice(index, 1);
		onChange(newValue);
	};

	const handleTypeChange = (
		index: number,
		newType: DiscussionLinkEntityType,
	) => {
		const newValue = [...value];
		newValue[index] = { entityType: newType, entityId: "", label: "" };
		onChange(newValue);
	};

	const handleEntityChange = (index: number, entityId: string) => {
		const newValue = [...value];
		const options = optionsByType[newValue[index].entityType];
		const selectedOption = options.find((o) => o.value === entityId);
		newValue[index] = {
			...newValue[index],
			entityId,
			label: selectedOption?.label ?? "",
		};
		onChange(newValue);
	};

	const hasIncompleteRow = value.some((link) => !link.entityId);

	if (value.length === 0) {
		return (
			<button
				type="button"
				onClick={handleAddRow}
				disabled={disabled}
				className="w-full rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-center transition-colors hover:border-muted-foreground/40 hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				<Link2Icon className="mx-auto size-6 text-muted-foreground/60" />
				<p className="mt-2 text-sm font-medium text-muted-foreground">
					Add related item
				</p>
				<p className="mt-1 text-xs text-muted-foreground/60">
					Connect this discussion to a booking, task, or other item
				</p>
			</button>
		);
	}

	return (
		<div className="space-y-3">
			{value.map((link, index) => {
				const typeOptions = optionsByType[link.entityType];
				const config = ENTITY_TYPE_CONFIG[link.entityType];

				return (
					<div key={index} className="flex items-center gap-2">
						<Select
							value={link.entityType}
							onValueChange={(v) =>
								handleTypeChange(
									index,
									v as DiscussionLinkEntityType,
								)
							}
							disabled={disabled}
						>
							<SelectTrigger className="w-[140px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{selectableEntityTypes.map((type) => (
									<SelectItem key={type} value={type}>
										<div className="flex items-center gap-2">
											{ENTITY_TYPE_CONFIG[type].icon}
											{ENTITY_TYPE_CONFIG[type].label}
										</div>
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<Combobox
							value={link.entityId}
							onValueChange={(v) => handleEntityChange(index, v)}
							options={typeOptions}
							placeholder={`Select ${config.label.toLowerCase()}...`}
							searchPlaceholder={`Search ${config.label.toLowerCase()}s...`}
							emptyText={`No ${config.label.toLowerCase()}s found`}
							disabled={disabled}
							className="flex-1"
						/>

						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={() => handleRemoveRow(index)}
							disabled={disabled}
							className="shrink-0 size-9 text-muted-foreground hover:text-destructive"
						>
							<XIcon className="size-4" />
							<span className="sr-only">Remove</span>
						</Button>
					</div>
				);
			})}

			<button
				type="button"
				onClick={handleAddRow}
				disabled={disabled || hasIncompleteRow}
				className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/25 py-2 text-sm text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				<PlusIcon className="size-4" />
				Add another
			</button>
		</div>
	);
}

export { ENTITY_TYPE_CONFIG };
