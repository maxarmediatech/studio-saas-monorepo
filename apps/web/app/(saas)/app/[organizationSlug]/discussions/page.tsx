"use client";

import { Button } from "@repo/ui/components/button";
import { ChannelCreateDialog } from "@saas/studio/components/discussions";
import { discussionsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DiscussionsIndexPage() {
	const params = useParams<{ organizationSlug: string }>();
	const router = useRouter();
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const { data, isLoading } = useQuery(discussionsApi.listChannelsOptions());

	const channels = data?.data ?? [];
	const firstChannel = channels[0];

	useEffect(() => {
		if (firstChannel && !isLoading) {
			router.replace(
				`/app/${params.organizationSlug}/discussions/${firstChannel.slug}`,
			);
		}
	}, [firstChannel, isLoading, params.organizationSlug, router]);

	if (isLoading) {
		return (
			<div className="flex flex-1 items-center justify-center">
				<div className="text-neutral-500">Loading...</div>
			</div>
		);
	}

	if (channels.length === 0) {
		return (
			<>
				<div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
					<div className="rounded-full bg-neutral-100 p-4">
						<MessageSquare className="size-8 text-neutral-400" />
					</div>
					<div className="text-center">
						<h2 className="text-lg font-semibold text-neutral-900">
							No channels yet
						</h2>
						<p className="mt-1 text-sm text-neutral-500">
							Create your first channel to start discussing with
							your team.
						</p>
					</div>
					<Button onClick={() => setCreateDialogOpen(true)}>
						Create Channel
					</Button>
				</div>
				<ChannelCreateDialog
					open={createDialogOpen}
					onOpenChange={setCreateDialogOpen}
				/>
			</>
		);
	}

	return null;
}
