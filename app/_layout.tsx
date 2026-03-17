// // app/_layout.tsx
// import NotificationService from "@/services/NotificationService";
// import { Stack } from "expo-router";
// import { useEffect } from "react";
// import { AppState } from "react-native";
// import Toast from "react-native-toast-message";
// import { Provider } from "react-redux";
// import { PersistGate } from "redux-persist/integration/react";
// import "../index.css";
// import { persistor, store } from "../redux/store";

// export default function RootLayout() {
//   useEffect(() => {
//     const setupNotifications = async () => {
//       try {
//         // Initialize notification service
//         await NotificationService.init();
//         console.log("📱 Notification service initialized");

//         // Run manual check on app start
//         await NotificationService.manualCheck();
//       } catch (error) {
//         console.error("Failed to initialize notifications:", error);
//       }
//     };

//     setupNotifications();

//     // Check when app comes to foreground
//     const subscription = AppState.addEventListener("change", async (state) => {
//       if (state === "active") {
//         console.log("📱 App foregrounded, checking notifications...");
//         await NotificationService.manualCheck();
//       }
//     });

//     return () => subscription.remove();
//   }, []);

//   return (
//     <Provider store={store}>
//       <PersistGate loading={null} persistor={persistor}>
//         <Stack>
//           <Stack.Screen name="index" options={{ headerShown: false }} />
//           <Stack.Screen name="users" options={{ headerShown: false }} />
//           <Stack.Screen name="admin" options={{ headerShown: false }} />
//           <Stack.Screen name="onboarding" options={{ headerShown: false }} />
//           <Stack.Screen name="login" options={{ headerShown: false }} />
//           <Stack.Screen name="createuser" options={{ headerShown: false }} />
//           <Stack.Screen name="edituser" options={{ headerShown: false }} />
//           <Stack.Screen name="harvest" options={{ headerShown: false }} />
//         </Stack>
//       </PersistGate>
//       <Toast />
//     </Provider>
//   );
// }

// app/_layout.tsx
import NotificationService from "@/services/NotificationService";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { AppState } from "react-native";
import Toast from "react-native-toast-message";
import { Provider, useSelector } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import "../index.css";
import { persistor, RootState, store } from "../redux/store";

// Separate component para magamit ang useSelector
function AppContent() {
  const user = useSelector((state: RootState) => state.auth.user);

  useEffect(() => {
    const setupNotifications = async () => {
      try {
        // Initialize notification service
        await NotificationService.init();
        console.log("📱 Notification service initialized");

        // Run manual check with user role if available
        if (user) {
          console.log(`👤 User logged in: ${user.role}`);
          await NotificationService.manualCheck(user.role, user.id);
        } else {
          console.log("👤 No user logged in, running system check");
          await NotificationService.manualCheck();
        }
      } catch (error) {
        console.error("Failed to initialize notifications:", error);
      }
    };

    setupNotifications();

    // Check when app comes to foreground
    const subscription = AppState.addEventListener("change", async (state) => {
      if (state === "active") {
        console.log("📱 App foregrounded, checking notifications...");

        if (user) {
          await NotificationService.manualCheck(user.role, user.id);
        } else {
          await NotificationService.manualCheck();
        }
      }
    });

    return () => subscription.remove();
  }, [user]); // <- Depend on user para mag-run ulit pag nag-login

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
