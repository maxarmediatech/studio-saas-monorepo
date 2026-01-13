# Home Page Redesign - Plane-Style Implementation

## Reference: Plane's Home Page Structure

### Components Hierarchy
```
/[workspaceSlug]/(projects)/page.tsx
├── WorkspaceDashboardHeader
│   ├── Breadcrumb (Home icon + "Home")
│   └── "Manage Widgets" button
└── WorkspaceHomeView
    ├── TourRoot (onboarding - skip for now)
    ├── UserGreetingsView
    │   ├── "Good {morning/afternoon/evening}, {firstName} {lastName}"
    │   └── "{emoji} {weekday}, {date} {time}"
    └── DashboardWidgets
        ├── HomePageHeader (optional actions)
        ├── ManageWidgetsModal
        └── Widget list (ordered, toggleable)
            ├── QuickLinks
            ├── Recents (with filters)
            └── Stickies
```

### Key Features from Plane
1. **Time-based greeting** with emoji (🌤️ morning, 🌥️ afternoon, 🌙 evening)
2. **Live clock** showing weekday, date, time
3. **Configurable widgets** (enable/disable, reorder)
4. **Recents widget** with entity type filters
5. **Quick links** for bookmarked URLs
6. **Max-width container** (800px) centered

---

## Implementation Plan for Studio SaaS

### Phase 1: Core Layout & Greeting

**Files to create:**
```
apps/web/modules/saas/studio/components/home/
├── index.ts
├── home-view.tsx              # Main container (like WorkspaceHomeView)
├── user-greeting.tsx          # Greeting with time/date
├── home-header.tsx            # Page header with actions
└── widgets/
    ├── index.ts
    ├── widget-container.tsx   # Wrapper for each widget
    └── ...
```

**home-view.tsx** - Main layout:
- Centered max-width container (800px)
- UserGreeting at top
- Widget list below

**user-greeting.tsx** - Greeting component:
- Time-based greeting (morning/afternoon/evening)
- User's first name
- Weather emoji
- Current weekday, date, time (live updating)

### Phase 2: Widget Infrastructure

**Widget system:**
```typescript
type WidgetKey = "recent_visits" | "quick_actions" | "upcoming_shoots" | "pending_tasks";

interface WidgetConfig {
  id: WidgetKey;
  title: string;
  component: React.FC<WidgetProps>;
  enabled: boolean;
  order: number;
}
```

**Files:**
```
widgets/
├── widget-config.ts           # Widget definitions
├── widget-list.tsx            # Renders enabled widgets in order
├── manage-widgets-modal.tsx   # Enable/disable, reorder widgets
├── recent-visits/
│   ├── index.tsx              # Main widget
│   ├── recent-item.tsx        # Individual item row
│   ├── filters.tsx            # Entity type filter dropdown
│   └── empty-state.tsx
└── quick-actions/
    ├── index.tsx
    └── action-card.tsx
```

### Phase 3: Widgets Implementation

#### 1. Recent Visits Widget (adapt existing)
- Title: "Recents"
- Filter dropdown: All | Bookings | Shoots | Tasks | Deliverables
- List of recent items with:
  - Entity type icon
  - Name
  - Status badge
  - Relative time ("2 hours ago")
- Click → navigate to entity
- Empty state when no recents

#### 2. Quick Actions Widget
- Title: "Quick Actions"  
- Grid of action cards:
  - New Booking
  - New Shoot
  - New Task
  - View Calendar
- Each card: icon + label, links to create page

#### 3. (Future) Upcoming Shoots Widget
- Title: "Upcoming Shoots"
- Next 5 shoots sorted by date
- Shows: date, time, booking name, location

#### 4. (Future) Pending Tasks Widget
- Title: "Pending Tasks"
- Tasks due soon or overdue
- Shows: task name, due date, priority

---

## File-by-File Implementation

### Step 1: Update home page route
**File:** `apps/web/app/(saas)/app/[organizationSlug]/home/page.tsx`

```tsx
import { HomeView } from "@saas/studio/components/home";

export default async function HomePage({ params }) {
  const { organizationSlug } = await params;
  const session = await getSession();
  const organization = await getActiveOrganization(organizationSlug);
  
  return (
    <HomeView 
      organizationSlug={organizationSlug}
      userName={session?.user?.name ?? ""}
    />
  );
}
```

### Step 2: Create HomeView component
**File:** `apps/web/modules/saas/studio/components/home/home-view.tsx`

```tsx
"use client";

export function HomeView({ organizationSlug, userName }: HomeViewProps) {
  return (
    <div className="mx-auto max-w-[800px] px-4 py-6">
      <UserGreeting userName={userName} />
      <WidgetList organizationSlug={organizationSlug} />
    </div>
  );
}
```

### Step 3: Create UserGreeting component
**File:** `apps/web/modules/saas/studio/components/home/user-greeting.tsx`

```tsx
"use client";

export function UserGreeting({ userName }: { userName: string }) {
  const { currentTime } = useCurrentTime(); // custom hook with setInterval
  
  const hour = currentTime.getHours();
  const greeting = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const emoji = hour < 12 ? "🌤️" : hour < 18 ? "🌥️" : "🌙";
  
  const firstName = userName.split(" ")[0] || "there";
  const weekday = format(currentTime, "EEEE");
  const date = format(currentTime, "MMM d");
  const time = format(currentTime, "HH:mm");
  
  return (
    <div className="flex flex-col items-center my-6">
      <h2 className="text-xl font-semibold text-center">
        Good {greeting}, {firstName}
      </h2>
      <p className="flex items-center gap-2 text-muted-foreground">
        <span>{emoji}</span>
        <span>{weekday}, {date} {time}</span>
      </p>
    </div>
  );
}
```

### Step 4: Create widget infrastructure
**File:** `apps/web/modules/saas/studio/components/home/widgets/widget-config.ts`

```typescript
export const WIDGET_CONFIG = {
  recent_visits: {
    title: "Recents",
    component: RecentVisitsWidget,
  },
  quick_actions: {
    title: "Quick Actions", 
    component: QuickActionsWidget,
  },
} as const;
```

### Step 5: Adapt RecentVisitsWidget
- Add filter dropdown (All/Booking/Shoot/Task/Deliverable)
- Match Plane's list item styling
- Add section title "Recents"

### Step 6: Create QuickActionsWidget
- Grid of action cards
- New Booking, New Shoot, New Task, etc.

---

## Migration Steps

1. **Create new components** in `modules/saas/studio/components/home/`
2. **Keep existing** `recent-visits-widget.tsx` temporarily
3. **Update home page** to use new `HomeView`
4. **Update redirect** in `ActiveOrganizationProvider` to go to `/home`
5. **Test and verify**
6. **Remove old** components if replaced

---

## Design Tokens (from Plane)

```css
/* Container */
max-width: 800px
padding-x: page padding (varies)
background: bg-surface-1

/* Greeting */
title: text-20 font-semibold
subtitle: font-medium text-placeholder

/* Widget titles */
text-14 font-semibold text-tertiary

/* Widget containers */
gap between widgets: gap-7 (28px)
padding inside widget: py-4
```

---

## Acceptance Criteria

- [ ] Greeting shows correct time of day
- [ ] Live clock updates every minute
- [ ] Recents widget shows recent visits
- [ ] Filter dropdown works
- [ ] Quick actions link to correct pages
- [ ] Responsive on mobile
- [ ] Matches Plane's visual style
- [ ] Org selection redirects to /home
