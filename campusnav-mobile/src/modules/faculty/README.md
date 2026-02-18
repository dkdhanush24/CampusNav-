# Faculty Module (Frontend UI)

**Status**: ✅ UI Completed (Frozen)
**Date**: 2026-01-17

## Overview
This module (`app/faculty.tsx`) implements the Faculty Directory and Search feature.
It allows users to find faculty members and locate their departments on the map.

## Key Features
-   **Data Source**: `src/modules/faculty/mockData.ts` (Static JSON).
-   **Search**: Real-time filtering by Name, Designation, and Department.
-   **Navigation**: "Find Location" button deep-links to `app/map.tsx` with `{ destination: department }`.

## UI/UX
-   **Theme**: Minimal Dark (`#09090b`).
-   **Layout**: `SectionList` grouped by Department.
-   **Interaction**: Expandable cards with LayoutAnimation.

## Integration Notes
-   The "Find Location" button currently opens the outdoor map.
-   Future: Add specific indoor navigation logic when ESP32 integration is ready.
