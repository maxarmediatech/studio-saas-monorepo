import { ArrowRight, BookOpen, Database, GitBranch, Shield } from "lucide-react";
import Link from "next/link";

const areas = [
	{
		href: "/docs/architecture/database",
		icon: Database,
		label: "Database",
		text: "Schema, migrations, ownership, and change safety.",
	},
	{
		href: "/docs/architecture/auth",
		icon: Shield,
		label: "Auth",
		text: "Identity, sessions, organizations, teams, and permissions.",
	},
	{
		href: "/docs/patterns/workers",
		icon: GitBranch,
		label: "Workers",
		text: "Queues, retries, job boundaries, and operational rules.",
	},
];

export default function HomePage() {
	return (
		<main className="min-h-screen px-5 py-8 sm:px-8 lg:px-12">
			<section className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
				<div className="pt-16 sm:pt-24">
					<div className="handbook-mark mb-8 inline-flex items-center gap-2 rounded-sm px-3 py-1 text-sm font-semibold">
						<BookOpen className="size-4" />
						Internal Handbook
					</div>
					<h1 className="max-w-4xl text-balance font-bold text-5xl leading-[0.98] tracking-normal sm:text-7xl lg:text-8xl">
						Studio SaaS operating manual.
					</h1>
					<p className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-fd-muted-foreground">
						Codebase structure, product architecture, database rules, workers,
						auth, payments, and runbooks. One place for engineering transfer,
						review, and onboarding.
					</p>
					<div className="mt-9 flex flex-wrap gap-3">
						<Link
							href="/docs"
							className="inline-flex h-11 items-center gap-2 rounded-sm bg-fd-primary px-5 text-sm font-semibold text-fd-primary-foreground"
						>
							Open handbook
							<ArrowRight className="size-4" />
						</Link>
						<Link
							href="/docs/architecture/system-overview"
							className="inline-flex h-11 items-center rounded-sm border border-fd-border bg-fd-background px-5 text-sm font-semibold"
						>
							System overview
						</Link>
					</div>
				</div>

				<div className="grid gap-3 pb-8 lg:pb-2">
					{areas.map((area) => {
						const Icon = area.icon;
						return (
							<Link
								key={area.href}
								href={area.href}
								className="group grid grid-cols-[2.75rem_1fr_auto] items-center gap-4 border border-fd-border bg-fd-background/86 p-4 shadow-sm backdrop-blur transition hover:border-fd-primary"
							>
								<span className="grid size-11 place-items-center rounded-sm bg-fd-muted">
									<Icon className="size-5" />
								</span>
								<span>
									<span className="block font-semibold">{area.label}</span>
									<span className="block text-sm leading-6 text-fd-muted-foreground">
										{area.text}
									</span>
								</span>
								<ArrowRight className="size-4 text-fd-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-fd-primary" />
							</Link>
						);
					})}
				</div>
			</section>
		</main>
	);
}
