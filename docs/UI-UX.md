# Roam NYC — UI/UX Guide

This guide describes the intended user-facing structure and interaction behavior. Product goals and demo flow are in [MVP](MVP.md); code and service flow are in [architecture](architecture.md).

## Experience goals

1. Let people describe what they want in plain language or choose places manually.
2. Show a useful timed plan on a map as soon as it is ready.
3. Make edits and replanning feel direct, with reasons visible.
4. Keep estimates, accessibility, and mobile behavior understandable.

## Pages

### Landing (`/`)

A full-screen introduction with the headline “See New York, not the crowds,” a single trip prompt, a live NYC map, and a short feature summary. Submitting the prompt opens `/plan?q=...` and starts planning. There is no sign-up gate. Include data attribution and clarify what the crowd estimate measures.

### Planner (`/plan`)

Desktop uses a resizable side panel beside a full-height map. Mobile uses a full-screen map with a draggable bottom sheet. The planner has Build and Itinerary views; the latter appears once a plan exists.

## Build view

- Natural-language prompt with quick-start examples.
- Saved plans, when available in local storage.
- Collapsible trip settings: date, travel mode, crowd preference, time range, meals, starting point, return-to-origin, and traveler profile.
- Searchable curated place catalog, grouped by category, with map markers and profile-based suggestions.

Keep common actions visible and place secondary settings behind the disclosure. Use native date and time inputs where possible.

## Itinerary view

Each stop card shows its sequence, place, scheduled time, visit duration, crowd level, opening-hours status, photo where available, and travel leg details. The map shows the origin, planned stops, and route legs. Give subway estimates a visible approximate marker.

The view can also include:

- **Insights:** concise reasons for schedule choices and tradeoffs.
- **Choices:** alternatives for vague requests or meals, with their effect on the day.
- **Day picker:** upcoming dates with forecast context.
- **TripChat:** conversational edits that rebuild the plan.
- **Discover:** suggestions that fit itinerary gaps.
- **Next Up:** current/next stop and re-planning from the user’s current location/time.
- **Actions:** save, copy share link, and export calendar.

## Place details

Selecting a marker or stop opens place details with photo and attribution, description, selected-day hours, crowd profile, visit duration, and add/remove or directions actions. If no photo exists, show a category-colored fallback.

## Responsive behavior

- Below 1024px, use the bottom sheet over the map; above it, use the split-pane layout.
- The mobile sheet has peek, half, and full positions. After planning it opens at half; playback can collapse it; focusing TripChat should reveal the composer.
- Keep map controls reachable and prevent the sheet from hiding essential actions.

## Accessibility

- Provide keyboard access and visible focus for all controls, including map markers and the desktop resize handle.
- Give icon-only controls accessible names and announce planning results/errors with polite live regions.
- Do not encode crowd or category meaning by color alone; include text labels.
- Respect reduced-motion preferences for playback and transitions.
- Use semantic headings, labels, buttons, and native form controls.

## Visual language

Use the brand accent for primary actions and category colors consistently across catalog, markers, and itinerary. Maintain readable contrast in light and dark themes. Body text should prioritize legibility; use the display face selectively for headings and emphasis.
