# Redux Quick Start Guide - Profile Setup

## 🎯 One-Page Reference

### Import Redux Hooks

```typescript
import { useAppDispatch, useAppSelector } from "@/store/hooks";
```

### Get State

```typescript
const dispatch = useAppDispatch();
const { profilePhotoPreview, isLoading, submitError } = useAppSelector((state) => state.profile);
```

### Dispatch Actions

```typescript
import {
  setProfilePhotoPreview,
  setIsLoading,
  setSubmitError,
  setSuccessMessage,
  setNewLocationLabel,
  setNewLocationAddress,
} from "@/store/slices/profileSlice";

// Update state
dispatch(setIsLoading(true));
dispatch(setSubmitError("Error message"));
dispatch(setSuccessMessage("Success!"));
dispatch(setProfilePhotoPreview("data:image/..."));
dispatch(setNewLocationLabel("Home"));
dispatch(setNewLocationAddress("123 Main St"));
```

---

## 📋 Profile State Properties

```typescript
interface ProfileState {
  profilePhotoPreview: string; // Image as base64
  successMessage: string | null; // Success notification
  submitError: string | null; // Error notification
  newLocationLabel: string; // Location name input
  newLocationAddress: string; // Location address input
  isLoading: boolean; // Saving in progress
}
```

---

## 🔗 Common Patterns

### Pattern: Loading State

```typescript
const { isLoading } = useAppSelector((state) => state.profile);

<Button disabled={isLoading}>
  {isLoading ? "Saving..." : "Save"}
</Button>
```

### Pattern: Error Handling

```typescript
const { submitError } = useAppSelector((state) => state.profile);

if (submitError) {
  return <div className="error">{submitError}</div>;
}
```

### Pattern: Success Message

```typescript
const { successMessage } = useAppSelector((state) => state.profile);

{successMessage && (
  <div className="success">{successMessage}</div>
)}
```

### Pattern: Async Operation

```typescript
const dispatch = useAppDispatch();

const handleSave = async (data) => {
  dispatch(setIsLoading(true));
  dispatch(setSubmitError(null));

  try {
    const result = await saveProfile(data);
    if (result.ok) {
      dispatch(setSuccessMessage("Saved!"));
    } else {
      dispatch(setSubmitError(result.error));
    }
  } catch (error) {
    dispatch(setSubmitError(error.message));
  } finally {
    dispatch(setIsLoading(false));
  }
};
```

### Pattern: Form Input

```typescript
const { newLocationLabel } = useAppSelector((state) => state.profile);

<input
  value={newLocationLabel}
  onChange={(e) => dispatch(setNewLocationLabel(e.target.value))}
/>
```

---

## 🎨 UI Binding Examples

### Photo Upload

```typescript
const { profilePhotoPreview } = useAppSelector(
  (state) => state.profile
);

const handleUpload = (file) => {
  const reader = new FileReader();
  reader.onload = () => {
    dispatch(setProfilePhotoPreview(reader.result));
  };
  reader.readAsDataURL(file);
};

<img src={profilePhotoPreview} alt="Preview" />
```

### Location List

```typescript
const addLocation = () => {
  // Add to form...
  dispatch(setNewLocationLabel(""));
  dispatch(setNewLocationAddress(""));
};
```

### Submit Button

```typescript
const { isLoading } = useAppSelector((state) => state.profile);

<button disabled={isLoading} onClick={handleSubmit}>
  {isLoading ? <Spinner /> : "Save Profile"}
</button>
```

---

## 📝 Action Reference

| Action                          | Parameter        | Returns |
| ------------------------------- | ---------------- | ------- |
| `setProfilePhotoPreview(value)` | `string`         | void    |
| `setSuccessMessage(value)`      | `string \| null` | void    |
| `setSubmitError(value)`         | `string \| null` | void    |
| `setNewLocationLabel(value)`    | `string`         | void    |
| `setNewLocationAddress(value)`  | `string`         | void    |
| `setIsLoading(value)`           | `boolean`        | void    |
| `clearMessages()`               | -                | void    |
| `resetProfileState()`           | -                | void    |

---

## 🔍 State Selectors

### Single Property

```typescript
const isLoading = useAppSelector((state) => state.profile.isLoading);
```

### Multiple Properties

```typescript
const { isLoading, submitError, successMessage } = useAppSelector((state) => state.profile);
```

### Computed Value

```typescript
const hasError = useAppSelector((state) => state.profile.submitError !== null);
```

---

## ⚡ Performance Tips

1. **Selector Memoization**

```typescript
// ❌ Creates new object on each render
const state = useAppSelector((state) => ({
  isLoading: state.profile.isLoading,
  error: state.profile.submitError,
}));

// ✅ Better - separate selectors
const isLoading = useAppSelector((state) => state.profile.isLoading);
const error = useAppSelector((state) => state.profile.submitError);
```

2. **Conditional Rendering**

```typescript
// Only re-render if submitError changes
const error = useAppSelector((state) => state.profile.submitError);
if (error) <ErrorComponent />
```

---

## 🐛 Debugging

### View Redux State

In browser console:

```javascript
// With Redux DevTools extension installed
window.__REDUX_DEVTOOLS_EXTENSION__;
```

### Log Dispatched Actions

```typescript
const dispatch = useAppDispatch();

const handleClick = () => {
  console.log("Dispatching setIsLoading(true)");
  dispatch(setIsLoading(true));
};
```

### Check Current State

```typescript
const state = useAppSelector((state) => state.profile);
console.log("Current profile state:", state);
```

---

## 🚨 Common Mistakes

### ❌ Wrong: Mutating state

```typescript
const state = useAppSelector((state) => state.profile);
state.isLoading = true; // ❌ Direct mutation
```

### ✅ Correct: Dispatch action

```typescript
dispatch(setIsLoading(true)); // ✅ Use reducer
```

### ❌ Wrong: Forgetting dispatch

```typescript
setIsLoading(true); // ❌ This won't work
```

### ✅ Correct: Using dispatch

```typescript
dispatch(setIsLoading(true)); // ✅ Correct
```

---

## 📂 File Locations

| Purpose           | File                               |
| ----------------- | ---------------------------------- |
| Redux hooks       | `src/store/hooks.ts`               |
| Store config      | `src/store/index.ts`               |
| Profile state     | `src/store/slices/profileSlice.ts` |
| Profile component | `src/client/profile-setup.tsx`     |

---

## 🎓 Key Concepts

**Action:** Command to update state

```typescript
dispatch(setIsLoading(true));
```

**Reducer:** Function that updates state

```typescript
setIsLoading: (state, action) => {
  state.isLoading = action.payload;
};
```

**Selector:** Function that reads state

```typescript
useAppSelector((state) => state.profile.isLoading);
```

**Dispatch:** Function to trigger actions

```typescript
const dispatch = useAppDispatch();
dispatch(setIsLoading(true));
```

---

## 🔗 Related Documentation

- **Full Guide:** `REDUX_PROFILE_SETUP_DOCUMENTATION.md`
- **Implementation Summary:** `REDUX_IMPLEMENTATION_SUMMARY.md`
- **Redux Toolkit Docs:** https://redux-toolkit.js.org/

---

**Version:** 1.0  
**Last Updated:** May 18, 2026  
**Status:** ✅ Ready for Use
