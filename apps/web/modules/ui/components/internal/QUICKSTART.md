# Quick Start Guide

Get boundary visualization working in 3 minutes.

## 1. Add Provider (1 min)

Edit `apps/web/app/layout.tsx`:

```tsx
import { BoundaryProvider, BoundaryToggle } from "@/modules/ui/components/internal";

export default function RootLayout({ children }: PropsWithChildren) {
	return (
		<html>
			<body>
				<BoundaryProvider>
					{/* Your existing providers */}
					{children}
					<BoundaryToggle />
				</BoundaryProvider>
			</body>
		</html>
	);
}
```

## 2. Add First Boundary (30 sec)

Wrap any component:

```tsx
import Boundary from '@/modules/ui/components/internal/Boundary';

export default function MyPage() {
  return (
    <Boundary rendering="dynamic" label="My Page">
      <h1>Hello World</h1>
    </Boundary>
  );
}
```

## 3. Test It (1 min)

1. Start dev server: `pnpm dev`
2. Open your app in browser
3. Click the toggle in bottom-right corner
4. Switch between modes:
   - **Off** → No visualization
   - **Hydration** → Shows server/client components
   - **Rendering** → Shows static/dynamic rendering

## Done!

You should now see colored borders around your component with a label.

## Next Steps

- Read [README.md](./README.md) for full documentation
- Check [INTEGRATION_EXAMPLE.md](./INTEGRATION_EXAMPLE.md) for real-world examples
- Add boundaries to more components to understand your app's rendering patterns

## Color Reference

| Color | Meaning (Rendering Mode) | Meaning (Hydration Mode) |
|-------|-------------------------|-------------------------|
| 🔵 Blue | Dynamic rendering | Client component |
| 🔴 Red | Static rendering | Server component |
| 🟣 Purple | Hybrid | Hybrid |
| 🟢 Green badge | Cached | - |

## Common Patterns

### Server Component (Static)
```tsx
<Boundary rendering="static" hydration="server">
```

### Server Component (Dynamic, Cached)
```tsx
<Boundary rendering="dynamic" cached>
```

### Client Component
```tsx
<Boundary hydration="client">
```

### Streaming with Suspense
```tsx
<Suspense fallback={<Loading />}>
  <Boundary rendering="dynamic" cached>
    <AsyncComponent />
  </Boundary>
</Suspense>
```
