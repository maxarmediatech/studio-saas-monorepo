"use client";

import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@repo/ui/components/avatar";
import { cn } from "@repo/ui/lib/utils";
import { useSession } from "@saas/auth/hooks/use-session";
import { useLocalStorage } from "@saas/studio/hooks/use-local-storage";
import {
	CalendarPlusIcon,
	CheckIcon,
	HotelIcon,
	SettingsIcon,
	UsersIcon,
	XIcon,
} from "lucide-react";
import Link from "next/link";

interface QuickstartGuideProps {
	organizationSlug: string;
}

interface QuickstartState {
	hide: boolean;
	createdBooking: boolean;
	visitedMembers: boolean;
	visitedSettings: boolean;
	visitedProfile: boolean;
}

const DEFAULT_STATE: QuickstartState = {
	hide: false,
	createdBooking: false,
	visitedMembers: false,
	visitedSettings: false,
	visitedProfile: false,
};

export function QuickstartGuide({ organizationSlug }: QuickstartGuideProps) {
	const { user } = useSession();
	const [state, setState] = useLocalStorage<QuickstartState>(
		`quickstart-guide-${organizationSlug}`,
		DEFAULT_STATE,
	);

	const handleDismiss = () => {
		setState({ ...state, hide: true });
	};

	const markVisited = (key: keyof QuickstartState) => {
		setState({ ...state, [key]: true });
	};

	const GUIDE_ITEMS = [
		{
			id: "create-booking",
			title: "Create a booking",
			description: "Most things start with a booking in Studio.",
			icon: <CalendarPlusIcon className="size-4" />,
			flag: "createdBooking" as const,
			cta: {
				text: "Create booking",
				link: `/app/${organizationSlug}/bookings/new/details`,
			},
		},
		{
			id: "invite-team",
			title: "Invite your team",
			description: "Build, ship, and manage with coworkers.",
			icon: <UsersIcon className="size-4" />,
			flag: "visitedMembers" as const,
			cta: {
				text: "Get them in",
				link: `/app/${organizationSlug}/settings/members`,
			},
		},
		{
			id: "configure-workspace",
			title: "Set up your workspace",
			description: "Turn features on or off or go beyond that.",
			icon: <HotelIcon className="size-4" />,
			flag: "visitedSettings" as const,
			cta: {
				text: "Configure this workspace",
				link: `/app/${organizationSlug}/configurations/booking-types`,
			},
		},
		{
			id: "personalize-profile",
			title: "Make Studio yours",
			description: "Choose your picture, colors, and more.",
			icon: user?.image ? (
				<Avatar className="size-8">
					<AvatarImage src={user.image} alt={user.name ?? ""} />
					<AvatarFallback className="bg-primary text-primary-foreground text-xs">
						{(user.name ?? user.email ?? "?")[0]?.toUpperCase()}
					</AvatarFallback>
				</Avatar>
			) : (
				<SettingsIcon className="size-4" />
			),
			flag: "visitedProfile" as const,
			cta: {
				text: "Personalize now",
				link: `/app/${organizationSlug}/settings/profile`,
			},
		},
	];

	const isComplete = (flag: keyof QuickstartState) => {
		return state[flag] === true;
	};

	if (state.hide) {
		return null;
	}

	return (
		<div className="py-4">
			<div className="flex items-center justify-between mb-4">
				<h3 className="text-sm font-semibold text-muted-foreground">
					Your quickstart guide
				</h3>
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
					const completed = isComplete(item.flag);

					return (
						<div
							key={item.id}
							className="flex flex-col p-4 bg-muted/30 rounded-xl border border-border/50"
						>
							<div
								className={cn(
									"grid place-items-center rounded-full size-9 mb-3",
									completed
										? "bg-muted text-muted-foreground"
										: "bg-primary/10 text-primary",
								)}
							>
								{item.icon}
							</div>

							<h4 className="text-sm font-medium text-foreground mb-1">
								{item.title}
							</h4>
							<p className="text-xs text-muted-foreground mb-3">
								{item.description}
							</p>

							{completed ? (
								<div className="flex items-center gap-1 bg-green-500 rounded-full p-1 w-fit">
									<CheckIcon className="size-3 text-white" />
								</div>
							) : (
								<Link
									href={item.cta.link}
									onClick={() => markVisited(item.flag)}
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
