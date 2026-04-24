import Link from "next/link";

type LegalSection = {
	title: string;
	body?: string[];
	items?: string[];
};

type LegalPageProps = {
	title: string;
	description: string;
	effectiveDate?: string;
	updatedDate?: string;
	sections: LegalSection[];
};

export function LegalPage({
	title,
	description,
	effectiveDate,
	updatedDate,
	sections,
}: LegalPageProps) {
	return (
		<main className="min-h-screen bg-muted/30 px-4 py-8 text-foreground sm:px-6 lg:px-8">
			<article className="mx-auto max-w-4xl rounded-lg border bg-background p-6 shadow-sm sm:p-10">
				<header className="border-b pb-8">
					<Link
						href="/auth/login"
						className="font-medium text-foreground/60 text-sm hover:text-foreground"
					>
						Back to sign in
					</Link>
					<h1 className="mt-6 font-bold text-3xl tracking-normal sm:text-4xl">
						{title}
					</h1>
					<p className="mt-3 max-w-2xl text-foreground/60">
						{description}
					</p>
					<div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-foreground/60 text-sm">
						{effectiveDate && (
							<span>Effective: {effectiveDate}</span>
						)}
						{updatedDate && (
							<span>Last updated: {updatedDate}</span>
						)}
					</div>
				</header>

				<div className="mt-8 space-y-8">
					{sections.map((section) => (
						<section key={section.title} className="space-y-3">
							<h2 className="font-semibold text-xl tracking-normal">
								{section.title}
							</h2>
							{section.body?.map((paragraph) => (
								<p
									key={paragraph}
									className="text-foreground/70 leading-7"
								>
									{paragraph}
								</p>
							))}
							{section.items && (
								<ul className="list-disc space-y-2 pl-5 text-foreground/70 leading-7">
									{section.items.map((item) => (
										<li key={item}>{item}</li>
									))}
								</ul>
							)}
						</section>
					))}
				</div>
			</article>
		</main>
	);
}
