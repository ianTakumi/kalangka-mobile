import flowerService from "@/services/FlowerService";
import fruitService from "@/services/FruitService";
import HarvestService from "@/services/HarvestService";
import treeService from "@/services/treeService";
import userService from "@/services/UserService";
import NetInfo from "@react-native-community/netinfo";
import { Redirect } from "expo-router";
import { Database, Leaf, Loader2, Wifi, WifiOff } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Animated, AppState, AppStateStatus, Text, View } from "react-native";
import { useSelector } from "react-redux";
import { RootState } from "../redux/store";

export default function Index() {
  const [isChecking, setIsChecking] = useState(true);
  const [initProgress, setInitProgress] = useState<string>("Initializing...");
  const [initError, setInitError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [syncStats, setSyncStats] = useState<{
    synced: number;
    errors: string[];
  } | null>(null);

  const spinValue = useRef(new Animated.Value(0)).current;
  const appState = useRef(AppState.currentState);

  const user = useSelector((state: RootState) => state.auth.user);
  const isOnboardingCompleted = useSelector(
    (state: RootState) => state.auth?.isOnboardingCompleted,
  );
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth?.isAuthenticated,
  );

  // Animate spinner
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    ).start();
  }, []);

  // Monitor network status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? false);
    });

    // Check initial network status
    NetInfo.fetch().then((state) => {
      setIsOnline(state.isConnected ?? false);
    });

    return () => unsubscribe();
  }, []);

  // Monitor app state for background/foreground changes
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );
    return () => subscription.remove();
  }, []);

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (
      appState.current.match(/inactive|background/) &&
      nextAppState === "active"
    ) {
      // App came to foreground - check sync if online
      const netState = await NetInfo.fetch();
      if (netState.isConnected) {
        console.log("📱 App came to foreground, checking sync...");
        // await initializeAndSync();
      }
    }
    appState.current = nextAppState;
  };

  // Initialize services
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      setInitProgress("Starting database...");

      // Step 1: Initialize ALL services in PARALLEL
      setInitProgress("Initializing databases...");

      await Promise.all([
        treeService.init(),
        userService.init(),
        flowerService.init(),
        fruitService.init(),
        HarvestService.init(),
      ]);

      console.log("✅ All databases initialized in parallel");

      // Step 4: Check network at mag-sync kung online
      const netState = await NetInfo.fetch();

      if (netState.isConnected) {
        setInitProgress("Online - Syncing with server...");
        await syncWithServer();
      } else {
        setInitProgress("Offline mode - Using local data");
      }

      setIsChecking(false);
    } catch (error: any) {
      console.error("❌ Initialization failed:", error);
      setInitError(error.message || "Failed to initialize app");
    }
  };

  const syncWithServer = async () => {
    try {
      setInitProgress("Syncing data from server...");

      // ===== RUN ALL DOWNLOADS IN PARALLEL =====
      const syncPromises = [
        // Tree sync
        (async () => {
          try {
            const { needsSync, treeCount } = await treeService.checkAndSync();
            if (needsSync) {
              setInitProgress(`Downloading ${treeCount} trees...`);

              let retries = 3;
              let result = null;
              while (retries > 0 && !result) {
                try {
                  result = await treeService.syncTreesFromServer();
                  break;
                } catch (error) {
                  retries--;
                  if (retries === 0) throw error;
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                }
              }

              return { type: "trees", ...result };
            }
            return { type: "trees", synced: 0, errors: [] };
          } catch (error) {
            return { type: "trees", synced: 0, errors: [error.message] };
          }
        })(),

        // User sync
        (async () => {
          try {
            const result = await userService.syncUsersFromServer();
            return { type: "users", ...result };
          } catch (error) {
            console.error("User sync error:", error);
            return { type: "users", synced: 0, errors: [error.message] };
          }
        })(),

        // Flower sync
        (async () => {
          try {
            const { needsSync, flowerCount } =
              await flowerService.checkAndSync();
            if (needsSync) {
              const result = await flowerService.syncFlowersFromServer();
              return { type: "flowers", ...result };
            }
            return { type: "flowers", synced: 0, errors: [] };
          } catch (error) {
            return { type: "flowers", synced: 0, errors: [error.message] };
          }
        })(),

        // Fruit sync
        (async () => {
          try {
            const { needsSync, fruitCount } = await fruitService.checkAndSync();
            if (needsSync) {
              const result = await fruitService.syncFruitsFromServer();
              return { type: "fruits", ...result };
            }
            return { type: "fruits", synced: 0, errors: [] };
          } catch (error) {
            return { type: "fruits", synced: 0, errors: [error.message] };
          }
        })(),

        // Harvest download sync
        (async () => {
          try {
            const result = await HarvestService.syncHarvestsFromServer();
            return { type: "harvests", ...result };
          } catch (error) {
            return { type: "harvests", synced: 0, errors: [error.message] };
          }
        })(),
      ];

      // Wait for all downloads to complete
      setInitProgress("Downloading all data...");
      const results = await Promise.all(syncPromises);

      // Calculate totals
      const totalSynced = results.reduce((sum, r) => sum + (r?.synced || 0), 0);
      const allErrors = results.flatMap((r) => r?.errors || []);
      const treeResult = results.find((r) => r?.type === "trees");

      // Update progress
      if (totalSynced > 0) {
        setInitProgress(`Downloaded ${totalSynced} items`);
        if (treeResult) {
          setSyncStats(treeResult);
        }
      }

      if (allErrors.length > 0) {
        console.warn(`Sync completed with ${allErrors.length} errors`);
      }

      // ===== UPLOAD LOCAL CHANGES IN PARALLEL =====
      setInitProgress("Uploading local changes...");

      const uploadPromises = [
        treeService
          .syncAll()
          .catch((err) => ({ synced: 0, errors: [err.message] })),
        flowerService
          .syncAll()
          .catch((err) => ({ synced: 0, errors: [err.message] })),
        fruitService
          .syncAll()
          .catch((err) => ({ synced: 0, errors: [err.message] })),
        (async () => {
          try {
            const unsyncedCount = await HarvestService.getUnsyncedCount();
            if (unsyncedCount > 0) {
              return await HarvestService.syncAllUnsyncedHarvests();
            }
            return { synced: 0, errors: [] };
          } catch (error) {
            return { synced: 0, errors: [error.message] };
          }
        })(),
      ];

      const uploadResults = await Promise.all(uploadPromises);
      const totalUploaded = uploadResults.reduce(
        (sum, r) => sum + (r?.synced || 0),
        0,
      );

      if (totalUploaded > 0) {
        console.log(`✅ Uploaded ${totalUploaded} local changes`);
        setInitProgress(
          `✅ Downloaded ${totalSynced}, uploaded ${totalUploaded}`,
        );
      }

      console.log("✅ All sync operations completed");
      setInitProgress("Sync complete!");
    } catch (error: any) {
      console.error("❌ Sync failed:", error);
      setInitProgress("Sync failed - Using local data");
    }
  };

  const retryInitialization = () => {
    setInitError(null);
    setIsChecking(true);
    initializeApp();
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // Loading screen
  if (isChecking) {
    return (
      <View className="flex-1 justify-center items-center bg-gradient-to-b from-emerald-50 to-white px-6">
        {/* Logo/Icon Section */}
        <View className="items-center mb-8">
          <View className="bg-emerald-100 p-6 rounded-2xl mb-6">
            <Leaf size={64} color="#059669" />
          </View>
          <Text className="text-4xl font-bold text-emerald-900">Kalangka</Text>
          <Text className="text-emerald-600 text-lg mt-2">
            Smart Jackfruit Farming
          </Text>
        </View>

        {/* Network Status */}
        {isOnline !== null && (
          <View className="flex-row items-center mb-4 px-4 py-2 bg-gray-100 rounded-full">
            {isOnline ? (
              <>
                <Wifi size={16} color="#059669" />
                <Text className="text-emerald-700 ml-2 font-medium">
                  Online
                </Text>
              </>
            ) : (
              <>
                <WifiOff size={16} color="#ef4444" />
                <Text className="text-red-500 ml-2 font-medium">Offline</Text>
              </>
            )}
          </View>
        )}

        {/* Spinner Section */}
        <View className="items-center mb-6">
          <Animated.View
            style={{ transform: [{ rotate: spin }] }}
            className="mb-4"
          >
            <Loader2 size={40} color="#059669" />
          </Animated.View>

          <View className="items-center">
            <Text className="text-emerald-800 font-semibold text-xl mb-2">
              Loading Application
            </Text>
            <Text className="text-gray-500 text-center max-w-xs">
              {initProgress}
            </Text>
          </View>
        </View>

        {/* Database Stats */}
        {syncStats && (
          <View className="bg-emerald-50 p-3 rounded-lg mb-4">
            <View className="flex-row items-center justify-center">
              <Database size={16} color="#059669" />
              <Text className="text-emerald-700 ml-2">
                {syncStats.synced} trees synced
              </Text>
            </View>
            {syncStats.errors.length > 0 && (
              <Text className="text-amber-600 text-xs text-center mt-1">
                {syncStats.errors.length} errors occurred
              </Text>
            )}
          </View>
        )}

        {/* Error State */}
        {initError && (
          <View className="bg-red-50 p-4 rounded-lg mb-4">
            <Text className="text-red-600 text-center mb-2">{initError}</Text>
            <Text
              className="text-emerald-600 text-center font-semibold"
              onPress={retryInitialization}
            >
              Tap to retry
            </Text>
          </View>
        )}

        {/* Loading Dots Animation */}
        <View className="flex-row space-x-2 mt-4">
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              className="w-2 h-2 bg-emerald-400 rounded-full"
              style={{
                opacity:
                  0.3 + Math.abs(Math.sin(Date.now() / 500 + i * 0.5)) * 0.7,
              }}
            />
          ))}
        </View>
      </View>
    );
  }

  // Guard logic after loading
  if (!isOnboardingCompleted) {
    return <Redirect href="/onboarding" />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  // All checks passed
  if (user?.role === "admin") {
    return <Redirect href="/admin/" />;
  } else {
    return <Redirect href="/users/" />;
  }
}
