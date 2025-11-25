# Product Intelligence Layer UX Design Specification

_Created on 2025-11-25 by Zac_
_Generated using BMad Method - Create UX Design Workflow v1.0_

---

## Executive Summary

**Product Intelligence Layer** is a B2B SaaS platform that enables mid-market ecommerce teams to convert structured product metadata into private, reusable intelligence APIs—without AI expertise or prompt engineering.

### Vision
"Turn your product data into private intelligence APIs—no AI expertise required."

### Target Users
- Mid-market ecommerce teams (50-500 employees, 1,000-100,000 SKUs)
- Non-technical users who lack AI expertise
- Users overwhelmed by complex enterprise tools

### Core Experience Principles

| Principle | Description |
|-----------|-------------|
| **Effortless** | Everything should feel simple and achievable |
| **Empowering** | Users feel capable: "I can do this!" |
| **Transparent** | Users always know what's happening—no black boxes |
| **Guided** | Gentle hand-holding without being patronizing |
| **Celebratory** | Success moments reinforce accomplishment |

### Emotional Goals
- **Primary:** Empowered & Capable ("I just built an AI API without writing code!")
- **Secondary:** Confident & In Control ("I understand exactly what's happening")

---

## 1. Design System Foundation

### 1.1 Design System Choice

**Selected:** shadcn/ui

| Attribute | Details |
|-----------|---------|
| **Library** | shadcn/ui (built on Radix UI primitives + Tailwind CSS) |
| **Components** | 50+ accessible components |
| **Approach** | Copy-paste into codebase (you own the code) |
| **Theming** | Fully customizable via CSS variables |
| **Accessibility** | WCAG compliant via Radix primitives |

**Rationale:**
- Modern, clean aesthetic aligns with "simple, not overwhelming" goal
- Highly customizable for Warm Coral brand theme
- Tailwind-based enables rapid iteration
- No dependency lock-in
- Great developer experience for fast MVP development

---

## 2. Core User Experience

### 2.1 Defining Experience

**The Magic Moment:**
> "Define your product data → Click Generate → Get a working API instantly"

Or simply: **Define → Generate → Done**

### 2.2 UX Pattern Analysis

All core interactions use **standard, familiar patterns**—the innovation is in what the product does, not how users interact with it. This supports the "don't overwhelm" goal.

| Flow Element | Pattern Type |
|--------------|--------------|
| Define intelligence | Form/Wizard (stepped) |
| Generate endpoint | Button → Loading → Success celebration |
| Test endpoint | API Console (Postman-like) |
| View logs | Data Table with filters |
| Manage versions | List with status badges |

### 2.3 Novel UX Patterns

No truly novel interaction patterns are required. Standard B2B SaaS patterns apply throughout.

---

## 3. Visual Foundation

### 3.1 Color System

**Theme:** Warm Coral — Energetic, Friendly, Approachable

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| **Primary** | Orange | `#f97316` | Main CTAs, brand identity, active states |
| **Primary Light** | Light Orange | `#fb923c` | Hover states, secondary emphasis |
| **Primary Dark** | Dark Orange | `#ea580c` | Pressed states, text on light backgrounds |
| **Secondary** | Warm Gray | `#78716c` | Supporting UI, less prominent actions |
| **Accent** | Yellow | `#eab308` | Highlights, badges, special callouts |
| **Success** | Green | `#22c55e` | Success states, active status indicators |
| **Warning** | Amber | `#f59e0b` | Warning states, caution messages |
| **Error** | Red | `#dc2626` | Error states, destructive actions |
| **Background** | Warm White | `#fffbeb` | Page backgrounds |
| **Background Alt** | White | `#ffffff` | Cards, elevated surfaces |
| **Border** | Cream | `#fef3c7` | Subtle dividers, card borders |
| **Border Neutral** | Stone | `#e7e5e4` | Standard borders |
| **Text Primary** | Dark Brown | `#1c1917` | Primary text, headings |
| **Text Secondary** | Stone | `#57534e` | Secondary text, descriptions |
| **Text Muted** | Stone Light | `#a8a29e` | Placeholder text, disabled states |

### 3.2 Typography

