"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Client } from "@repo/api/modules/studio/schemas/client";
import { Badge } from "@repo/ui/components/badge";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Textarea } from "@repo/ui/components/textarea";
import { useCallback, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { CollapsibleSection } from "../ui/CollapsibleSection";
import { FormActions } from "../ui/FormActions";

const SOURCE_SUGGESTIONS = [
	"Word of Mouth",
	"Instagram",
	"Google",
	"Referral",
	"Website",
] as const;

const clientFormSchema = z.object({
	name: z.string().min(1, "Name is required").max(255),
	email: z.string().email("Invalid email").optional().or(z.literal("")),
	phoneNumber: z
		.string()
		.min(10, "Phone number must be at least 10 digits")
		.optional()
		.or(z.literal("")),
	alternatePhone: z
		.string()
		.min(10, "Phone number must be at least 10 digits")
		.optional()
		.or(z.literal("")),
	address: z.string().max(1000).optional().or(z.literal("")),
	// Metadata fields
	profession: z.string().max(255).optional().or(z.literal("")),
	source: z.string().optional().or(z.literal("")),
	socialHandle: z.string().max(255).optional().or(z.literal("")),
	notes: z.string().max(2000).optional().or(z.literal("")),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;

interface ClientFormProps {
	defaultValues?: Client;
	onSubmit: (data: ClientFormValues) => Promise<void>;
	mode: "create" | "edit";
	isPending?: boolean;
	onScrollChange?: (isScrolled: boolean) => void;
}

export function ClientForm({
	defaultValues,
	onSubmit,
	mode,
	isPending = false,
	onScrollChange,
}: ClientFormProps) {
	// Extract metadata fields from Client type
	type ClientMetadata = {
		profession?: string;
		source?: string;
		socialHandle?: string;
		notes?: string;
	};

	const form = useForm<ClientFormValues>({
		resolver: zodResolver(clientFormSchema),
		defaultValues: {
			name: "",
			email: "",
			phoneNumber: "",
			alternatePhone: "",
			address: "",
			profession: "",
			source: "",
			socialHandle: "",
			notes: "",
		},
	});

	useEffect(() => {
		if (defaultValues) {
			const metadata = (defaultValues.metadata ?? {}) as ClientMetadata;
			form.reset({
				name: defaultValues.name,
				email: defaultValues.email ?? "",
				phoneNumber: defaultValues.phoneNumber ?? "",
				alternatePhone: defaultValues.alternatePhone ?? "",
				address: defaultValues.address ?? "",
				profession: metadata.profession ?? "",
				source: metadata.source ?? "",
				socialHandle: metadata.socialHandle ?? "",
				notes: metadata.notes ?? "",
			});
		}
	}, [defaultValues, form]);

	const isSubmitting = form.formState.isSubmitting || isPending;

	const handleScroll = useCallback(
		(event: React.UIEvent<HTMLDivElement>) => {
			const target = event.target as HTMLDivElement;
			const isScrolled = target.scrollTop > 0;
			onScrollChange?.(isScrolled);
		},
		[onScrollChange],
	);

	return (
		<form
			onSubmit={form.handleSubmit(onSubmit)}
			className="flex flex-col h-full min-h-0"
		>
			<ScrollArea
				className="flex-1 min-h-0"
				onScrollCapture={handleScroll}
			>
				<div className="px-4 py-4">
					<FieldGroup>
						{/* Essential Fields */}
						<Controller
							name="name"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>
										Name *
									</FieldLabel>
									<Input
										{...field}
										id={field.name}
										placeholder="Enter client name"
										aria-invalid={fieldState.invalid}
									/>
									{fieldState.invalid && (
										<FieldError
											errors={[fieldState.error]}
										/>
									)}
								</Field>
							)}
						/>

						<Controller
							name="email"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>
										Email
									</FieldLabel>
									<Input
										{...field}
										id={field.name}
										type="email"
										placeholder="email@example.com"
										aria-invalid={fieldState.invalid}
									/>
									{fieldState.invalid && (
										<FieldError
											errors={[fieldState.error]}
										/>
									)}
								</Field>
							)}
						/>

						{/* Contact Details - Always visible */}
						<div className="grid grid-cols-2 gap-4">
							<Controller
								name="phoneNumber"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Phone
										</FieldLabel>
										<Input
											{...field}
											id={field.name}
											placeholder="+91 9876543210"
											aria-invalid={fieldState.invalid}
										/>
										{fieldState.invalid && (
											<FieldError
												errors={[fieldState.error]}
											/>
										)}
									</Field>
								)}
							/>

							<Controller
								name="alternatePhone"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Alternate Phone
										</FieldLabel>
										<Input
											{...field}
											id={field.name}
											placeholder="+91 9876543210"
											aria-invalid={fieldState.invalid}
										/>
										{fieldState.invalid && (
											<FieldError
												errors={[fieldState.error]}
											/>
										)}
									</Field>
								)}
							/>
						</div>

						<Controller
							name="address"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>
										Address
									</FieldLabel>
									<Textarea
										{...field}
										id={field.name}
										placeholder="Enter full address"
										className="resize-none"
										rows={2}
										aria-invalid={fieldState.invalid}
									/>
									{fieldState.invalid && (
										<FieldError
											errors={[fieldState.error]}
										/>
									)}
								</Field>
							)}
						/>

						{/* Additional Info (Collapsible) - all fields full width */}
						<CollapsibleSection
							title="Additional Info"
							defaultOpen={mode === "edit"}
						>
							<FieldGroup>
								<Controller
									name="profession"
									control={form.control}
									render={({ field, fieldState }) => (
										<Field
											data-invalid={fieldState.invalid}
										>
											<FieldLabel htmlFor={field.name}>
												Profession
											</FieldLabel>
											<Input
												{...field}
												id={field.name}
												placeholder="e.g. Software Engineer, Doctor"
												aria-invalid={
													fieldState.invalid
												}
											/>
											{fieldState.invalid && (
												<FieldError
													errors={[fieldState.error]}
												/>
											)}
										</Field>
									)}
								/>

								<Controller
									name="source"
									control={form.control}
									render={({ field, fieldState }) => (
										<Field
											data-invalid={fieldState.invalid}
										>
											<FieldLabel htmlFor={field.name}>
												How did they find you?
											</FieldLabel>
											<Input
												{...field}
												id={field.name}
												placeholder="e.g. Instagram, Friend's referral"
												aria-invalid={
													fieldState.invalid
												}
											/>
											<div className="flex flex-wrap gap-1.5 pt-1.5">
												{SOURCE_SUGGESTIONS.map(
													(suggestion) => (
														<Badge
															key={suggestion}
															variant="outline"
															className="cursor-pointer hover:bg-accent transition-colors text-xs"
															onClick={() =>
																field.onChange(
																	suggestion,
																)
															}
														>
															{suggestion}
														</Badge>
													),
												)}
											</div>
											{fieldState.invalid && (
												<FieldError
													errors={[fieldState.error]}
												/>
											)}
										</Field>
									)}
								/>

								<Controller
									name="socialHandle"
									control={form.control}
									render={({ field, fieldState }) => (
										<Field
											data-invalid={fieldState.invalid}
										>
											<FieldLabel htmlFor={field.name}>
												Social Handle
											</FieldLabel>
											<Input
												{...field}
												id={field.name}
												placeholder="@instagram_handle"
												aria-invalid={
													fieldState.invalid
												}
											/>
											{fieldState.invalid && (
												<FieldError
													errors={[fieldState.error]}
												/>
											)}
										</Field>
									)}
								/>

								<Controller
									name="notes"
									control={form.control}
									render={({ field, fieldState }) => (
										<Field
											data-invalid={fieldState.invalid}
										>
											<FieldLabel htmlFor={field.name}>
												Notes
											</FieldLabel>
											<Textarea
												{...field}
												id={field.name}
												placeholder="Preferences, expectations, cultural considerations..."
												className="resize-none"
												rows={3}
												aria-invalid={
													fieldState.invalid
												}
											/>
											{fieldState.invalid && (
												<FieldError
													errors={[fieldState.error]}
												/>
											)}
										</Field>
									)}
								/>
							</FieldGroup>
						</CollapsibleSection>
					</FieldGroup>
				</div>
			</ScrollArea>

			<div className="shrink-0 border-t p-4 bg-background">
				<FormActions
					mode={mode}
					isSubmitting={isSubmitting}
					submitLabel={
						mode === "edit" ? "Save Changes" : "Add Client"
					}
				/>
			</div>
		</form>
	);
}
