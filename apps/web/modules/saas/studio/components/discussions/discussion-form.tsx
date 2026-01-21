"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Combobox, type ComboboxOption } from "@repo/ui/components/combobox";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Textarea } from "@repo/ui/components/textarea";
import { discussionsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { FormActions } from "../ui/FormActions";
import { type EntityLink, EntityLinkPicker } from "./entity-link-picker";

// ============================================================================
// Schema
// ============================================================================

const discussionFormSchema = z.object({
	channelId: z.string().min(1, "Channel is required"),
	title: z.string().min(1, "Title is required").max(200),
	content: z.string().max(10000).optional().or(z.literal("")),
	links: z.array(
		z.object({
			entityType: z.enum([
				"booking",
				"shoot",
				"deliverable",
				"task",
				"payment_schedule",
				"expense",
			]),
			entityId: z.string().min(1),
			label: z.string().optional(),
		}),
	),
});

export type DiscussionFormValues = z.infer<typeof discussionFormSchema>;

// ============================================================================
// Types
// ============================================================================

interface DiscussionFormProps {
	defaultChannelId?: string;
	defaultLinks?: EntityLink[];
	onSubmit: (data: DiscussionFormValues) => Promise<void>;
	isPending?: boolean;
	onScrollChange?: (isScrolled: boolean) => void;
}

// ============================================================================
// Component
// ============================================================================

export function DiscussionForm({
	defaultChannelId,
	defaultLinks,
	onSubmit,
	isPending = false,
	onScrollChange,
}: DiscussionFormProps) {
	const { data: channelsData, isLoading: channelsLoading } = useQuery(
		discussionsApi.listChannelsOptions(),
	);
	const channels = channelsData?.data ?? [];

	const form = useForm<DiscussionFormValues>({
		resolver: zodResolver(discussionFormSchema),
		defaultValues: {
			channelId: defaultChannelId ?? "",
			title: "",
			content: "",
			links: defaultLinks ?? [],
		},
	});

	useEffect(() => {
		if (defaultChannelId && !form.getValues("channelId")) {
			form.setValue("channelId", defaultChannelId);
		}
	}, [defaultChannelId, form]);

	useEffect(() => {
		if (defaultLinks && defaultLinks.length > 0) {
			form.setValue("links", defaultLinks);
		}
	}, [defaultLinks, form]);

	const isSubmitting = form.formState.isSubmitting || isPending;

	const channelOptions = useMemo((): ComboboxOption[] => {
		return channels.map((c) => ({
			value: c.id,
			label: `# ${c.name}`,
		}));
	}, [channels]);

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
						<Controller
							name="channelId"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>
										Channel *
									</FieldLabel>
									<Combobox
										id={field.name}
										value={field.value}
										onValueChange={field.onChange}
										options={channelOptions}
										placeholder={
											channelsLoading
												? "Loading..."
												: "Select channel..."
										}
										searchPlaceholder="Search channels..."
										emptyText="No channels found"
										disabled={channelsLoading}
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
							name="title"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>
										Title *
									</FieldLabel>
									<Input
										{...field}
										id={field.name}
										placeholder="What do you want to discuss?"
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
							name="content"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>
										Details
									</FieldLabel>
									<Textarea
										{...field}
										id={field.name}
										placeholder="Add more context (optional)"
										className="resize-none"
										rows={4}
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
							name="links"
							control={form.control}
							render={({ field }) => (
								<Field>
									<FieldLabel>Related Items</FieldLabel>
									<EntityLinkPicker
										value={field.value}
										onChange={field.onChange}
										disabled={isSubmitting}
									/>
								</Field>
							)}
						/>
					</FieldGroup>
				</div>
			</ScrollArea>

			<div className="shrink-0 border-t p-4 bg-background">
				<FormActions
					mode="create"
					isSubmitting={isSubmitting}
					submitLabel="Create Discussion"
				/>
			</div>
		</form>
	);
}