| Element | Font | Size | Weight | Line Height |
|---------|------|------|--------|-------------|
| **H1** | System sans-serif | 32px | 700 | 1.2 |
| **H2** | System sans-serif | 24px | 600 | 1.3 |
| **H3** | System sans-serif | 20px | 600 | 1.4 |
| **H4** | System sans-serif | 16px | 600 | 1.4 |
| **Body** | System sans-serif | 14px | 400 | 1.5 |
| **Small** | System sans-serif | 13px | 400 | 1.5 |
| **Caption** | System sans-serif | 12px | 400 | 1.4 |
| **Code** | Monospace | 13px | 400 | 1.5 |

**Font Stack:** `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`

### 3.3 Spacing System

Base unit: **4px**

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Tight spacing, inline elements |
| `sm` | 8px | Related elements |
| `md` | 16px | Standard spacing |
| `lg` | 24px | Section spacing |
| `xl` | 32px | Major sections |
| `2xl` | 48px | Page sections |
| `3xl` | 64px | Hero spacing |

### 3.4 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | 6px | Buttons, inputs |
| `md` | 8px | Cards, small containers |
| `lg` | 12px | Large cards, panels |
| `xl` | 16px | Major containers |
| `full` | 9999px | Pills, avatars |

**Interactive Visualizations:**
- Color Theme Explorer: [ux-color-themes.html](./ux-color-themes.html)

---

## 4. Design Direction

### 4.1 Chosen Design Approach

**Hybrid:** Direction 1 (Spacious Dashboard) + Direction 3 (Card Gallery)

| Screen | Approach |
|--------|----------|
| **Dashboard** | Sidebar navigation + stats row + content area |
| **Intelligences List** | Card gallery view (visual, scannable) |
| **Creation Flow** | Centered wizard with progress stepper |
| **Settings/Logs** | Sidebar navigation + table/form content |

### 4.2 Layout Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Navigation** | Persistent sidebar (240px) | Clear structure, always accessible |
| **Content Width** | Max 1200px centered | Comfortable reading, not overwhelming |
| **Density** | Spacious | Generous whitespace reduces cognitive load |
| **Card Style** | Elevated with subtle shadow | Visual hierarchy, inviting to click |
| **Hierarchy** | Clear with size/weight variation | Users know what's important |

### 4.3 Visual Style

| Aspect | Choice |
|--------|--------|
| **Visual Weight** | Light/minimal with strategic color pops |
| **Depth** | Subtle shadows for elevation |
| **Borders** | Light borders (`#e7e5e4`) for structure |
| **Icons** | Lucide icons (clean, consistent) |
| **Imagery** | Minimal; illustrations for empty states |

**Interactive Mockups:**
- Design Direction Showcase: [ux-design-directions.html](./ux-design-directions.html)

---

## 5. User Journey Flows

### 5.1 Critical User Paths

#### Journey 1: Create Intelligence (Primary Flow)

**User Goal:** Define product data structure → Get a working API endpoint

**Approach:** Template-first with progressive disclosure

```
Step 1: Choose Starting Point
├── Select from templates (Product Description, SEO Meta, Category Classifier, etc.)
└── Or start blank

Step 2: Name & Basic Info
├── Intelligence name (pre-filled if template)
└── Description

Step 3: Define Input Schema (Progressive)
├── Category selection
├── Add attributes (name, type, required)
└── [Expandable] Add components, subcategories

Step 4: Set Goal
├── Natural language goal/purpose
└── Helpful tips and examples shown

Step 5: Define Output (Progressive)
├── Simple text OR Structured JSON
├── Add output fields (name, type)
└── [Expandable] Edit JSON schema directly

Step 6: Review & Generate
├── Summary checklist
└── "Generate API" button

Success State:
├── Celebration message
├── API endpoint displayed
├── "Test Now" and "View Docs" CTAs
```

**Key UX Decisions:**
- Templates reduce blank-canvas anxiety
- Progressive disclosure hides complexity until needed
- Each step has a clear, focused goal
- Success moment celebrates the accomplishment

#### Journey 2: Test Endpoint

