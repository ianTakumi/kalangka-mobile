import NotificationService from "@/services/NotificationService";
import { Stack } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import Toast from "react-native-toast-message";
import { Provider, useSelector } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import "../index.css";
import { persistor, RootState, store } from "../redux/store";

function AppContent() {
  const user = useSelector((state: RootState) => state.auth.user);
  const lastCheckTime = useRef<number>(0);
  const isInitialized = useRef<boolean>(false);

  useEffect(() => {
    const setupNotifications = async () => {
      try {
        // Initialize notification service only once
        if (!isInitialized.current) {
          await NotificationService.init();
          isInitialized.current = true;
          console.log("📱 Notification service initialized");
        }

        // Add a small delay before first check to ensure everything is ready
        setTimeout(async () => {
          const now = Date.now();
          lastCheckTime.current = now;

          if (user) {
            console.log(`👤 User logged in: ${user.role}`);
            await NotificationService.manualCheck(user.role, user.id);
          } else {
            console.log("👤 No user logged in, skipping notification check");
            // Don't run manualCheck when no user
          }
        }, 2000);
      } catch (error) {
        console.error("Failed to initialize notifications:", error);
      }
    };

    setupNotifications();

    // Check when app comes to foreground
    const subscription = AppState.addEventListener("change", async (state) => {
      if (state === "active") {
        const now = Date.now();
        // Only check if last check was more than 30 seconds ago
        if (now - lastCheckTime.current > 30000) {
          lastCheckTime.current = now;
          console.log("📱 App foregrounded, checking notifications...");

          if (user) {
            await NotificationService.manualCheck(user.role, user.id);
          } else {
            console.log("👤 No user logged in, skipping notification check");
          }
        } else {
          console.log(
            "⏭️ Skipping notification check - last check was too recent",
          );
        }
      }
    });

    return () => subscription.remove();
  }, [user]); // Re-run when user changes

  return (
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
  );
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <AppContent />
        <Toast />
      </PersistGate>
    </Provider>
  );
}
