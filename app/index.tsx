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
        await initializeAndSync();
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

      // Step 1: Initialize lahat ng services MUNA bago mag-sync
      setInitProgress("Initializing tree database...");
      await treeService.init();
      console.log("✅ Tree database initialized");

      setInitProgress("Initializing harvest module...");
      await HarvestService.init();
      console.log("✅ Harvest database initialized");

      setInitProgress("Initializing flower module...");
      await flowerService.init();
      console.log("✅ Flower database initialized");

      setInitProgress("Initializing user module...");
      await userService.init();
      console.log("✅ User database initialized");

      setInitProgress("Initializing fruit module...");
      await fruitService.init();
      console.log("✅ Fruit database initialized");

      // Step 2: Maghintay ng konti para masiguradong ready na lahat
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Step 3: I-verify na ready na ang database bago mag-sync
      setInitProgress("Verifying database...");

      // Get local tree count para i-verify na working
      const localCount = await treeService.getTreeCount();
      console.log(`📊 Local trees: ${localCount}`);
      setInitProgress(`Found ${localCount} local trees`);

      // Step 4: Check network at mag-sync kung online
      const netState = await NetInfo.fetch();

      if (netState.isConnected) {
        setInitProgress("Online - Syncing with server...");

        // Maghintay ng konti para sa network stability
        await new Promise((resolve) => setTimeout(resolve, 1000));

        await syncWithServer();
      } else {
        setInitProgress("Offline mode - Using local data");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Step 5: Final delay before redirect
      setInitProgress("Ready!");
      await new Promise((resolve) => setTimeout(resolve, 500));

      setIsChecking(false);
    } catch (error: any) {
      console.error("❌ Initialization failed:", error);
      setInitError(error.message || "Failed to initialize app");
      setTimeout(() => setIsChecking(false), 3000);
    }
  };

  const syncWithServer = async () => {
    try {
      setInitProgress("Syncing trees from server...");

      // ===== TREE SYNC =====
      const { needsSync: treesNeedSync, treeCount } =
        await treeService.checkAndSync();

      if (treesNeedSync) {
        setInitProgress(`Downloading ${treeCount} trees...`);

        let retries = 3;
        let treeResult = null;
        while (retries > 0 && !treeResult) {
          try {
            treeResult = await treeService.syncTreesFromServer();
            break;
          } catch (error) {
            retries--;
            if (retries === 0) throw error;
            console.log(`Retrying tree sync... (${retries} attempts left)`);
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }

        if (treeResult) {
          setSyncStats(treeResult);
          if (treeResult.errors.length > 0) {
            console.warn("Tree sync completed with errors:", treeResult.errors);
            setInitProgress(
              `Synced ${treeResult.synced} trees (with ${treeResult.errors.length} errors)`,
            );
          } else {
            setInitProgress(`Successfully synced ${treeResult.synced} trees`);
          }
        }
      } else {
        setInitProgress("Trees are up to date");
      }

      // ===== FLOWER SYNC =====
      setInitProgress("Checking flowers...");
      try {
        const { needsSync: flowersNeedSync, flowerCount } =
          await flowerService.checkAndSync();

        if (flowersNeedSync) {
          setInitProgress(`Downloading ${flowerCount} flowers from server...`);
          const flowerResult = await flowerService.syncFlowersFromServer();

          if (flowerResult.synced > 0) {
            console.log(`✅ Synced ${flowerResult.synced} flowers from server`);
            setInitProgress(`Downloaded ${flowerResult.synced} flowers...`);
          }

          if (flowerResult.errors.length > 0) {
            console.warn("Flower sync errors:", flowerResult.errors);
          }
        } else {
          console.log("✅ Flowers are up to date");
          setInitProgress("Flowers up to date");
        }
      } catch (flowerError) {
        console.error("❌ Flower sync from server failed:", flowerError);
      }

      // ===== FRUIT SYNC (NEW!) =====
      setInitProgress("Checking fruits...");
      try {
        const { needsSync: fruitsNeedSync, fruitCount } =
          await fruitService.checkAndSync(); // <- CHECK muna

        if (fruitsNeedSync) {
          setInitProgress(`Downloading ${fruitCount} fruits from server...`);
          const fruitResult = await fruitService.syncFruitsFromServer(); // <- DOWNLOAD kung kailangan

          if (fruitResult.synced > 0) {
            console.log(`✅ Synced ${fruitResult.synced} fruits from server`);
            setInitProgress(`Downloaded ${fruitResult.synced} fruits...`);
          }

          if (fruitResult.errors.length > 0) {
            console.warn("Fruit sync errors:", fruitResult.errors);
          }
        } else {
          console.log("✅ Fruits are up to date");
          setInitProgress("Fruits up to date");
        }
      } catch (fruitError) {
        console.error("❌ Fruit sync from server failed:", fruitError);
      }

      // ===== USER SYNC (ADD THIS) =====
      setInitProgress("Checking users...");
      try {
        // Use the syncUsersFromServer method directly
        const userResult = await userService.syncUsersFromServer();

        if (userResult.synced > 0) {
          console.log(`✅ Synced ${userResult.synced} users from server`);
          setInitProgress(`Downloaded ${userResult.synced} users...`);
        } else {
          console.log("✅ Users are up to date");
          setInitProgress("Users up to date");
        }

        if (userResult.errors.length > 0) {
          console.warn("User sync errors:", userResult.errors);
        }
      } catch (userError) {
        console.error("❌ User sync from server failed:", userError);
        // Don't stop the whole sync, just log the error
        setInitProgress("User sync failed - continuing...");
      }

      // ===== HARVEST SYNC (UPLOAD ONLY) =====
      setInitProgress("Checking harvest data...");
      try {
        // Get unsynced harvests count
        const unsyncedCount = await HarvestService.getUnsyncedCount();

        console.log(`📊 Found ${unsyncedCount} unsynced harvest(s)`);

        if (unsyncedCount > 0) {
          setInitProgress(`Uploading ${unsyncedCount} unsynced harvests...`);

          // Sync all unsynced harvests and get results
          const syncResult = await HarvestService.syncAllUnsyncedHarvests();

          // Update UI with results
          if (syncResult.synced > 0) {
            console.log(
              `✅ Successfully uploaded ${syncResult.synced} harvests to server`,
            );
            setInitProgress(
              `✅ Uploaded ${syncResult.synced} harvests to server`,
            );

            // Update sync stats to show harvest counts
            setSyncStats((prev) => ({
              synced: prev?.synced || 0,
              errors: [...(prev?.errors || []), ...syncResult.errors],
              harvestsSynced: syncResult.synced,
            }));
          }

          if (syncResult.errors.length > 0) {
            console.warn(
              `⚠️ Harvest upload completed with ${syncResult.errors.length} errors`,
            );
            setInitProgress(
              `⚠️ ${syncResult.synced} uploaded, ${syncResult.errors.length} failed`,
            );

            setSyncStats((prev) => ({
              synced: prev?.synced || 0,
              errors: [...(prev?.errors || []), ...syncResult.errors],
              harvestsSynced: syncResult.synced,
            }));
          }

          // If no harvests were synced (all failed)
          if (syncResult.synced === 0 && unsyncedCount > 0) {
            setInitProgress(`❌ Failed to upload harvests - will retry later`);
          }
        } else {
          console.log("✅ All harvests are synced");
          setInitProgress("✅ All harvests are up to date");
        }
      } catch (harvestError: any) {
        console.error("❌ Harvest sync failed:", harvestError);
        setInitProgress("⚠️ Harvest sync failed - continuing...");

        // Add error to sync stats
        setSyncStats((prev) => ({
          synced: prev?.synced || 0,
          errors: [
            ...(prev?.errors || []),
            `Harvest sync: ${harvestError.message}`,
          ],
        }));
      }

      // ===== UPLOAD LOCAL CHANGES =====
      setInitProgress("Uploading local changes...");

      await treeService.syncAll();
      await flowerService.syncAll();
      await fruitService.syncAll(); // <- UPLOAD unsynced fruits

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
