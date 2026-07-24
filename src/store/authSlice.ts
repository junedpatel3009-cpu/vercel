import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type LoginState = {
  submitError: string | null;
  successMessage: string | null;
  isSubmitting: boolean;
};

type SignupState = {
  submitError: string | null;
  successMessage: string | null;
  showPassword: boolean;
  otpStatus: string | null;
  isSendingOtp: boolean;
  isSubmitting: boolean;
};

type AuthState = {
  login: LoginState;
  signup: SignupState;
};

const initialState: AuthState = {
  login: {
    submitError: null,
    successMessage: null,
    isSubmitting: false,
  },
  signup: {
    submitError: null,
    successMessage: null,
    showPassword: false,
    otpStatus: null,
    isSendingOtp: false,
    isSubmitting: false,
  },
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearLoginFeedback(state) {
      state.login.submitError = null;
      state.login.successMessage = null;
    },
    setLoginSubmitError(state, action: PayloadAction<string | null>) {
      state.login.submitError = action.payload;
    },
    setLoginSuccessMessage(state, action: PayloadAction<string | null>) {
      state.login.successMessage = action.payload;
    },
    setLoginSubmitting(state, action: PayloadAction<boolean>) {
      state.login.isSubmitting = action.payload;
    },
    resetLoginState(state) {
      state.login = initialState.login;
    },
    clearSignupFeedback(state) {
      state.signup.submitError = null;
      state.signup.successMessage = null;
    },
    setSignupSubmitError(state, action: PayloadAction<string | null>) {
      state.signup.submitError = action.payload;
    },
    setSignupSuccessMessage(state, action: PayloadAction<string | null>) {
      state.signup.successMessage = action.payload;
    },
    setSignupShowPassword(state, action: PayloadAction<boolean>) {
      state.signup.showPassword = action.payload;
    },
    setSignupOtpStatus(state, action: PayloadAction<string | null>) {
      state.signup.otpStatus = action.payload;
    },
    setSignupSendingOtp(state, action: PayloadAction<boolean>) {
      state.signup.isSendingOtp = action.payload;
    },
    setSignupSubmitting(state, action: PayloadAction<boolean>) {
      state.signup.isSubmitting = action.payload;
    },
    resetSignupState(state) {
      state.signup = initialState.signup;
    },
  },
});

export const {
  clearLoginFeedback,
  clearSignupFeedback,
  resetLoginState,
  resetSignupState,
  setLoginSubmitError,
  setLoginSubmitting,
  setLoginSuccessMessage,
  setSignupOtpStatus,
  setSignupSendingOtp,
  setSignupShowPassword,
  setSignupSubmitError,
  setSignupSubmitting,
  setSignupSuccessMessage,
} = authSlice.actions;

export const authReducer = authSlice.reducer;