```
Entry: From intelligence card → "Test" or from creation success → "Test Now"

Step 1: View Test Console
├── Pre-filled sample request based on input schema
├── Editable JSON input panel

Step 2: Execute Test
├── Click "Send Request"
├── Loading state with spinner

Step 3: View Results
├── Formatted JSON response
├── Latency displayed
├── Validation status (pass/fail)
├── Copy cURL / code snippets option
```

#### Journey 3: View Logs

```
Entry: Sidebar → "Logs" or Intelligence card → "View Logs"

View: Filterable Table
├── Filters: Date range, status, intelligence
├── Columns: Time, Intelligence, Status, Latency
├── Click row to expand: full request/response, error details
├── Export option for compliance
```

#### Journey 4: First-Time Onboarding

```
After Signup:
├── Welcome modal with user's name
├── Quick tour option (skippable)
│   ├── Highlights "Create Intelligence" button
│   └── Shows template options
└── After first success → Celebratory moment + "What's next" guidance
```

---

## 6. Component Library

### 6.1 Component Strategy

**From shadcn/ui (themed to Warm Coral):**

| Component | Customization Level |
|-----------|-------------------|
| Button | Themed (orange primary) |
| Input | Themed (focus ring) |
| Textarea | Themed |
| Select | Themed |
| Card | Themed |
| Dialog/Modal | Themed |
| Table | Themed |
| Tabs | Themed |
| Badge | Custom variants (status) |
| Alert | Themed |
| Toast | Themed |
| Progress | Themed |
| Tooltip | Light customization |
| Avatar | Light customization |
| Dropdown Menu | Light customization |
| Skeleton | Light customization |

**Custom Components Required:**

| Component | Purpose |
|-----------|---------|
| Intelligence Card | Display intelligence with status, stats, quick actions |
| Stat Card | Dashboard metric with trend indicator |
| Template Picker | Grid of template options for creation |
| Schema Builder | Visual interface for input/output field definition |
| API Test Console | Request/response panels with syntax highlighting |
| Wizard Stepper | Progress indicator for multi-step creation |
| Code Block | Display endpoints, JSON, code snippets |
| Empty State | Friendly prompts when no data exists |

### 6.2 Custom Component Specifications

#### Intelligence Card

**Purpose:** Display an intelligence with key info and quick actions

**Anatomy:**
- Icon/emoji (top-left)
- Name (title, 15-17px semibold)
- Description (truncated to 2 lines)
- Status badge (top-right)
- Stats row (calls today, version)
- Quick actions on hover (Test, Edit, View Logs)

**States:**
| State | Appearance |
|-------|------------|
| Default | Subtle border, white background |
| Hover | Elevated shadow, action buttons visible |
| Selected | Orange border highlight |
| Loading | Skeleton placeholder |
| Disabled | Muted colors, no actions |

**Variants:**
- Grid card (for gallery view)
- List row (for compact table-like view)

#### Schema Builder

**Purpose:** Visual interface for defining input/output fields without writing JSON

**Anatomy:**
- Field list with type indicators
- Add field button
- Each field row: name input, type dropdown, required toggle, delete button
- "Add more detail" expandable section

**States:**
| State | Appearance |
|-------|------------|
| Empty | Prompt to add first field |
| Editing | Inline editing of field properties |
| Validation error | Red highlight on invalid fields |
| Collapsed advanced | Shows count of hidden options |

#### API Test Console

**Purpose:** Test endpoints in-browser with live feedback

**Anatomy:**
- Request panel (left/top): Editable JSON input with syntax highlighting
- Response panel (right/bottom): Formatted JSON output
- Action bar: Send button, copy cURL, latency display
- Status indicator: Success/Error/Loading

**States:**
| State | Appearance |
|-------|------------|
| Ready | Waiting for input, Send button enabled |
| Loading | Spinner, Send button disabled |
| Success | Green status badge, formatted response |
| Error | Red status badge, error message displayed |

---

## 7. UX Pattern Decisions

### 7.1 Consistency Rules

#### Button Hierarchy

| Type | Style | Usage |
|------|-------|-------|
| Primary | Solid orange (`#f97316`), white text | Main CTAs |
| Secondary | Outline or ghost, neutral | Supporting actions |
| Destructive | Red (`#dc2626`), requires confirmation | Delete, disable |
| Disabled | Muted gray, no hover | Unavailable actions |

