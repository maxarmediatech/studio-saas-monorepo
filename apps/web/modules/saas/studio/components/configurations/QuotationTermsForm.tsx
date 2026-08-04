"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Configuration } from "@repo/api/modules/studio/schemas/configuration";
import { quotationTermsMetadataV1Schema } from "@repo/api/modules/studio/schemas/quotation-document";
import { Button } from "@repo/ui/components/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Switch } from "@repo/ui/components/switch";
import { Textarea } from "@repo/ui/components/textarea";
import { configurationsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import {
	ChevronDownIcon,
	ChevronUpIcon,
	PlusIcon,
	TrashIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { FormActions } from "../ui/FormActions";

const clauseSchema = z.object({
	key: z.string().min(1),
	text: z.string().max(5000),
});
const milestoneSchema = z.object({
	key: z.string().min(1),
	label: z.string().trim().min(1, "Label is required").max(255),
	percentage: z
		.string()
		.regex(/^\d+(\.\d{1,2})?$/, "Enter a valid percentage"),
	timing: z.string().trim().min(1, "Timing is required").max(500),
});
const quotationTermsFormSchema = z
	.object({
		label: z.string().trim().min(1, "Name is required").max(255),
		description: z.string().max(1000).optional(),
		bookingType: z.string().optional(),
		isDefault: z.boolean(),
		deliveryTimelines: z.array(clauseSchema).max(50),
		paymentMilestones: z.array(milestoneSchema).length(3),
		fixedTerms: z.array(clauseSchema).max(50),
	})
	.superRefine((value, ctx) => {
		const total = value.paymentMilestones.reduce(
			(sum, item) => sum + Math.round(Number(item.percentage) * 100),
			0,
		);
		if (total !== 10_000) {
			ctx.addIssue({
				code: "custom",
				path: ["paymentMilestones"],
				message: "Payment percentages must total 100.00",
			});
		}
	});

export type QuotationTermsFormValues = z.infer<typeof quotationTermsFormSchema>;

const neutralMilestones = [
	{
		key: "advance",
		label: "Advance",
		percentage: "40",
		timing: "Booking confirmation and team allotment",
	},
	{
		key: "raw-data",
		label: "Second installment",
		percentage: "50",
		timing: "At the time of raw data transfer",
	},
	{
		key: "delivery",
		label: "Final installment",
		percentage: "10",
		timing: "At the time of delivery",
	},
];

export function QuotationTermsForm({
	defaultValues,
	onSubmit,
	mode,
	isPending = false,
	onScrollChange,
}: {
	defaultValues?: Configuration;
	onSubmit: (data: QuotationTermsFormValues) => Promise<void>;
	mode: "create" | "edit";
	isPending?: boolean;
	onScrollChange?: (isScrolled: boolean) => void;
}) {
	const { data: bookingTypesData } = useQuery(
		configurationsApi.bookingTypesOptions(),
	);
	const bookingTypes = bookingTypesData?.data ?? [];
	const form = useForm<QuotationTermsFormValues>({
		resolver: zodResolver(quotationTermsFormSchema),
		defaultValues: {
			label: "",
			description: "",
			bookingType: "all",
			isDefault: false,
			deliveryTimelines: [],
			paymentMilestones: neutralMilestones,
			fixedTerms: [],
		},
	});
	const { reset } = form;
	const resetConfigurationId = useRef<string | null>(null);
	const timelines = useFieldArray({
		control: form.control,
		name: "deliveryTimelines",
	});
	const payments = useFieldArray({
		control: form.control,
		name: "paymentMilestones",
	});
	const terms = useFieldArray({ control: form.control, name: "fixedTerms" });

	useEffect(() => {
		if (
			!defaultValues ||
			resetConfigurationId.current === defaultValues.id
		) {
			return;
		}
		const metadata = quotationTermsMetadataV1Schema.safeParse(
			defaultValues.metadata,
		);
		if (!metadata.success) {
			return;
		}
		reset({
			label: defaultValues.label,
			description: defaultValues.description ?? "",
			bookingType: defaultValues.bookingTypeFilter ?? "all",
			isDefault: defaultValues.isDefault,
			deliveryTimelines: metadata.data.deliveryTimelines,
			paymentMilestones: metadata.data.paymentMilestones,
			fixedTerms: metadata.data.fixedTerms,
		});
		resetConfigurationId.current = defaultValues.id;
	}, [defaultValues, reset]);

	const handleScroll = useCallback(
		(event: React.UIEvent<HTMLDivElement>) =>
			onScrollChange?.((event.target as HTMLDivElement).scrollTop > 0),
		[onScrollChange],
	);
	const isSubmitting = form.formState.isSubmitting || isPending;

	return (
		<form
			onSubmit={form.handleSubmit(onSubmit)}
			className="flex h-full min-h-0 flex-col"
		>
			<ScrollArea
				className="min-h-0 flex-1"
				onScrollCapture={handleScroll}
			>
				<div className="space-y-7 px-4 py-4">
					<FieldGroup>
						<Field
							data-invalid={Boolean(form.formState.errors.label)}
						>
							<FieldLabel htmlFor="terms-preset-label">
								Preset name *
							</FieldLabel>
							<Input
								id="terms-preset-label"
								{...form.register("label")}
							/>
							<FieldError
								errors={[form.formState.errors.label]}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="terms-preset-description">
								Description
							</FieldLabel>
							<Textarea
								id="terms-preset-description"
								rows={2}
								{...form.register("description")}
							/>
						</Field>
						<Controller
							control={form.control}
							name="bookingType"
							render={({ field }) => (
								<Field>
									<FieldLabel>Booking type</FieldLabel>
									<Select
										value={field.value}
										onValueChange={field.onChange}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">
												All booking types
											</SelectItem>
											{bookingTypes.map((item) => (
												<SelectItem
													key={item.id}
													value={item.key}
												>
													{item.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FieldDescription>
										Only show this preset for the selected
										quotation type.
									</FieldDescription>
								</Field>
							)}
						/>
						<Controller
							control={form.control}
							name="isDefault"
							render={({ field }) => (
								<Field
									orientation="horizontal"
									className="rounded-lg border p-3"
								>
									<div>
										<FieldLabel>Default preset</FieldLabel>
										<FieldDescription>
											Copy into eligible new quotations
											once.
										</FieldDescription>
									</div>
									<Switch
										checked={field.value}
										onCheckedChange={field.onChange}
									/>
								</Field>
							)}
						/>
					</FieldGroup>

					<ClauseEditor
						title="Delivery timelines"
						fields={timelines.fields}
						register={(index) =>
							form.register(`deliveryTimelines.${index}.text`)
						}
						onAdd={() =>
							timelines.append({
								key: `timeline-${crypto.randomUUID()}`,
								text: "",
							})
						}
						onRemove={timelines.remove}
						onMove={timelines.move}
					/>

					<section className="space-y-3">
						<div>
							<p className="text-sm font-medium">
								Payment milestones
							</p>
							<p className="text-sm text-muted-foreground">
								Exactly three rows; percentages must total 100.
							</p>
						</div>
						{payments.fields.map((field, index) => (
							<div
								key={field.id}
								className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_110px]"
							>
								<Input
									aria-label={`Milestone ${index + 1} label`}
									{...form.register(
										`paymentMilestones.${index}.label`,
									)}
								/>
								<Input
									aria-label={`Milestone ${index + 1} percentage`}
									{...form.register(
										`paymentMilestones.${index}.percentage`,
									)}
								/>
								<Textarea
									aria-label={`Milestone ${index + 1} timing`}
									className="sm:col-span-2"
									{...form.register(
										`paymentMilestones.${index}.timing`,
									)}
								/>
							</div>
						))}
						{form.formState.errors.paymentMilestones?.root
							?.message ? (
							<p className="text-sm text-destructive">
								{
									form.formState.errors.paymentMilestones.root
										.message
								}
							</p>
						) : null}
					</section>

					<ClauseEditor
						title="Fixed terms and clauses"
						fields={terms.fields}
						register={(index) =>
							form.register(`fixedTerms.${index}.text`)
						}
						onAdd={() =>
							terms.append({
								key: `term-${crypto.randomUUID()}`,
								text: "",
							})
						}
						onRemove={terms.remove}
						onMove={terms.move}
					/>
				</div>
			</ScrollArea>
			<div className="shrink-0 border-t bg-background p-4">
				<FormActions mode={mode} isSubmitting={isSubmitting} />
			</div>
		</form>
	);
}

function ClauseEditor({
	title,
	fields,
	register,
	onAdd,
	onRemove,
	onMove,
}: {
	title: string;
	fields: Array<{ id: string }>;
	register: (index: number) => Record<string, unknown>;
	onAdd: () => void;
	onRemove: (index: number) => void;
	onMove: (from: number, to: number) => void;
}) {
	return (
		<section className="space-y-3">
			<p className="text-sm font-medium">{title}</p>
			{fields.map((field, index) => (
				<div className="flex items-start gap-2" key={field.id}>
					<Textarea className="min-h-16" {...register(index)} />
					<div className="flex shrink-0 flex-col">
						<Button
							type="button"
							size="icon"
							variant="ghost"
							aria-label={`Move ${title.toLowerCase()} item ${index + 1} up`}
							disabled={index === 0}
							onClick={() => onMove(index, index - 1)}
						>
							<ChevronUpIcon className="size-4" />
						</Button>
						<Button
							type="button"
							size="icon"
							variant="ghost"
							aria-label={`Move ${title.toLowerCase()} item ${index + 1} down`}
							disabled={index === fields.length - 1}
							onClick={() => onMove(index, index + 1)}
						>
							<ChevronDownIcon className="size-4" />
						</Button>
						<Button
							type="button"
							size="icon"
							variant="ghost"
							aria-label={`Remove ${title.toLowerCase()} item ${index + 1}`}
							onClick={() => onRemove(index)}
						>
							<TrashIcon className="size-4" />
						</Button>
					</div>
				</div>
			))}
			<Button type="button" variant="outline" onClick={onAdd}>
				<PlusIcon className="mr-2 size-4" />
				Add item
			</Button>
		</section>
	);
}
