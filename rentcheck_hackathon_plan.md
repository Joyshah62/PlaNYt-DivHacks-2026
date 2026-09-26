# Archived concept: RentCheck

> **Status: reference only.** The active application in this repository is Roam NYC, an NYC day-trip planner. This document preserves an earlier RentCheck apartment-analysis concept and does not describe the current product or codebase.

## Concept

RentCheck would help renters assess an apartment by address, combining building-condition records, nearby amenities, commute estimates, and user preferences into an explainable match summary.

## Possible data and flow

1. Geocode an apartment address.
2. Detect supported city coverage.
3. Retrieve available building violations/complaints, nearby places, and travel estimates.
4. Ask about priorities and common destinations.
5. Calculate a deterministic, explainable score and present the supporting evidence.

Potential sources included NYC HPD/311, available Newark records, OpenStreetMap/Overpass, and OSRM. Dataset availability, quality, coverage, and permitted use would need verification before implementation.

## Historical MVP sketch

The original idea focused on NYC and Newark: address entry, building history, nearby amenities, commute estimates, user preferences, and a compact result dashboard. Potential future ideas included comparisons, accounts, rent history, crime, and AI-written summaries. None of these are part of the current Roam NYC scope.
