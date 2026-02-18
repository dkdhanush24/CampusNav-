# Chatbot Module (UI Only)

**Status**: ✅ UI Completed (Frozen)
**Date**: 2026-01-17

## Overview
This module (`app/chatbot.tsx`) implements the frontend UI for the CampusNav AI Assistant.
It is designed with a **Minimal/Professional Dark Theme**.

## Key Features
-   **Framework**: React Native / Expo (Typescript).
-   **Design**: "True Dark" palette, no bold colors/gradients.
-   **keyboard**: Custom `KeyboardAvoidingView` logic to ensure input visibility on Android/iOS.
-   **Assets**: Uses `assets/images/icon_chatbot.png`.

## Integration Notes
-   This file contains **MOCK LOGIC** (`setTimeout`) for bot responses.
-   **Todo**: Replace the `handleSend` mock logic with the actual API call to the backend.
-   **Do Not Change**: The UI layout or styling (refinement is complete).
