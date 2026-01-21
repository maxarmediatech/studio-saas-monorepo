"use client";

import type { DiscussionLinkEntityType } from "@repo/api/modules/discussions/schemas";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { cn } from "@repo/ui/lib/utils";
import { useDiscussionParams } from "@saas/studio/hooks/params/use-discussion-params";
import { discussionsMutations, studioQueryKeys } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DiscussionForm, type DiscussionFormValues } from "../discussion-form";
import type { EntityLink } from "../entity-link-picker";

export function DiscussionCreateSheet() {
	const { createDiscussion, channelId, linkType, linkId, close } =
		useDiscussionParams();
	const isOpen = Boolean(createDiscussion);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

	const createMutation = useMutation(discussionsMutations.createDiscussion());

	const defaultLinks = useMemo((): EntityLink[] => {
		if (linkType && linkId) {
			return [
				{
					entityType: linkType as DiscussionLinkEntityType,
					entityId: linkId,
				},
			];
		}
		return [];
	}, [linkType, linkId]);

	const handleSubmit = async (data: DiscussionFormValues) => {
		try {
			await createMutation.mutateAsync({
				channelId: data.channelId,
				title: data.title,
				contentJson: data.contentJson,
				links: data.links.map((link) => ({
					entityType: link.entityType,
					entityId: link.entityId,
				})),
			});

			await queryClient.invalidateQueries({
				queryKey: orpc.discussions.key(),
			});
			await queryClient.invalidateQueries({
				queryKey: studioQueryKeys.discussions.all,
			});

			toast.success("Discussion created");
			close();
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to create discussion";
			toast.error(message);
		}
	};

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
			<SheetContent
				side="right"
				className="sm:max-w-xl p-0 gap-0 flex flex-col"
			>
				<SheetHeader
					className={cn(
						"shrink-0 p-4 transition-shadow duration-200",
						isScrolled &&
							"shadow-[0_4px_12px_-4px_rgba(0,0,0,0.15)]",
					)}
				>
					<SheetTitle className="text-xl">
						Create Discussion
					</SheetTitle>
				</SheetHeader>
				<div className="flex-1 min-h-0">
					<DiscussionForm
						onSubmit={handleSubmit}
						isPending={createMutation.isPending}
						onScrollChange={setIsScrolled}
						defaultChannelId={channelId ?? undefined}
						defaultLinks={defaultLinks}
					/>
				</div>
			</SheetContent>
		</Sheet>
	);
}
