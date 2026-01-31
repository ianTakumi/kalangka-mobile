import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { User, Token } from "../../types/index";

interface AuthState {
  user: null | User;
  token: null | Token;
  isAuthenticated: boolean;
  isOnboardingCompleted?: boolean;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isOnboardingCompleted: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    login: (state, action: PayloadAction<{ user: User; token: Token }>) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
    },
    updateUser: (state, action: PayloadAction<Partial<AuthState["user"]>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
    updateOnboardingStatus: (state, action: PayloadAction<boolean>) => {
      state.isOnboardingCompleted = action.payload;
    },
  },
});

export const { login, logout, updateUser, updateOnboardingStatus } =
  authSlice.actions;
export default authSlice.reducer;
