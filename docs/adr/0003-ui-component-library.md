# ADR-0003: UI Component Library with shadcn/ui

## Status

Accepted

## Date

2024-12-23

## Context

We needed a UI component library that provides:
- High-quality, accessible components
- Customization flexibility
- TypeScript support
- Tailwind CSS compatibility
- Good developer experience

## Decision

We chose **shadcn/ui** as our component foundation, with components living in `packages/ui/`.

### Implementation

```
packages/ui/
├── src/
│   ├── components/
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── form.tsx
│   │   ├── sidebar.tsx
│   │   └── ... (50+ components)
│   ├── hooks/
│   │   └── use-mobile.ts
│   └── lib/
│       └── utils.ts
└── components.json          # shadcn/ui configuration
```

### Key Components

- **Primitives**: Button, Input, Select, Checkbox, etc.
- **Overlays**: Dialog, Sheet, Popover, Dropdown Menu
- **Feedback**: Alert, Sonner (toasts), Progress
- **Layout**: Card, Sidebar, Separator, Tabs
- **Data Display**: Table, Avatar, Badge

## Consequences

### Positive

- **Ownership**: Components are in our codebase, fully customizable
- **Accessible**: Built on Radix UI primitives (WCAG compliant)
- **Consistent styling**: All components use our Tailwind theme
- **Copy-paste model**: Easy to understand, no hidden magic
- **Tree-shakeable**: Only import what you use

### Negative

- **Maintenance burden**: We own the code, must maintain it
- **Updates**: Must manually update components when shadcn/ui releases fixes
- **Initial setup**: More work than installing a package

### Neutral

- Components can be customized per-project needs
- Design tokens are controlled via Tailwind config

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| Material UI | Comprehensive, mature | Opinionated styling, heavy |
| Chakra UI | Good DX, accessible | Different styling paradigm |
| Headless UI | Minimal, flexible | Need to build all styling |
| Radix Themes | Built on Radix | Less customizable |

## References

- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Radix UI Primitives](https://www.radix-ui.com/)
