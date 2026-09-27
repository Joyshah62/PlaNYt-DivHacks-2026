# Roam NYC — Product and MVP

## Product

Roam helps NYC visitors plan a day, not just find directions between two places. It takes a list of interests, a natural-language request, or manually selected stops and builds a timed route that accounts for travel, opening hours, and neighborhood crowd patterns.

**Pitch:** Tell Roam what you want to see. It works out the best order and times so you spend less time travelling and arrive when places are open and the surrounding area is quieter.

## Who it serves

Visitors and locals planning a single day in New York, especially people unfamiliar with the city’s geography, opening schedules, and busy periods.

## Product principles

- **The user chooses what matters.** Natural language and manual selection are both supported.
- **The plan is explainable.** AI extracts intent; deterministic code orders and times the day.
- **The user stays in control.** Stops, dates, travel style, and alternatives can be changed and replanned.
- **Use open data where practical.** The core manual planning flow does not require an API key or account.
- **Be honest about estimates.** Area ridership is a crowd proxy; subway times and published hours have limits.

## Current product scope

The app currently includes:

- Natural-language plan creation and in-plan trip chat.
- Manual place browsing, search, and stop selection.
- Itinerary ordering and timing with hours, travel mode, crowd preference, profile, meals, and fixed-time stops.
- Alternatives for vague requests and meal breaks, compared by replanning the day.
- Map routes, stop details, photos, crowd charts, and itinerary playback.
- Weather-based day selection, Discover suggestions, and re-planning from the user’s current point in the day.
- Local saved plans, shareable links, and calendar export.

See the [architecture](architecture.md) for implementation and [UI/UX guide](UI-UX.md) for interaction details.

## Demo flow (3–5 minutes)

1. Enter a request such as: “Saturday with my partner: a museum, a skyline view, the Brooklyn Bridge, and pizza for lunch. Avoid crowds.”
2. Show the resulting itinerary and explain the order, timing, travel legs, hours, and neighborhood crowd strip.
3. Open a stop’s details and explain that the crowd chart is a neighborhood estimate derived from MTA station ridership.
4. Compare a different skyline option and show how the itinerary changes when replanned.
5. Ask TripChat to change the day, for example “make it end by 7pm.”
6. Save or share the plan, then show calendar export if time allows.

Demo copy should use the current generated itinerary; example times and savings in older pitch notes are illustrative, not guaranteed outputs.

## Out of scope for the current MVP

Multi-city and multi-day planning, live transit feeds, collaborative editing, and offline support are future ideas. The current product is NYC-focused and does not need accounts or a backend database for its core flow.
