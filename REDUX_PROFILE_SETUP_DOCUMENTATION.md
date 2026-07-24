# Redux State Management - Profile Setup Page Documentation

## Overview

The Profile Setup page now uses **Redux Toolkit** for centralized state management. This document outlines the Redux architecture, implementation, and usage patterns.

---

## 📁 File Structure

```
src/
├── store/
│   ├── index.ts                    # Redux store configuration
│   ├── hooks.ts                    # Custom Redux hooks
│   ├── authSlice.ts                # Authentication state (existing)
│   └── slices/
│       └── profileSlice.ts         # Profile state slice
├── client/
│   └── profile-setup.tsx           # Profile setup page (Redux integrated)
```

---

## 🔧 Redux Store Configuration

### File: `src/store/index.ts`

```typescript
import { configureStore } from "@reduxjs/toolkit";
import { authReducer } from "./authSlice";
import profileReducer from "./slices/profileSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    profile: profileReducer, // Profile state slice
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

**Key Points:**

- Uses `configureStore()` from Redux Toolkit
- Combines `auth` and `profile` reducers
- Exports TypeScript types for type-safe state and dispatch

---

## 🎯 Profile Slice

### File: `src/store/slices/profileSlice.ts`

**State Interface:**

```typescript
interface ProfileState {
  profilePhotoPreview: string; // Base64 preview of profile image
  successMessage: string | null; // Success notification
  submitError: string | null; // Error message
  newLocationLabel: string; // Location name input
  newLocationAddress: string; // Location address input
  isLoading: boolean; // Loading state during save
}
```

**Initial State:**

```typescript
const initialState: ProfileState = {
  profilePhotoPreview: "",
  successMessage: null,
  submitError: null,
  newLocationLabel: "",
  newLocationAddress: "",
  isLoading: false,
};
```

### Actions (Reducers)

| Action                   | Type             | Purpose                           |
| ------------------------ | ---------------- | --------------------------------- |
| `setProfilePhotoPreview` | `string`         | Update profile photo preview      |
| `setSuccessMessage`      | `string \| null` | Set success message               |
| `setSubmitError`         | `string \| null` | Set error message                 |
| `setNewLocationLabel`    | `string`         | Update new location label input   |
| `setNewLocationAddress`  | `string`         | Update new location address input |
| `setNewHiringNeed`       | `string`         | Update hiring need text input     |
| `setIsLoading`           | `boolean`        | Toggle loading state              |
| `clearMessages`          | `void`           | Clear success and error messages  |
| `resetProfileState`      | `void`           | Reset entire profile state        |

---

## 🪝 Custom Hooks

### File: `src/store/hooks.ts`

```typescript
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

**Benefits:**

- Type-safe access to state and dispatch
- Eliminates need to import types repeatedly
- Ensures consistency across the app

---

## 💻 Integration in Profile Setup Page

### File: `src/client/profile-setup.tsx`

#### 1. Imports

```typescript
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setProfilePhotoPreview,
  setSuccessMessage,
  setSubmitError,
  setNewLocationLabel,
  setNewLocationAddress,
  setIsLoading,
} from "@/store/slices/profileSlice";
```

#### 2. State Access

```typescript
function ProfileSetup() {
  const dispatch = useAppDispatch();

  // Destructure state from Redux store
  const {
    profilePhotoPreview,
    successMessage,
    submitError,
    newLocationLabel,
    newLocationAddress,
    isLoading,
  } = useAppSelector((state) => state.profile);

  // Form state (still using React Hook Form)
  const form = useForm<ClientProfileInput>({
    resolver: zodResolver(clientProfileSchema),
    defaultValues: {
      /* ... */
    },
  });
}
```

#### 3. Dispatching Actions

**Photo Upload:**

```typescript
async function handlePhotoUpload(file: File | undefined) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const result = typeof reader.result === "string" ? reader.result : "";
    dispatch(setProfilePhotoPreview(result)); // Dispatch action
    form.setValue("profilePhotoUrl", result, { shouldValidate: true });
  };
  reader.readAsDataURL(file);
}
```

**Add Location:**

```typescript
const addSavedLocation = () => {
  if (!newLocationLabel.trim() || !newLocationAddress.trim()) {
    dispatch(setSubmitError("Enter both location name and address..."));
    return;
  }

  dispatch(setSubmitError(null));  // Clear errors
  form.setValue("savedLocations", [...savedLocations, {...}], {...});
  dispatch(setNewLocationLabel(""));    // Reset input
  dispatch(setNewLocationAddress(""));  // Reset input
};
```

**Form Submission:**

```typescript
const onSubmit = async (values: ClientProfileInput) => {
  dispatch(setSubmitError(null));
  dispatch(setSuccessMessage(null));
  dispatch(setIsLoading(true)); // Start loading

  try {
    const result = await saveClientProfile({ data: values });

    if (!result.ok) {
      dispatch(setSubmitError(result.formError));
      return;
    }

    if (result.profile) {
      dispatch(setProfilePhotoPreview(result.profile.avatarUrl ?? ""));
    }

    dispatch(setSuccessMessage("Profile saved successfully..."));
  } finally {
    dispatch(setIsLoading(false)); // Stop loading
  }
};
```

