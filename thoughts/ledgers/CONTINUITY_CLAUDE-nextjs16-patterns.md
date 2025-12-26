# Session: nextjs16-patterns
Updated: 2025-12-26T00:00:00Z

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

## Open Questions

- UNCONFIRMED: Does studio app need upgrade to Next.js 16 first?
- UNCONFIRMED: Which studio components are candidates for `'use cache'`?
- UNCONFIRMED: How to handle TanStack Query with cache components?
