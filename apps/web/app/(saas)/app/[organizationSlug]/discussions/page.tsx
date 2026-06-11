import { orpcClient } from "@shared/lib/orpc-client.server";
import { MessageSquare } from "lucide-react";
import { redirect } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export default async function DiscussionsIndexPage({ params }: Props) {
	const { organizationSlug } = await params;
	const data = await orpcClient.discussions.listChannels({
		organizationSlug,
	});
	const channels = data?.data ?? [];
	const firstChannel = channels[0];

	if (firstChannel) {
		redirect(`/app/${organizationSlug}/discussions/${firstChannel.slug}`);
	}

	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
			<div className="rounded-full bg-neutral-100 p-4">
				<MessageSquare className="size-8 text-neutral-400" />
			</div>
			<div className="text-center">
				<h2 className="text-lg font-semibold text-neutral-900">
					Welcome to Discussions
				</h2>
				<p className="mt-1 text-sm text-neutral-500">
					Create your first channel using the sidebar to start
					discussing with your team.
				</p>
			</div>
		</div>
	);
}