#### 4. Input Binding

```typescript
<Input
  placeholder="Location name"
  value={newLocationLabel}
  onChange={(event) => dispatch(setNewLocationLabel(event.target.value))}
/>
```

#### 5. Button States

```typescript
<Button type="submit" disabled={isLoading}>
  <Save className="h-4 w-4" />
  {isLoading ? "Saving..." : "Save client profile"}
</Button>
```

---

## 📊 State Management Architecture

```
┌─────────────────────────────────────────────┐
│         Redux Store (src/store/)            │
│                                             │
│  ┌─────────────┬──────────────────────┐   │
│  │   Auth      │    Profile           │   │
│  │   Slice     │    Slice             │   │
│  │             │                      │   │
│  │ - user      │ - photo              │   │
│  │ - token     │ - messages           │   │
│  │             │ - location inputs    │   │
│  │             │ - loading state      │   │
│  └─────────────┴──────────────────────┘   │
└─────────────────────────────────────────────┘
         ▲
         │ useAppDispatch()
         │ useAppSelector()
         │
┌─────────────────────────────────────────────┐
│   Profile Setup Component                   │
│   (src/client/profile-setup.tsx)            │
│                                             │
│  - Dispatches actions on user input        │
│  - Reads state for rendering               │
│  - Handles form submission                 │
└─────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Example: Save Profile

1. **User submits form** → `onSubmit()` handler called
2. **Dispatch loading state** → `dispatch(setIsLoading(true))`
3. **Call server action** → `await saveClientProfile()`
4. **Success path:**
   - Update photo preview: `dispatch(setProfilePhotoPreview(...))`
   - Show message: `dispatch(setSuccessMessage(...))`
5. **Error path:**
   - Show error: `dispatch(setSubmitError(...))`
6. **Finally block** → `dispatch(setIsLoading(false))`
7. **Component re-renders** with updated state

---

## ✅ Benefits of Redux Implementation

| Benefit               | Details                                               |
| --------------------- | ----------------------------------------------------- |
| **Centralized State** | All profile state in one place, easy to debug         |
| **Type Safety**       | TypeScript types for all state and actions            |
| **Scalability**       | Easy to add new state slices for other features       |
| **Testability**       | Pure reducers can be tested independently             |
| **Time Travel**       | Redux DevTools for debugging state changes            |
| **Predictability**    | Unidirectional data flow (actions → reducers → state) |

---

## 🛠️ Usage Patterns

### Pattern 1: Simple State Update

```typescript
dispatch(setProfilePhotoPreview(newPhoto));
```

### Pattern 2: Conditional State Update

```typescript
if (error) {
  dispatch(setSubmitError(error.message));
} else {
  dispatch(setSubmitError(null));
}
```

### Pattern 3: Multiple State Updates

```typescript
dispatch(setIsLoading(true));
dispatch(setSubmitError(null));
dispatch(setSuccessMessage(null));
```

### Pattern 4: State-Based Rendering

```typescript
{isLoading ? "Saving..." : "Save client profile"}
{successMessage && <div>{successMessage}</div>}
{submitError && <div>{submitError}</div>}
```

---

## 🧪 Testing with Redux DevTools

**Installation:**

```bash
npm install --save-dev redux-devtools
```

**Features:**

- Time travel debugging
- Action history
- State snapshots
- Dispatch actions manually

---

## 📝 API Endpoints (Server Functions)

The profile setup page communicates with the server through two main server functions in `src/client/profile-setup.tsx`.

### Get Profile Data

This GET handler runs before the page loads, ensures the user is signed in, and fetches the current profile data for a client.

```typescript
const getProfileSetupData = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = requireCurrentUser();
  const clientProfile = viewer.role === "CLIENT" ? getClientProfileByUserId(viewer.id) : null;

  return {
    viewer,
    clientProfile,
  };
});
```

- `requireCurrentUser()` enforces authentication and redirects to login if needed.
- `getClientProfileByUserId()` loads the saved profile from the database.
- Returned values are available through `useLoaderData()` in the component.

### Save Profile Data

The POST handler validates the incoming profile data and writes it to the database.

```typescript
const saveClientProfile = createServerFn({ method: "POST" })
  .inputValidator((data: ClientProfileInput) => clientProfileSchema.parse(data))
  .handler(async ({ data }) => {
    const viewer = requireCurrentUser();

    if (viewer.role !== "CLIENT") {
      return {
        ok: false as const,
        formError: "Only client accounts can save this onboarding flow.",
      };
    }

    const normalizedEmail = data.email.trim().toLowerCase();
    const normalizedPhone = data.phone.trim();
    const existingUser = findUserByEmailOrPhone(normalizedEmail, normalizedPhone);

    if (existingUser && existingUser.id !== viewer.id) {
      return {
        ok: false as const,
        formError:
          existingUser.email === normalizedEmail
            ? "This email address is already registered."
            : "This phone number is already registered.",
      };
    }

    const profile = updateClientProfileByUserId({
      userId: viewer.id,
      fullName: data.fullName,
      email: normalizedEmail,
      phone: normalizedPhone,
      companyName: data.companyName,
      companyWebsite: data.companyWebsite || null,
      industry: data.industry,
      teamSize: data.teamSize,
      companyDescription: data.companyDescription,
      address: data.address,
      avatarUrl: data.profilePhotoUrl || undefined,
      savedLocations: data.savedLocations,
      hiringNeeds: data.hiringNeeds,
    });

    return {
      ok: true as const,
      profile,
    };
  });
