"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type {
	BulkInviteOutput,
	BulkInviteStatus,
} from "@repo/api/modules/organizations/lib/bulk-invitations";
import {
	BULK_INVITE_MAX_EMAILS,
	parseBulkInviteText,
	splitBulkInviteEmails,
} from "@repo/api/modules/organizations/lib/bulk-invitations";
import { Button } from "@repo/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@repo/ui/components/form";
import { Textarea } from "@repo/ui/components/textarea";
import { cn } from "@repo/ui/lib/utils";
import { OrganizationRoleSelect } from "@saas/organizations/components/OrganizationRoleSelect";
import { OrganizationTeamSelect } from "@saas/organizations/components/OrganizationTeamSelect";
import {
	fullOrganizationQueryKey,
	useBulkInviteMembersMutation,
} from "@saas/organizations/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
	emails: z.string().trim().min(1),
	role: z.array(z.string()).min(1),
	teamId: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const resultToneByStatus: Record<BulkInviteStatus, string> = {
	created:
		"border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
	duplicate_in_batch:
		"border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
	already_member:
		"border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300",
	already_invited:
		"border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300",
	invalid_email:
		"border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
	forbidden:
		"border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
	limit_reached:
		"border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
	failed: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
};

interface InviteMemberDialogProps {
	organizationId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	defaultEmail?: string;
	title?: string;
	description?: string;
	submitLabel?: string;
}

