"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import { setActiveOrganizationSlugCookie } from "@saas/organizations/lib/active-organization-cookie";
import {
	organizationListQueryKey,
	useCreateOrganizationMutation,
} from "@saas/organizations/lib/api";
import { useRouter } from "@shared/hooks/router";
import { sanitizeRedirectPath } from "@shared/lib/sanitize-redirect-path";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
	name: z.string().min(3).max(32),
});

type FormValues = z.infer<typeof formSchema>;

export function CreateOrganizationForm({
	defaultName,
	redirectTo,
	backHref,
	organizationToEdit,
}: {
	defaultName?: string;
	redirectTo?: string;
	backHref?: string;
	organizationToEdit?: {
		id: string;
		slug: string;
		name: string;
	};
}) {
	const t = useTranslations();
	const router = useRouter();
	const queryClient = useQueryClient();
	const createOrganizationMutation = useCreateOrganizationMutation();
	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: defaultName ?? "",
		},
	});

	useEffect(() => {
		form.reset({
			name: defaultName ?? "",
		});
	}, [defaultName, form]);

	const onSubmit = form.handleSubmit(async ({ name }) => {
		try {
			let organizationSlug: string;

			if (organizationToEdit) {
				const { error } = await authClient.organization.update({
					organizationId: organizationToEdit.id,
					data: {
						name,
					},
				});

				if (error) {
					throw error;
				}
				organizationSlug = organizationToEdit.slug;
			} else {
				const newOrganization =
					await createOrganizationMutation.mutateAsync({
						name,
					});

				if (!newOrganization) {
					throw new Error("Failed to create organization");
				}
				organizationSlug = newOrganization.slug;
			}

			const { error: setActiveError } =
				await authClient.organization.setActive({
					organizationSlug,
				});
			if (setActiveError) {
				throw setActiveError;
			}
			setActiveOrganizationSlugCookie(organizationSlug);

			await queryClient.invalidateQueries({
				queryKey: organizationListQueryKey,
			});

			const nextPath = sanitizeRedirectPath(redirectTo, "/app");
			router.replace(
				nextPath === "/app"
					? `/app/${organizationSlug}/home`
					: nextPath,
			);
		} catch {
			toast.error(t("organizations.createForm.notifications.error"));
		}
	});

	return (
		<div className="mx-auto w-full max-w-md">
			{backHref && (
				<Button
					asChild
					variant="ghost"
					className="-ml-3 mb-2 h-8 px-2 text-foreground/70"
				>
					<Link href={backHref}>
						<ArrowLeftIcon className="size-4" />
						Back
					</Link>
				</Button>
			)}

			<h1 className="font-bold text-xl md:text-2xl">
				{t("organizations.createForm.title")}
			</h1>
			<p className="mt-2 mb-6 text-foreground/60">
				{t("organizations.createForm.subtitle")}
			</p>

			<Form {...form}>
				<form onSubmit={onSubmit}>
					<FormField
						control={form.control}
						name="name"
						render={({ field }) => (
							<FormItem>
								<FormLabel>
									{t("organizations.createForm.name")}
								</FormLabel>
								<FormControl>
									<Input {...field} autoComplete="email" />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<Button
						className="mt-6 w-full"
						type="submit"
						disabled={form.formState.isSubmitting}
					>
						<span className="inline-flex items-center justify-center gap-2">
							{form.formState.isSubmitting && (
								<Loader2Icon
									className="size-4 animate-spin"
									aria-hidden="true"
								/>
							)}
							{organizationToEdit
								? "Continue"
								: t("organizations.createForm.submit")}
						</span>
					</Button>
				</form>
			</Form>
		</div>
	);
}