```

- Validation is performed on the server with the same Zod schema used in the UI.
- The handler also blocks non-client users and duplicate email/phone registration.
- The response includes `ok`, the saved `profile`, and `formError` when needed.

---

## 🧱 Database Persistence

Profile setup persists structured client profile data in the local SQLite-backed database.

### Tables involved

- `ClientProfile`
  - Stores the main client company profile fields.
  - Includes `fullName`, `email`, `phone`, `companyName`, `industry`, `teamSize`, `companyDescription`, `address`, and `profilePhotoUrl`.

- `ClientSavedLocation`
  - Stores the saved service addresses a client adds.
  - Each row links to `clientProfileId` and stores `label` and `address`.

- `ClientHiringNeed`
  - Stores the hiring needs / skills the client selects.
  - Each row links to `clientProfileId` and stores the chosen `value`.

- `User`
  - The main user table also keeps core account fields and can store profile-related information.
  - The profile setup flow may update some fields here, such as `avatarUrl`, `companyName`, `companyWebsite`, `industry`, `teamSize`, `companyDescription`, `address`, `savedLocationsJson`, and `hiringNeedsJson`.

### How the database schema is managed

The database code in `src/lib/user-db.server.ts` ensures the tables exist and recovers from missing columns when needed.

- `ensureUserTableShape(db)` checks the `User` table and rebuilds it if required.
- `ensureClientProfileTables(db)` creates `ClientProfile`, `ClientSavedLocation`, and `ClientHiringNeed` tables.
- The schema is resilient: if a column is missing, it is added automatically.

### Why this matters

The profile setup flow is not just a UI form:

- it validates input,
- it writes consistent structured data,
- and it keeps client onboarding data available for later dashboard pages.

---

## 🔐 Validation & Error Handling

**Form Validation (Zod):**

```typescript
const clientProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Name must be at least 2 characters."),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z.string().trim().min(6, "Phone number must be at least 6 digits."),
  companyName: z
    .string()
    .trim()
    .min(2, "Company name must be at least 2 characters.")
    .max(120, "Company name is too long."),
  companyWebsite: z.string().trim().url("Enter a valid website URL.").optional().or(z.literal("")),
  industry: z.string().trim().min(2, "Choose or enter an industry."),
  teamSize: z.string().trim().min(1, "Select a team size."),
  companyDescription: z
    .string()
    .trim()
    .min(20, "Company description must be at least 20 characters.")
    .max(600, "Company description is too long."),
  address: z.string().trim().min(5, "Address must be at least 5 characters."),
  profilePhotoUrl: z.string().trim().optional().or(z.literal("")),
  savedLocations: z.array(savedLocationSchema).min(1, "Add at least one saved location."),
  hiringNeeds: z.array(hiringNeedSchema).min(1, "Add at least one hiring need or skill."),
});
```

**Server-Side Error Handling:**

```typescript
if (!result.ok) {
  dispatch(setSubmitError(result.formError));
  return;
}
```

---

## 📚 Related Files

- **Store Config:** `src/store/index.ts`
- **Hooks:** `src/store/hooks.ts`
- **Profile Slice:** `src/store/slices/profileSlice.ts`
- **Auth Slice:** `src/store/authSlice.ts`
- **Component:** `src/client/profile-setup.tsx`
- **Validation:** `src/lib/validation/client-profile.ts`
- **Database:** `src/lib/user-db.server.ts`

---

## 🎓 Key Concepts

### Redux Toolkit

- Simplifies Redux setup with `configureStore()`
- Built-in support for Immer (immutable state updates)
- `createSlice()` combines actions and reducers

### Selectors

```typescript
useAppSelector((state) => state.profile.isLoading);
```

- Retrieves data from Redux store
- Triggers re-render on value change

### Dispatch

```typescript
dispatch(setIsLoading(true));
```

- Triggers reducer functions
- Updates store state
- Causes components using that state to re-render

---

## 🚀 Future Enhancements

1. **Add Redux Middleware** for async actions
2. **Implement Redux Persist** to save state to localStorage
3. **Add Redux DevTools Integration** for better debugging
4. **Create Selectors** for complex state derivations
5. **Add Loading States** for multiple async operations

---

## 📞 Support & Questions

For questions about Redux implementation or state management patterns, refer to:

- [Redux Toolkit Documentation](https://redux-toolkit.js.org/)
- [React-Redux Hooks](https://react-redux.js.org/api/hooks)
- [Redux DevTools](https://github.com/reduxjs/redux-devtools)

---

**Last Updated:** May 18, 2026  
**Status:** ✅ Implemented and Tested
