// app/_layout.tsx
import { Stack } from "expo-router";
import Toast from "react-native-toast-message";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import "../index.css";
import { persistor, store } from "../redux/store";

export default function RootLayout() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="users" options={{ headerShown: false }} />
          <Stack.Screen name="admin" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="createuser" options={{ headerShown: false }} />
          <Stack.Screen name="edituser" options={{ headerShown: false }} />
          <Stack.Screen name="harvest" options={{ headerShown: false }} />
        </Stack>
      </PersistGate>
      <Toast />
    </Provider>
  );
}
