"use client";

import { cn } from "@repo/ui/lib/utils";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { useLocalStorage } from "@saas/studio/hooks/use-local-storage";
import { bookingsApi, configurationsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import {
	CalendarPlusIcon,
	CheckIcon,
	ClipboardListIcon,
	Loader2Icon,
	PackageIcon,
	UsersIcon,
	XIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo } from "react";

interface QuickstartGuideProps {
	organizationSlug: string;
}

interface QuickstartState {
	hide: boolean;
	version: 2;
}

const DEFAULT_STATE: QuickstartState = {
	hide: false,
	version: 2,
};

export function QuickstartGuide({ organizationSlug }: QuickstartGuideProps) {
	const [storedState, setStoredState] = useLocalStorage<unknown>(
		`quickstart-guide-${organizationSlug}`,
		DEFAULT_STATE,
	);
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
	const bookingStatsQuery = useQuery({
		...bookingsApi.statsOptions(),
		enabled: shouldShowWidget,
	});

	const hasBookingTypes = (bookingTypesQuery.data?.data?.length ?? 0) > 0;
	const hasPackageTypes = (packageTypesQuery.data?.data?.length ?? 0) > 0;
	const hasRequiredConfigurations = hasBookingTypes && hasPackageTypes;
	const hasCreatedBooking =
		(bookingStatsQuery.data?.data?.totalBookings ?? 0) > 0;
	const hasInvitedTeam =
		(activeOrganization?.invitations?.filter(
			(invitation) => invitation.status === "pending",
		).length ?? 0) > 0;

	const isCheckingRequiredConfigurations =
		bookingTypesQuery.isPending || packageTypesQuery.isPending;
	const isCheckingBookingTypes = bookingTypesQuery.isPending;
	const isCheckingPackageTypes = packageTypesQuery.isPending;
	const isCheckingBookingCreation = bookingStatsQuery.isPending;
	const isCheckingTeamInvites = !activeOrganizationLoaded;
	const firstMissingConfigurationLink = !hasBookingTypes
		? `/app/${organizationSlug}/configurations/booking-types`
		: !hasPackageTypes
			? `/app/${organizationSlug}/configurations/package-types`
			: `/app/${organizationSlug}/bookings/new/details`;

	const GUIDE_ITEMS = [
		{
			id: "create-booking-types",
			title: "Create booking types",
			description:
				"Define booking categories so owners pick the right workflow from day one.",
			icon: <ClipboardListIcon className="size-4" />,
			completed: hasBookingTypes,
			isLoading: isCheckingBookingTypes,
			cta: {
				text: "Open booking types",
				link: `/app/${organizationSlug}/configurations/booking-types`,
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
				text: "Open package types",
				link: `/app/${organizationSlug}/configurations/package-types`,
			},
		},
		{
			id: "create-booking",
			title: "Create a booking",
			description: hasRequiredConfigurations
				? "Create your first booking once setup is complete."
				: "Complete booking types and package types first.",
			icon: <CalendarPlusIcon className="size-4" />,
			completed: hasCreatedBooking,
			isLoading:
				isCheckingBookingCreation || isCheckingRequiredConfigurations,
			cta: {
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
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-2">
					<h3 className="text-sm font-semibold text-muted-foreground">
						Your quickstart guide
					</h3>
					<span className="text-xs text-muted-foreground">
						{completedCount}/{GUIDE_ITEMS.length} complete
					</span>
				</div>
				<button
					type="button"
					onClick={handleDismiss}
					className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
				>
					<XIcon className="size-4" />
					Not right now
				</button>
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
							) : (
								<Link
									href={item.cta.link}
									className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
								>
									{item.cta.text}
								</Link>
							)}
						</div>
					);
				})}
			</div>
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
