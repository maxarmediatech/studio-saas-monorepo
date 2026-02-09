"use client";

import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { useLocalStorage } from "@saas/studio/hooks/use-local-storage";
import {
	bookingsApi,
	configurationsApi,
	configurationsMutations,
} from "@saas/studio/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CalendarPlusIcon,
	CheckIcon,
	Loader2Icon,
	PackageIcon,
	SettingsIcon,
	UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useMemo } from "react";
import { toast } from "sonner";

interface QuickstartGuideProps {
	organizationSlug: string;
}

interface GuideItem {
	id: string;
	title: string;
	description: string;
	icon: ReactNode;
	completed: boolean;
	isLoading: boolean;
	cta:
		| {
				type: "link";
				text: string;
				link: string;
		  }
		| {
				type: "action";
				text: string;
				onClick: () => void;
				isPending?: boolean;
		  };
}

interface QuickstartState {
	hide: boolean;
	version: 2;
}

const DEFAULT_STATE: QuickstartState = {
	hide: false,
	version: 2,
};

const DEFAULT_SEED_CONFIGURATION_TYPES = [
	"booking_type",
	"event_type",
	"relation_type",
] as const;

export function QuickstartGuide({ organizationSlug }: QuickstartGuideProps) {
	const [storedState, setStoredState] = useLocalStorage<unknown>(
		`quickstart-guide-${organizationSlug}`,
		DEFAULT_STATE,
	);
	const queryClient = useQueryClient();
	const state = useMemo(
		() => normalizeQuickstartState(storedState),
		[storedState],
	);
	const shouldShowWidget = !state.hide;
	const { activeOrganization, loaded: activeOrganizationLoaded } =
		useActiveOrganization();

	const bookingTypesQuery = useQuery({
		...configurationsApi.listOptions({
			type: "booking_type",
			limit: 1,
		}),
		enabled: shouldShowWidget,
	});
	const packageTypesQuery = useQuery({
		...configurationsApi.listOptions({
			type: "package_type",
			limit: 1,
		}),
		enabled: shouldShowWidget,
	});
	const eventTypesQuery = useQuery({
		...configurationsApi.listOptions({
			type: "event_type",
			limit: 1,
		}),
		enabled: shouldShowWidget,
	});
	const relationTypesQuery = useQuery({
		...configurationsApi.listOptions({
			type: "relation_type",
			limit: 1,
		}),
		enabled: shouldShowWidget,
	});
	const bookingStatsQuery = useQuery({
		...bookingsApi.statsOptions(),
		enabled: shouldShowWidget,
	});

	const hasBookingTypes = (bookingTypesQuery.data?.data?.length ?? 0) > 0;
	const hasPackageTypes = (packageTypesQuery.data?.data?.length ?? 0) > 0;
	const hasEventTypes = (eventTypesQuery.data?.data?.length ?? 0) > 0;
	const hasRelationTypes = (relationTypesQuery.data?.data?.length ?? 0) > 0;
	const hasSeededWorkspaceDefaults =
		hasBookingTypes && hasEventTypes && hasRelationTypes;
	const hasRequiredConfigurations =
		hasSeededWorkspaceDefaults && hasPackageTypes;
	const hasCreatedBooking =
		(bookingStatsQuery.data?.data?.totalBookings ?? 0) > 0;
	const hasInvitedTeam =
		(activeOrganization?.invitations?.filter(
			(invitation) => invitation.status === "pending",
		).length ?? 0) > 0;

	const isCheckingWorkspaceDefaults =
		bookingTypesQuery.isPending ||
		eventTypesQuery.isPending ||
		relationTypesQuery.isPending;
	const isCheckingPackageTypes = packageTypesQuery.isPending;
	const isCheckingBookingCreation = bookingStatsQuery.isPending;
	const isCheckingTeamInvites = !activeOrganizationLoaded;
	const firstMissingConfigurationLink =
		!hasSeededWorkspaceDefaults || !hasPackageTypes
			? `/app/${organizationSlug}/configurations/package-types`
			: `/app/${organizationSlug}/bookings/new/details`;

	const seedWorkspaceDefaultsMutation = useMutation({
		...configurationsMutations.seed(),
		onSuccess: async () => {
			toast.success("Workspace defaults seeded successfully");
			await queryClient.invalidateQueries({
				queryKey: ["studio", "configurations"],
			});
			await Promise.all([
				bookingTypesQuery.refetch(),
				eventTypesQuery.refetch(),
				relationTypesQuery.refetch(),
			]);
		},
		onError: () => {
			toast.error(
				"Seeding failed. Try again from this card or add them manually in Configurations.",
			);
		},
	});

	const handleSeedWorkspaceDefaults = () => {
		seedWorkspaceDefaultsMutation.mutate({
			types: [...DEFAULT_SEED_CONFIGURATION_TYPES],
		});
	};

	const GUIDE_ITEMS: GuideItem[] = [
		{
			id: "configure-workspace",
			title: "Configure your workspace",
			description:
				"Seed core defaults for booking, shoot, and relation setup.",
			icon: <SettingsIcon className="size-4" />,
			completed: hasSeededWorkspaceDefaults,
			isLoading:
				isCheckingWorkspaceDefaults ||
				seedWorkspaceDefaultsMutation.isPending,
			cta: {
				type: "action",
				text: "Seed defaults",
				onClick: handleSeedWorkspaceDefaults,
				isPending: seedWorkspaceDefaultsMutation.isPending,
			},
		},
		{
			id: "create-package-types",
			title: "Create package types",
			description:
				"Define packages for your offers so each booking starts with clear scope.",
			icon: <PackageIcon className="size-4" />,
			completed: hasPackageTypes,
			isLoading: isCheckingPackageTypes,
			cta: {
				type: "link",
				text: "Open package types",
				link: `/app/${organizationSlug}/configurations/package-types`,
			},
		},
		{
			id: "create-booking",
			title: "Create a booking",
			description: hasRequiredConfigurations
				? "Create your first booking once setup is complete."
				: "Complete workspace defaults and package types first.",
			icon: <CalendarPlusIcon className="size-4" />,
			completed: hasCreatedBooking,
			isLoading:
				isCheckingBookingCreation ||
				isCheckingWorkspaceDefaults ||
				isCheckingPackageTypes,
			cta: {
				type: "link",
				text: hasRequiredConfigurations
					? "Create booking"
					: "Finish setup first",
				link: firstMissingConfigurationLink,
			},
		},
		{
			id: "invite-team",
			title: "Invite your team",
			description:
				"Invite collaborators to work together in this workspace.",
			icon: <UsersIcon className="size-4" />,
			completed: hasInvitedTeam,
			isLoading: isCheckingTeamInvites,
			cta: {
				type: "link",
				text: "Invite team",
				link: `/app/${organizationSlug}/settings/invitations`,
			},
		},
	];
	const completedCount = GUIDE_ITEMS.filter((item) => item.completed).length;

	const handleDismiss = () => {
		setStoredState({ ...state, hide: true });
	};

	useEffect(() => {
		if (isCanonicalQuickstartState(storedState)) {
			return;
		}
		setStoredState(state);
	}, [state, setStoredState, storedState]);

	if (state.hide) {
		return null;
	}

	return (
		<div className="py-4">
			<div className="flex items-center mb-4">
				<div className="flex items-center gap-2">
					<h3 className="text-sm font-semibold text-muted-foreground">
						Your quickstart guide
					</h3>
					<span className="text-xs text-muted-foreground">
						{completedCount}/{GUIDE_ITEMS.length} complete
					</span>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{GUIDE_ITEMS.map((item) => {
					return (
						<div
							key={item.id}
							className="flex flex-col p-4 bg-muted/30 rounded-xl border border-border/50"
						>
							<div
								className={cn(
									"grid place-items-center rounded-full size-9 mb-3",
									item.completed
										? "bg-muted text-muted-foreground"
										: "bg-primary/10 text-primary",
								)}
							>
								{item.isLoading && !item.completed ? (
									<Loader2Icon className="size-4 animate-spin" />
								) : (
									item.icon
								)}
							</div>

							<h4 className="text-sm font-medium text-foreground mb-1">
								{item.title}
							</h4>
							<p className="text-xs text-muted-foreground mb-3">
								{item.description}
							</p>

							{item.completed ? (
								<div className="flex items-center gap-1 bg-green-500 rounded-full p-1 w-fit">
									<CheckIcon className="size-3 text-white" />
								</div>
							) : item.cta.type === "link" ? (
								<Button
									asChild
									variant="ghost"
									size="sm"
									className={cn(
										"mt-auto h-8 w-fit justify-start rounded-md px-2.5 text-blue-600 hover:bg-blue-100/50 hover:text-blue-600",
									)}
								>
									<Link href={item.cta.link}>
										{item.cta.text}
									</Link>
								</Button>
							) : (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={item.cta.onClick}
									disabled={item.cta.isPending}
									className={cn(
										"mt-auto h-8 w-fit justify-start rounded-md px-2.5 text-blue-600 hover:bg-blue-100/50 hover:text-blue-600",
									)}
								>
									{item.cta.text}
								</Button>
							)}
						</div>
					);
				})}
			</div>

			{hasCreatedBooking ? (
				<div className="mt-4 flex justify-end">
					<button
						type="button"
						onClick={handleDismiss}
						className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
					>
						Hide this
					</button>
				</div>
			) : null}
		</div>
	);
}

function normalizeQuickstartState(value: unknown): QuickstartState {
	if (!value || typeof value !== "object") {
		return DEFAULT_STATE;
	}

	const hide =
		"hide" in value &&
		typeof (value as { hide?: unknown }).hide === "boolean"
			? (value as { hide: boolean }).hide
			: false;

	return {
		hide,
		version: 2,
	};
}

function isCanonicalQuickstartState(value: unknown): value is QuickstartState {
	if (!value || typeof value !== "object") {
		return false;
	}

	const record = value as Record<string, unknown>;
	const keys = Object.keys(record);

	return (
		keys.length === 2 &&
		keys.includes("hide") &&
		keys.includes("version") &&
		typeof record.hide === "boolean" &&
		record.version === 2
	);
}