export function InviteMemberDialog({
	organizationId,
	open,
	onOpenChange,
	defaultEmail,
	title,
	description,
	submitLabel,
}: InviteMemberDialogProps) {
	const t = useTranslations();
	const queryClient = useQueryClient();
	const bulkInviteMutation = useBulkInviteMembersMutation();
	const [bulkInviteResult, setBulkInviteResult] =
		useState<BulkInviteOutput | null>(null);
	const defaultFormValues = useMemo<FormValues>(
		() => ({
			emails: defaultEmail ?? "",
			role: ["member"],
			teamId: null,
		}),
		[defaultEmail],
	);

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: defaultFormValues,
	});
	const resetFormRef = useRef(form.reset);
	const resetMutationRef = useRef(bulkInviteMutation.reset);

	const emailsValue = form.watch("emails");
	const parsedEmails = useMemo(
		() => parseBulkInviteText(emailsValue),
		[emailsValue],
	);
	const limitExceeded = parsedEmails.normalizedCount > BULK_INVITE_MAX_EMAILS;

	useEffect(() => {
		resetFormRef.current = form.reset;
		resetMutationRef.current = bulkInviteMutation.reset;
	}, [bulkInviteMutation.reset, form.reset]);

	useEffect(() => {
		if (!open) {
			resetFormRef.current(defaultFormValues);
			setBulkInviteResult(null);
			resetMutationRef.current();
		}
	}, [defaultFormValues, open]);

	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen) {
			setBulkInviteResult(null);
			bulkInviteMutation.reset();
		}

		onOpenChange(nextOpen);
	};

	const onSubmit: SubmitHandler<FormValues> = async (values) => {
		const emails = splitBulkInviteEmails(values.emails);
		const parsedBatch = parseBulkInviteText(values.emails);

		if (parsedBatch.normalizedCount > BULK_INVITE_MAX_EMAILS) {
			return;
		}

		try {
			setBulkInviteResult(null);

			const response = await bulkInviteMutation.mutateAsync({
				emails,
				role: values.role,
				teamId: values.teamId ?? null,
			});

			setBulkInviteResult(response);

			if (response.summary.created > 0) {
				await queryClient.invalidateQueries({
					queryKey: fullOrganizationQueryKey(organizationId),
				});
			}

			if (
				response.summary.created === response.results.length &&
				response.results.length > 0
			) {
				toast.success(
					t(
						"organizations.settings.members.bulkInvite.notifications.success.title",
					),
					{
						description: t(
							"organizations.settings.members.bulkInvite.notifications.success.description",
							{
								count: response.summary.created,
							},
						),
					},
				);
				handleOpenChange(false);
				return;
			}

			if (response.summary.created > 0) {
				toast.success(
					t(
						"organizations.settings.members.bulkInvite.notifications.partial.title",
					),
					{
						description: t(
							"organizations.settings.members.bulkInvite.notifications.partial.description",
							{
								created: response.summary.created,
								skipped: response.summary.skipped,
								failed: response.summary.failed,
							},
						),
					},
				);
				return;
			}

			toast.error(
				t(
					"organizations.settings.members.bulkInvite.notifications.none.title",
				),
				{
					description: t(
						"organizations.settings.members.bulkInvite.notifications.none.description",
					),
				},
			);
		} catch (error) {
			toast.error(
				t(
					"organizations.settings.members.bulkInvite.notifications.error.title",
				),
				{
					description:
						error instanceof Error
							? error.message
							: t(
									"organizations.settings.members.bulkInvite.notifications.error.description",
								),
				},
			);
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-[560px]">
				<DialogHeader>
					<DialogTitle>
						{title ??
							t(
								"organizations.settings.members.bulkInvite.title",
							)}
					</DialogTitle>
					<DialogDescription>
						{description ??
							t(
								"organizations.settings.members.bulkInvite.description",
								{
									max: BULK_INVITE_MAX_EMAILS,
								},
							)}
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="space-y-4"
					>
						<FormField
							control={form.control}
							name="emails"
							render={({ field }) => (
								<FormItem>
									<FormLabel>
										{t(
											"organizations.settings.members.bulkInvite.emails",
										)}
									</FormLabel>
									<FormControl>
										<Textarea
											{...field}
											rows={5}
											autoCapitalize="none"
											autoCorrect="off"
											placeholder="alex@example.com, sam@example.com"
										/>
									</FormControl>
									<FormDescription
										className={cn(
											limitExceeded && "text-destructive",
										)}
									>
										{t(
											"organizations.settings.members.bulkInvite.hint",
											{
												max: BULK_INVITE_MAX_EMAILS,
											},
										)}
									</FormDescription>
									<div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
										<span
											className={cn(
												limitExceeded &&
													"text-destructive",
											)}
										>
											{t(
												"organizations.settings.members.bulkInvite.parsedCount",
												{
													count: parsedEmails.normalizedCount,
												},
											)}
										</span>
										{parsedEmails.duplicateCount > 0 ? (
											<span>
												{t(
													"organizations.settings.members.bulkInvite.duplicateCount",
													{
														count: parsedEmails.duplicateCount,
													},
												)}
											</span>
										) : null}
										{parsedEmails.invalidCount > 0 ? (
											<span>
												{t(
													"organizations.settings.members.bulkInvite.invalidCount",
													{
														count: parsedEmails.invalidCount,
													},
												)}
											</span>
										) : null}
									</div>
									{limitExceeded ? (
										<p className="text-destructive text-xs">
											{t(
												"organizations.settings.members.bulkInvite.limitError",
												{
													max: BULK_INVITE_MAX_EMAILS,
												},
											)}
										</p>
									) : null}
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="role"
							render={({ field }) => (
								<FormItem>
									<FormLabel>
										{t(
											"organizations.settings.members.inviteMember.role",
										)}
									</FormLabel>
									<FormControl>
										<OrganizationRoleSelect
											value={field.value}
											onSelect={field.onChange}
											enabled={open}
											excludeOwnerRole
										/>
									</FormControl>
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="teamId"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Team</FormLabel>
									<FormControl>
										<OrganizationTeamSelect
											organizationId={organizationId}
											value={field.value}
											onSelect={field.onChange}
											enabled={open}
										/>
									</FormControl>
								</FormItem>
							)}
						/>

						{bulkInviteResult ? (
							<div className="space-y-3 rounded-lg border bg-muted/30 p-3">
								<div className="space-y-1">
									<p className="text-sm font-medium">
										{t(
											"organizations.settings.members.bulkInvite.resultsTitle",
										)}
									</p>
									<p className="text-xs text-muted-foreground">
										{t(
											"organizations.settings.members.bulkInvite.resultsSummary",
											{
												created:
													bulkInviteResult.summary
														.created,
												skipped:
													bulkInviteResult.summary
														.skipped,
												failed: bulkInviteResult.summary
													.failed,
											},
										)}
									</p>
								</div>

								<div className="max-h-60 space-y-2 overflow-y-auto pr-1">
									{bulkInviteResult.results.map(
										(result, index) => (
											<div
												key={`${result.email}-${result.status}-${index}`}
												className="flex items-start justify-between gap-3 rounded-md border bg-background p-3"
											>
												<div className="min-w-0">
													<p className="truncate text-sm font-medium">
														{result.email}
													</p>
													{result.message ? (
														<p className="mt-1 text-xs text-muted-foreground">
															{result.message}
														</p>
													) : null}
												</div>
												<span
													className={cn(
														"shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium",
														resultToneByStatus[
															result.status
														],
													)}
												>
													{t(
														`organizations.settings.members.bulkInvite.status.${result.status}`,
													)}
												</span>
											</div>
										),
									)}
								</div>
							</div>
						) : null}

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => handleOpenChange(false)}
								disabled={form.formState.isSubmitting}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={
									form.formState.isSubmitting || limitExceeded
								}
							>
								{form.formState.isSubmitting && (
									<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
								)}
								{submitLabel ??
									t(
										"organizations.settings.members.bulkInvite.submit",
									)}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
