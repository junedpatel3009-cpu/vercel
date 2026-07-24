# Profile Setup Overview

A short, point-based summary of how client profile setup works in this app.

## What it does

- Loads the current client profile for onboarding.
- Lets clients enter company details, saved locations, and hiring needs.
- Saves the finished profile back to the server.

## Key files

- `src/client/profile-setup.tsx` – profile page and server functions.
- `src/store/slices/profileSlice.ts` – Redux state for page UI.
- `src/store/index.ts` – Redux store setup.
- `src/lib/validation/client-profile.ts` – Zod schema for profile data.
- `src/lib/user-db.server.ts` – database persistence.

## API flow

- `getProfileSetupData` (GET)
  - checks auth
  - loads the saved client profile
  - returns `viewer` and `clientProfile`
- `saveClientProfile` (POST)
  - validates data with Zod
  - blocks non-client users
  - checks duplicate email/phone
  - updates client profile in the database

## Redux state in the page

- Stores temporary UI values, not form content:
  - `profilePhotoPreview`
  - `newLocationLabel`
  - `newLocationAddress`
  - `newHiringNeed`
  - `successMessage`
  - `submitError`
  - `isLoading`
- Uses `useAppSelector()` to read state.
- Uses `useAppDispatch()` to update state.

## Why Redux is used

- Keeps UI state separate from form state.
- Makes loading and error handling visible.
- Supports predictable state changes.

## Database details

- Uses SQLite-backed persistence.
- `ClientProfile`, `ClientSavedLocation`, and `ClientHiringNeed` store saved data.
- `user-db.server.ts` ensures required tables and columns exist.

## Important behavior

- The UI and server share the same validation rules.
- Errors are handled in Redux and shown on the page.
- Successful saves update the profile and let the client continue.
