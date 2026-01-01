# Boundary Visualization Components

Internal development tools for visualizing Next.js 16 rendering boundaries, hydration modes, and cache status.

## Overview

The Boundary components help developers understand:
- **Rendering Type**: Static, Dynamic, or Hybrid rendering
- **Hydration Mode**: Server, Client, or Hybrid components
- **Cache Status**: Whether content is cached or fresh

These visualizations only appear in development mode (`NODE_ENV=development`) and can be toggled on/off.

## Components

### 1. BoundaryProvider
Context provider that manages boundary visualization state across your app.

### 2. Boundary
Wrapper component that visually annotates sections of your app with rendering information.

### 3. BoundaryToggle
Fixed UI control for switching between visualization modes.

## Setup

### 1. Wrap your app with BoundaryProvider

In your root layout (`app/layout.tsx`):

```tsx
import { BoundaryProvider } from '@/modules/ui/components/internal';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <BoundaryProvider>
          {children}
        </BoundaryProvider>
      </body>
    </html>
  );
}
```

### 2. Add BoundaryToggle (Optional)

Add the toggle control to your layout to easily switch modes:

```tsx
import { BoundaryProvider, BoundaryToggle } from '@/modules/ui/components/internal';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <BoundaryProvider>
          {children}
          <BoundaryToggle />
        </BoundaryProvider>
      </body>
    </html>
  );
}
```

## Usage Examples

### Basic Rendering Boundary

```tsx
import Boundary from '@/modules/ui/components/internal/Boundary';

export default function MyPage() {
  return (
    <Boundary rendering="static">
      <h1>Static Content</h1>
      <p>This section is statically rendered at build time</p>
    </Boundary>
  );
}
```

### Dynamic Content with Cache

```tsx
import Boundary from '@/modules/ui/components/internal/Boundary';

export default async function DynamicSection() {
  const data = await fetchData();

  return (
    <Boundary rendering="dynamic" cached>
      <div>{data.content}</div>
    </Boundary>
  );
}
```

### Client Component Boundary

```tsx
'use client';

import Boundary from '@/modules/ui/components/internal/Boundary';
import { useState } from 'react';

export default function InteractiveWidget() {
  const [count, setCount] = useState(0);

  return (
    <Boundary hydration="client" label="Interactive Counter">
      <button onClick={() => setCount(count + 1)}>
        Count: {count}
      </button>
    </Boundary>
  );
}
```

### Hybrid Page with Multiple Boundaries

```tsx
import Boundary from '@/modules/ui/components/internal/Boundary';
import ClientWidget from './ClientWidget';

export default async function HybridPage() {
  const staticData = await getStaticData();
  const dynamicData = await getDynamicData();

  return (
    <div>
      <Boundary rendering="static" label="Header">
        <header>
          <h1>{staticData.title}</h1>
        </header>
      </Boundary>

      <Boundary rendering="dynamic" cached label="Dynamic Content">
        <main>
          <p>{dynamicData.content}</p>
        </main>
      </Boundary>

      <Boundary hydration="client" label="Sidebar Widget">
        <ClientWidget />
      </Boundary>
    </div>
  );
}
```

### Nested Boundaries

```tsx
import Boundary from '@/modules/ui/components/internal/Boundary';

export default function NestedExample() {
  return (
    <Boundary rendering="hybrid" label="Page Container">
      <div className="container">
        <Boundary rendering="static" label="Static Header">
          <header>Static Header</header>
        </Boundary>

        <Boundary rendering="dynamic" label="Dynamic Content">
          <main>Dynamic Content</main>
        </Boundary>
      </div>
    </Boundary>
  );
}
```

## Props

### Boundary Component

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | - | Content to wrap |
| `rendering` | `'static' \| 'dynamic' \| 'hybrid'` | - | Rendering type visualization |
| `hydration` | `'server' \| 'client' \| 'hybrid'` | - | Hydration mode visualization |
| `label` | `string` | - | Custom label text |
| `showLabel` | `boolean` | `true` | Whether to show the label |
| `cached` | `boolean` | `false` | Show cached indicator |

## Visualization Modes

Use the BoundaryToggle or programmatically set modes:

### Off Mode
No boundaries are shown (default).

### Hydration Mode
Shows component hydration types:
- **Blue**: Client components
- **Red**: Server components
- **Purple**: Hybrid (mixed)

### Rendering Mode
Shows rendering strategies:
- **Blue**: Dynamic rendering
- **Red**: Static rendering
- **Purple**: Hybrid rendering

## Color Legend

| Color | Rendering Mode | Hydration Mode |
|-------|---------------|----------------|
| Blue | Dynamic | Client |
| Red | Static | Server |
| Purple | Hybrid | Hybrid |
| Green badge | Cached content | - |

## Programmatic Control

```tsx
'use client';

import { useBoundaryMode } from '@/modules/ui/components/internal';

export function MyComponent() {
  const { mode, setMode, toggleMode } = useBoundaryMode();

  return (
    <div>
      <p>Current mode: {mode}</p>
      <button onClick={() => setMode('rendering')}>Show Rendering</button>
      <button onClick={() => setMode('hydration')}>Show Hydration</button>
      <button onClick={toggleMode}>Toggle</button>
    </div>
  );
}
```

## Best Practices

1. **Use boundaries at logical sections**: Wrap components at architectural boundaries (pages, layouts, major sections).

2. **Add descriptive labels**: Help identify sections quickly:
   ```tsx
   <Boundary rendering="dynamic" label="User Dashboard">
   ```

3. **Document cache behavior**: Mark cached content explicitly:
   ```tsx
   <Boundary rendering="dynamic" cached label="Product List">
   ```

4. **Combine with performance tools**: Use alongside React DevTools and Next.js profiling.

5. **Remove in production**: Components automatically disabled when `NODE_ENV !== 'development'`.

## Notes

- Boundaries automatically hide when space is too small (< 60px), showing a small colored circle instead
- State persists in localStorage across page reloads
- Works with React Server Components, Client Components, and streaming
- Compatible with Next.js 16+ App Router patterns

## Related

- [Next.js 16 Rendering Patterns](../../../../thoughts/ledgers/CONTINUITY_CLAUDE-nextjs16-patterns.md)
- [Cache Components Documentation](https://nextjs.org/docs)
