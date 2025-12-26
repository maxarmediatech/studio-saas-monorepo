# Session: nextjs16-patterns
Updated: 2025-12-26T10:00:00.000Z

## Goal
Document Next.js 16 patterns from `next16-commerce` repo for reference when building studio-saas-monorepo.

## Source Repository
`/Users/rakesh/Developer/agency/next16-commerce/app`

---

## Key Patterns

### 1. Cache Components (`'use cache'` directive)

**Config:** `next.config.ts`
```ts
const nextConfig: NextConfig = {
  cacheComponents: true,  // Enable cache components
  experimental: {
    inlineCss: true,
    staleTimes: { dynamic: 30 },
  },
  reactCompiler: true,
  typedRoutes: true,
};
```

**Component-level caching:**
```tsx
// features/product/components/Product.tsx
import { cacheTag } from 'next/dist/server/use-cache/cache-tag';

export default async function Product({ productId }: Props) {
  'use cache';  // Mark component as cacheable

  cacheTag('product-' + productId);  // Fine-grained revalidation

  const product = await getProduct(productId);
  return <div>...</div>;
}
```

**Key insight:** `'use cache'` can only be used on async components/functions that DON'T depend on dynamic APIs (cookies, headers).

### 2. The "Donut Pattern" - Composable Caching

When a component needs BOTH cached and dynamic content:

```tsx
// ProductDetails.tsx - cached wrapper
export default async function ProductDetails({ productId, children }: Props) {
  'use cache';
  cacheTag('product-' + productId);

  const productDetails = await getProductDetails(productId);

  return (
    <div>
      {/* Static/cached content */}
      <ProductDetailFields {...productDetails} />

      {/* Dynamic content passed as children (not cached) */}
      {children}
    </div>
  );
}

// Usage in page.tsx
<ProductDetails productId={productId}>
  <Suspense fallback={<Bookmark />}>
    <SavedProduct productId={productId} />  {/* Dynamic - user-specific */}
  </Suspense>
</ProductDetails>
```

**Pattern:** Children reference can change without affecting parent's cache entry.

### 3. Auth Promise Pattern - Avoid Blocking

**Don't await auth at root level** - pass as promise, resolve deeper:

```tsx
// app/layout.tsx
export default async function RootLayout({ children }: LayoutProps) {
  const loggedIn = getIsAuthenticated();  // NOT awaited - stays as Promise

  return (
    <AuthProvider loggedIn={loggedIn}>  {/* Pass promise down */}
      {children}
    </AuthProvider>
  );
}

// AuthProvider.tsx
'use client';
export function AuthProvider({ children, loggedIn }: {
  children: ReactNode;
  loggedIn: Promise<boolean>  // Receives promise
}) {
  return (
    <AuthContext.Provider value={{ loggedIn }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to consume
export const useLoggedIn = () => {
  const { loggedIn } = useAuth();
  return use(loggedIn);  // use() unwraps promise in client component
};
```

### 4. Donut Pattern for Interactivity

Wrap server-rendered content with client interactivity:

```tsx
// BannerContainer.tsx - client wrapper
'use client';
export function BannerContainer({ children }: { children: ReactNode }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div>
      {children}  {/* Server-rendered content */}
      <button onClick={() => setDismissed(true)}>X</button>
    </div>
  );
}

// WelcomeBanner.tsx - server content
export default function WelcomeBanner() {
  return (
    <BannerContainer>  {/* Client wrapper */}
      <Suspense fallback={<GeneralBanner />}>
        <PersonalBanner />  {/* Server content */}
      </Suspense>
    </BannerContainer>
  );
}
```

**Pattern:** Client components receive server content as props/children - maintains separation of concerns.

### 5. React `cache()` for Query Deduplication

```tsx
// product-queries.ts
import 'server-only';
import { cache } from 'react';

export const getProduct = cache(async (productId: number) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });
  return product;
});
```

**Use case:** Multiple components calling same query = single request per render.

### 6. Suspense Boundaries for Streaming

**Personalized content with fallback:**
```tsx
// page.tsx
<Suspense fallback={<GeneralBanner />}>
  <PersonalBanner />  {/* Async - user-specific */}
</Suspense>

<Suspense fallback={<RecommendationsSkeleton />}>
  <Recommendations />  {/* Async - user-specific */}
</Suspense>
```

**Cached components don't need Suspense:**
```tsx
// After adding 'use cache', remove Suspense
<Hero />  // No Suspense needed - cached
<FeaturedCategories />  // No Suspense needed - cached
```

### 7. `generateStaticParams` for Dynamic Routes

```tsx
// app/product/[id]/page.tsx
export async function generateStaticParams() {
  return [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }];
}

export default async function ProductPage({ params }: PageProps<'/product/[id]'>) {
  const { id } = await params;
  // ...
}
```

### 8. Typed Routes

```ts
// next.config.ts
typedRoutes: true,

// Usage
import type { Route } from 'next';
<Link href={`/product/${id}` as Route}>View</Link>
```

### 9. LayoutProps Helper