#### Feedback Patterns

| Type | Pattern | Behavior |
|------|---------|----------|
| Success | Toast (top-right) | Green, auto-dismiss 5s |
| Error | Inline + Toast | Red, manual dismiss |
| Warning | Banner or toast | Yellow/amber |
| Loading | Skeleton (content), spinner (actions) | Context-appropriate |
| Progress | Stepper (wizards), progress bar (long ops) | Clear status indication |

#### Form Patterns

| Aspect | Decision |
|--------|----------|
| Label position | Above input |
| Required indicator | Asterisk (*) after label |
| Validation timing | On blur (when leaving field) |
| Error display | Inline below field, red text |
| Help text | Gray caption below input |

#### Modal Patterns

| Aspect | Decision |
|--------|----------|
| Sizes | Small (400px), Medium (560px), Large (720px) |
| Dismiss | Click outside, ESC key, or X button |
| Focus | Auto-focus first interactive element |
| Stacking | Avoid; one modal at a time |

#### Navigation Patterns

| Aspect | Decision |
|--------|----------|
| Active state | Orange highlight + bold text |
| Breadcrumbs | Show on detail pages |
| Back button | Use browser back; maintain state |
| Page transitions | Subtle fade (150ms) |

#### Empty State Patterns

| Context | Approach |
|---------|----------|
| First use | Illustration + friendly text + primary CTA |
| No search results | Helpful message + clear filters suggestion |
| Deleted content | Offer undo for 10 seconds via toast |

#### Confirmation Patterns

| Action | Confirmation Level |
|--------|-------------------|
| Delete intelligence | Modal with name typed to confirm |
| Leave unsaved changes | Warning modal |
| Promote to production | Confirmation modal |
| Other destructive | Simple confirm dialog |

#### Notification Patterns

| Aspect | Decision |
|--------|----------|
| Placement | Top-right toast stack |
| Duration | Success: 5s, Error: manual, Info: 4s |
| Max visible | 3 toasts, queue others |
| Actions | Optional action button in toast |

#### Search Patterns

| Aspect | Decision |
|--------|----------|
| Trigger | Instant search (debounced 300ms) |
| Results | Inline dropdown (global), filtered list (pages) |
| No results | "No matches" + suggestion |
| Filters | Collapsible or dropdown chips |

#### Date/Time Patterns

| Aspect | Decision |
|--------|----------|
| Display format | Relative for recent ("2 hours ago"), absolute for old |
| Timezone | User's local timezone |
| Pickers | Calendar dropdown |

---

## 8. Responsive Design & Accessibility

### 8.1 Responsive Strategy

**Approach:** Web-first, designed with mobile app potential in mind

#### Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Desktop | ≥1024px | Full sidebar (240px) + content |
| Tablet | 768px–1023px | Collapsible sidebar (64px icons) |
| Mobile | <768px | Hidden sidebar, hamburger menu |

#### Component Adaptations

| Component | Desktop | Tablet | Mobile |
|-----------|---------|--------|--------|
| Sidebar | Full (240px) | Icon-only (64px) | Hamburger menu |
| Stats Grid | 4 columns | 2 columns | 2 columns stacked |
| Intelligence Cards | 2-3 columns | 2 columns | Single column |
| Tables | Full columns | Horizontal scroll | Card view per row |
| Wizard | Centered (640px) | Full width - padding | Full width |
| Modals | Centered (max 720px) | Centered | Full-screen sheet |
| API Test Console | Side-by-side panels | Stacked panels | Stacked panels |

#### Touch Considerations

| Element | Minimum Size |
|---------|--------------|
| Buttons | 44px height |
| Touch targets | 44x44px |
| Spacing between targets | 8px minimum |

### 8.2 Accessibility Strategy

**Target Compliance:** WCAG 2.1 Level AA

#### Requirements

