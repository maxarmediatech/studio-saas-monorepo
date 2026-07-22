"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Client } from "@repo/api/modules/studio/schemas/client";
import { Badge } from "@repo/ui/components/badge";
import { FieldGroup } from "@repo/ui/components/field";
import {
	CustomField,
	TextareaField,
	TextField,
} from "@repo/ui/components/form-fields";
import { FieldRow, FormSection } from "@repo/ui/components/form-section";
import { Input } from "@repo/ui/components/input";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
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
						<FormSection>
							<TextField
								control={form.control}
								name="name"
								label="Name"
								placeholder="Enter client name"
								required
							/>

							<TextField
								control={form.control}
								name="email"
								label="Email"
								type="email"
								placeholder="email@example.com"
							/>

							{/* Contact Details - Always visible */}
							<FieldRow>
								<TextField
									control={form.control}
									name="phoneNumber"
									label="Phone"
									placeholder="+91 9876543210"
								/>

								<TextField
									control={form.control}
									name="alternatePhone"
									label="Alternate Phone"
									placeholder="+91 9876543210"
								/>
							</FieldRow>

							<TextareaField
								control={form.control}
								name="address"
								label="Address"
								placeholder="Enter full address"
								rows={2}
							/>
						</FormSection>

						{/* Additional Info (Collapsible) - all fields full width */}
						<CollapsibleSection
							title="Additional Info"
							defaultOpen={mode === "edit"}
						>
							<FormSection>
								<TextField
									control={form.control}
									name="profession"
									label="Profession"
									placeholder="e.g. Software Engineer, Doctor"
								/>

								<CustomField
									control={form.control}
									name="source"
									label="How did they find you?"
								>
									{({ field, fieldState }) => (
										<>
											<Input
												{...field}
												id={field.name}
												size="sm"
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
										</>
									)}
								</CustomField>

								<TextField
									control={form.control}
									name="socialHandle"
									label="Social Handle"
									placeholder="@instagram_handle"
								/>

								<TextareaField
									control={form.control}
									name="notes"
									label="Notes"
									placeholder="Preferences, expectations, cultural considerations..."
									rows={3}
								/>
							</FormSection>
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
