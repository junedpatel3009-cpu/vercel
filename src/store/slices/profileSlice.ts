import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface ProfileState {
  profilePhotoPreview: string;
  successMessage: string | null;
  submitError: string | null;
  newLocationLabel: string;
  newLocationAddress: string;
  newHiringNeed: string;
  isLoading: boolean;
}

const initialState: ProfileState = {
  profilePhotoPreview: "",
  successMessage: null,
  submitError: null,
  newLocationLabel: "",
  newLocationAddress: "",
  newHiringNeed: "",
  isLoading: false,
};

const profileSlice = createSlice({
  name: "profile",
  initialState,
  reducers: {
    setProfilePhotoPreview: (state, action: PayloadAction<string>) => {
      state.profilePhotoPreview = action.payload;
    },
    setSuccessMessage: (state, action: PayloadAction<string | null>) => {
      state.successMessage = action.payload;
    },
    setSubmitError: (state, action: PayloadAction<string | null>) => {
      state.submitError = action.payload;
    },
    setNewLocationLabel: (state, action: PayloadAction<string>) => {
      state.newLocationLabel = action.payload;
    },
    setNewLocationAddress: (state, action: PayloadAction<string>) => {
      state.newLocationAddress = action.payload;
    },
    setNewHiringNeed: (state, action: PayloadAction<string>) => {
      state.newHiringNeed = action.payload;
    },
    setIsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    resetProfileState: (state) => {
      state.successMessage = null;
      state.submitError = null;
      state.newLocationLabel = "";
      state.newLocationAddress = "";
      state.newHiringNeed = "";
      state.isLoading = false;
    },
    clearMessages: (state) => {
      state.successMessage = null;
      state.submitError = null;
    },
  },
});

export const {
  setProfilePhotoPreview,
  setSuccessMessage,
  setSubmitError,
  setNewLocationLabel,
  setNewLocationAddress,
  setNewHiringNeed,
  setIsLoading,
  resetProfileState,
  clearMessages,
} = profileSlice.actions;

export default profileSlice.reducer;