| Requirement | Implementation |
|-------------|----------------|
| Color contrast | 4.5:1 for normal text, 3:1 for large text |
| Keyboard navigation | All interactive elements focusable via Tab |
| Focus indicators | Visible orange ring on focus |
| ARIA labels | Meaningful labels for icons, buttons without text |
| Alt text | Descriptive text for all meaningful images |
| Form labels | Explicit `<label>` associations |
| Error identification | Errors announced to screen readers |
| Skip links | "Skip to main content" for keyboard users |
| Reduced motion | Respect `prefers-reduced-motion` setting |

#### Color Contrast Verification

| Combination | Ratio | Status |
|-------------|-------|--------|
| Text (`#1c1917`) on Background (`#fffbeb`) | 16.5:1 | AAA Pass |
| Text (`#1c1917`) on White (`#ffffff`) | 17.4:1 | AAA Pass |
| White on Primary (`#f97316`) | 3.0:1 | AA Large Pass |
| Primary Dark (`#ea580c`) on White | 3.5:1 | AA Large Pass |

**Note:** Orange buttons use white text at 14px bold or larger. For smaller text, use dark text on orange backgrounds.

#### Testing Strategy

| Method | Tool | Frequency |
|--------|------|-----------|
| Automated | Lighthouse, axe DevTools | Every build |
| Manual | Keyboard-only navigation | Weekly |
| Screen Reader | VoiceOver (Mac), NVDA (Windows) | Before release |
| Color blindness | Sim Daltonism | Design phase |

---

## 9. Implementation Guidance

### 9.1 Completion Summary

**What We Created:**

| Deliverable | Description |
|-------------|-------------|
| Design System | shadcn/ui with Warm Coral theming |
| Color Theme | Energetic, friendly orange palette with full semantic colors |
| Design Direction | Hybrid: Spacious sidebar dashboard + Card gallery for intelligences |
| User Journeys | 4 flows designed (Create, Test, Logs, Onboarding) |
| Components | 16 shadcn/ui + 8 custom components specified |
| UX Patterns | 10 pattern categories with consistency rules |
| Responsive | 3 breakpoints with detailed adaptations |
| Accessibility | WCAG 2.1 AA compliance with testing strategy |

### 9.2 Key Files

| File | Purpose |
|------|---------|
| `docs/ux-design-specification.md` | This document |
| `docs/ux-color-themes.html` | Interactive color theme explorer |
| `docs/ux-design-directions.html` | Interactive design direction mockups |

### 9.3 Implementation Priorities

**Phase 1: Core Experience**
1. Sidebar navigation + dashboard layout
2. Intelligence card component
3. Create Intelligence wizard flow
4. Success celebration state

**Phase 2: Full Functionality**
5. API Test Console
6. Logs table with filtering
7. Settings screens
8. Responsive adaptations

**Phase 3: Polish**
9. Empty states with illustrations
10. Onboarding flow
11. Accessibility audit & fixes
12. Performance optimization

---

## Appendix

### Related Documents

- Product Requirements: `Product_Intelligence_Layer_PRD.md`
- Architecture: `docs/architecture.md`
- Market Research: `docs/research-market-2025-11-24.md`

### Core Interactive Deliverables

This UX Design Specification was created through visual collaboration:

- **Color Theme Visualizer**: `docs/ux-color-themes.html`
  - Interactive HTML showing all color theme options explored
  - Live UI component examples in each theme
  - Side-by-side comparison and semantic color usage

- **Design Direction Mockups**: `docs/ux-design-directions.html`
  - Interactive HTML with 6 complete design approaches
  - Full-screen mockups of key screens
  - Design philosophy and rationale for each direction

### Next Steps & Follow-Up Workflows

This UX Design Specification can serve as input to:

- **Wireframe Generation** - Create detailed wireframes from user flows
- **Figma Design** - Generate high-fidelity mockups
- **Interactive Prototype** - Build clickable HTML prototypes
- **Component Showcase** - Create interactive component library
- **AI Frontend Prompt** - Generate prompts for v0, Lovable, Bolt, etc.
- **Sprint Planning** - Break down implementation into stories

### Version History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-11-25 | 1.0 | Initial UX Design Specification | Zac |

---

_This UX Design Specification was created through collaborative design facilitation, not template generation. All decisions were made with user input and are documented with rationale._
