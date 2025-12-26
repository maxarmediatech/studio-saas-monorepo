# Integration Example

This document shows how to integrate Boundary visualization components into the studio-saas project.

## Step 1: Update Root Layout

Add the `BoundaryProvider` to your root layout at `/apps/web/app/layout.tsx`:

```tsx
import "../modules/shared/lib/orpc-client.server";

import { config } from "@repo/config";
import "@repo/ui/globals.css";
import { cn } from "@repo/ui/lib/utils";
import { ClientProviders } from "@shared/components/ClientProviders";
import { ConsentProvider } from "@shared/components/ConsentProvider";
// ADD THIS IMPORT
import { BoundaryProvider, BoundaryToggle } from "@/modules/ui/components/internal";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { type PropsWithChildren, Suspense } from "react";

const sansFont = Geist({
	weight: ["400", "500", "600", "700"],
	subsets: ["latin"],
	variable: "--font-sans",
});

export const metadata: Metadata = {
	title: {
		absolute: config.appName,
		default: config.appName,
		template: `%s | ${config.appName}`,
	},
};

async function ConsentWrapper({ children }: PropsWithChildren) {
	const cookieStore = await cookies();
	const consentCookie = cookieStore.get("consent");

	return (
		<ConsentProvider initialConsent={consentCookie?.value === "true"}>
			{children}
		</ConsentProvider>
	);
}

export default function RootLayout({ children }: PropsWithChildren) {
	return (
		<html
			lang={config.i18n.defaultLocale}
			suppressHydrationWarning
			className={sansFont.className}
		>
			<body
				className={cn(
					"min-h-screen bg-background text-foreground antialiased",
				)}
			>
				{/* WRAP WITH BOUNDARY PROVIDER */}
				<BoundaryProvider>
					<NuqsAdapter>
						<Suspense fallback={null}>
							<ConsentWrapper>
								<ClientProviders>{children}</ClientProviders>
							</ConsentWrapper>
						</Suspense>
					</NuqsAdapter>
					{/* ADD TOGGLE CONTROL */}
					<BoundaryToggle />
				</BoundaryProvider>
			</body>
		</html>
	);
}
```

## Step 2: Add Boundaries to Pages

Example: Wrap sections of your booking page at `/apps/web/app/(saas)/app/[organizationSlug]/bookings/page.tsx`:

```tsx
import Boundary from '@/modules/ui/components/internal/Boundary';
import { BookingsPageClient } from '@saas/studio/components/bookings/BookingsPageClient';

export default async function BookingsPage({ params }: { params: { organizationSlug: string } }) {
  // Server-rendered data fetching
  const bookings = await getBookings(params.organizationSlug);

  return (
    <div className="container">
      <Boundary rendering="static" label="Page Header">
        <header>
          <h1>Bookings</h1>
        </header>
      </Boundary>

      <Boundary rendering="dynamic" cached={true} label="Bookings List">
        <BookingsPageClient initialData={bookings} />
      </Boundary>
    </div>
  );
}
```

## Step 3: Wrap Client Components

Example: Mark client-side interactive components:

```tsx
'use client';

import Boundary from '@/modules/ui/components/internal/Boundary';
import { useState } from 'react';

export function BookingForm() {
  const [data, setData] = useState({});

  return (
    <Boundary hydration="client" label="Booking Form">
      <form>
        {/* Form fields */}
      </form>
    </Boundary>
  );
}
```

## Step 4: Visualize Streaming and Suspense Boundaries

Example: Show where content is streamed:

```tsx
import { Suspense } from 'react';
import Boundary from '@/modules/ui/components/internal/Boundary';

export default function DashboardPage() {
  return (
    <div>
      <Boundary rendering="static" label="Dashboard Shell">
        <h1>Dashboard</h1>
      </Boundary>

      <Suspense fallback={<LoadingSkeleton />}>
        <Boundary rendering="dynamic" label="Async Stats">
          <StatsWidget />
        </Boundary>
      </Suspense>

      <Suspense fallback={<LoadingSkeleton />}>
        <Boundary rendering="dynamic" cached label="Recent Activity">
          <ActivityFeed />
        </Boundary>
      </Suspense>
    </div>
  );
}
```

## Step 5: Test the Visualization

1. Start the dev server:
   ```bash
   cd apps/web
   pnpm dev
   ```

2. Open your app in the browser

3. Click the Boundary Toggle controls in the bottom-right corner:
   - **Off**: No boundaries shown
   - **Hydration**: Shows server/client component boundaries (Blue = Client, Red = Server)
   - **Rendering**: Shows rendering strategies (Blue = Dynamic, Red = Static, Purple = Hybrid)

4. Inspect your pages to see:
   - Where components are rendering (server vs client)
   - What content is static vs dynamic
   - Which sections are cached

## Example: Full Page with Boundaries

Here's a complete example showing different boundary types:

```tsx
import { Suspense } from 'react';
import Boundary from '@/modules/ui/components/internal/Boundary';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ClientWidget } from './ClientWidget';

// app/(saas)/app/[organizationSlug]/dashboard/page.tsx
export default async function DashboardPage({
  params,
}: {
  params: { organizationSlug: string };
}) {
  // Static data (build time)
  const config = getStaticConfig();

  return (
    <div className="flex">
      <Boundary rendering="static" hydration="server" label="Sidebar">
        <Sidebar config={config} />
      </Boundary>

      <main className="flex-1">
        <Boundary rendering="static" hydration="server" label="Header">
          <Header title={config.title} />
        </Boundary>

        <Suspense fallback={<div>Loading stats...</div>}>
          <Boundary rendering="dynamic" cached label="User Stats (Cached)">
            <UserStats organizationSlug={params.organizationSlug} />
          </Boundary>
        </Suspense>

        <Boundary hydration="client" label="Interactive Chart">
          <ClientWidget />
        </Boundary>

        <Suspense fallback={<div>Loading activity...</div>}>
          <Boundary rendering="dynamic" label="Recent Activity (Fresh)">
            <RecentActivity organizationSlug={params.organizationSlug} />
          </Boundary>
        </Suspense>
      </main>
    </div>
  );
}

// Async server component
async function UserStats({ organizationSlug }: { organizationSlug: string }) {
  'use cache';
  const stats = await fetchUserStats(organizationSlug);
  return <div>{/* Render stats */}</div>;
}

// Fresh data, no cache
async function RecentActivity({ organizationSlug }: { organizationSlug: string }) {
  const activity = await fetchRecentActivity(organizationSlug);
  return <div>{/* Render activity */}</div>;
}
```

## Tips

1. **Start broad**: Add boundaries at page level first, then drill down into components
2. **Use descriptive labels**: Make it easy to identify what each boundary represents
3. **Mark cached content**: Always use `cached={true}` prop when using cache directives
4. **Combine with React DevTools**: Use both tools together for comprehensive debugging
5. **Remove before production**: Boundaries auto-disable in production, but you can remove them entirely if desired

## Troubleshooting

### Boundaries not showing up?
- Check that you're in development mode (`NODE_ENV=development`)
- Verify BoundaryProvider is wrapped around your app
- Toggle the mode using BoundaryToggle or check localStorage for 'boundaryMode'

### Types not found?
- Check that imports use correct path: `@/modules/ui/components/internal`
- Verify tsconfig.json has the path alias configured

### Toggle button not visible?
- BoundaryToggle only shows in development mode
- Check z-index conflicts with other fixed elements
- Try accessing it via keyboard (Tab key)