```tsx
// Typed layouts with inferred params
export default async function RootLayout({ children }: LayoutProps<'/'>) {
  // ...
}

export default async function ProductPage({ params }: PageProps<'/product/[id]'>) {
  const { id } = await params;  // Typed!
}
```

---

## Rendering Types (from Boundary component)

| Type | Meaning |
|------|---------|
| `static` | Fully pre-rendered at build time |
| `dynamic` | Rendered on every request (uses cookies/headers) |
| `hybrid` | Async but no dynamic deps - CAN be cached |

**Key insight:** `hybrid` components are candidates for `'use cache'`.

---

## Mental Model

> "Dynamic vs static is a scale. We decide how much static we want."

1. Start with everything dynamic (default with cacheComponents)
2. Add `'use cache'` to async components without dynamic deps
3. Use donut pattern to interleave cached + dynamic
4. Push dynamic deps (cookies, auth) deeper down

---

## Files Reference

| Pattern | File |
|---------|------|
| Cache directive | `features/product/components/Product.tsx` |
| cacheTag | `features/product/components/Hero.tsx` |
| Donut caching | `features/product/components/ProductDetails.tsx` |
| Donut interactivity | `components/banner/BannerContainer.tsx` |
| Auth promise | `features/auth/components/AuthProvider.tsx` |
| Query caching | `features/product/product-queries.ts` |
| Category filters | `features/category/components/CategoryFilters.tsx` |

---

## Constraints for Studio App

When applying to studio-saas-monorepo:
1. Check Next.js version supports cacheComponents (16+)
2. Identify components with/without dynamic deps
3. Move auth checks deeper (don't block layout)
4. Use `cache()` from React for query deduplication
5. Use `cacheTag()` for granular revalidation

---

## Implementation Plan

**Plan file:** `/Users/rakesh/.claude/plans/goofy-jumping-flute.md`

**Approach:** Hybrid - keep TanStack Query for client-side, add `'use cache'` for server-only components.

**Phases:**
1. [x] Boundary visualization component (dev tool) - DONE
2. [→] Streaming with Suspense (bookings page pilot)
3. [ ] Cache components (`'use cache'` + `cacheTag()`)
4. [ ] Non-blocking auth (optional, most invasive)

**Key Decisions:**
- Incremental rollout starting with bookings page
- Keep TanStack Query for mutations/client cache
- Add Boundary component for debugging

---

## State
- Done:
  - [x] Analyzed next16-commerce patterns
  - [x] Created comparison
  - [x] Approved plan
  - [x] Phase 1: Boundary visualization component
  - [x] Phase 2: Streaming with Suspense (bookings page pilot)
- Now: [→] Document Phase 2 implementation
- Next:
  - [ ] Phase 3: Cache components (`'use cache'` + `cacheTag()`)
  - [ ] Phase 4: Non-blocking auth (optional, most invasive)

## Phase 2 Implementation Details

**Files Created:**
- `apps/web/modules/saas/studio/components/bookings/BookingsFilters.tsx` - Client component for instant filters
- `apps/web/modules/saas/studio/components/bookings/BookingsTable.tsx` - Async server component for table
- `apps/web/modules/saas/studio/components/bookings/BookingsTableClient.tsx` - Client component for table interactivity
- `apps/web/modules/saas/studio/components/bookings/BookingsTableSkeleton.tsx` - Skeleton fallback
- `apps/web/modules/saas/studio/components/bookings/index.server.ts` - Server-only exports

**Files Modified:**
- `apps/web/app/(saas)/app/[organizationSlug]/bookings/page.tsx` - Refactored to use Suspense boundaries
- `apps/web/modules/saas/studio/components/bookings/index.ts` - Removed server exports to prevent client bundling
- `apps/web/modules/saas/studio/index.ts` - Updated exports

**Architecture:**
```
page.tsx (server)
  ├─ BookingsFilters (client) → Renders instantly
  └─ Suspense fallback={BookingsTableSkeleton}
       └─ BookingsTable (server async)
            └─ HydrationBoundary
                 └─ BookingsTableClient (client) → TanStack Query
```

**Key Decisions:**
1. **Separate server/client exports** - Created `index.server.ts` to prevent server components from being bundled in client layouts
2. **Hybrid approach** - Server prefetch + client TanStack Query for best of both worlds
3. **Filters separate from table** - Filters render instantly, table streams in
4. **Boundary visualization** - Added Boundary components for debugging stream behavior

**Flow:**
1. Page loads → Filters render instantly
2. Table shows skeleton while data fetches
3. Data prefetched on server, hydrated in client
4. TanStack Query manages client-side cache + mutations

**Testing:**
- Build passes successfully
- Suspense boundary will show skeleton during data fetch
- Boundary visualization shows client vs dynamic boundaries in dev mode

## Open Questions

- CONFIRMED: Studio app has `cacheComponents: true` in next.config.ts
- CONFIRMED: Hybrid approach - TanStack Query stays for client, `'use cache'` for server
- CONFIRMED: Boundary component works (integrated in Phase 2)
- UNCONFIRMED: Need to test actual streaming behavior in browser
