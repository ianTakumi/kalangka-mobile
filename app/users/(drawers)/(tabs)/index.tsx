import FlowerService from "@/services/FlowerService";
import FruitService from "@/services/FruitService";
import HarvestService from "@/services/HarvestService";
import UserService from "@/services/UserService";
import { User as UserType } from "@/types/index";
import { getTimeBasedGreeting } from "@/utils/helpers";
import NetInfo from "@react-native-community/netinfo";
import { useRouter } from "expo-router";
import {
  ArrowRight,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cloud,
  CloudOff,
  Flower2,
  Package,
  QrCode,
  RefreshCw,
  Sprout,
  Trees,
  User,
  Zap,
} from "lucide-react-native";

import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";

const { width } = Dimensions.get("window");

export default function FarmerHomeScreen() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const scanButtonScale = new Animated.Value(1);
  const pulseAnim = new Animated.Value(1);
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [assignedHarvests, setAssignedHarvests] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const user = useSelector((state) => state.auth.user);

  useEffect(() => {
    // Pulse animation for QR button
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Network check
    const checkNetwork = async () => {
      const state = await NetInfo.fetch();
      setIsOnline(state.isConnected ?? false);
    };

    checkNetwork();

    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? false);
    });

    // Get current user and assigned harvests
    fetchCurrentUserAndAssignments();

    return () => unsubscribe();
  }, []);

  const fetchCurrentUserAndAssignments = async () => {
    try {
      if (user) {
        await fetchAssignedHarvests(user.id);
      }
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  };

  const fetchAssignedHarvests = async (userId: string) => {
    setLoadingAssignments(true);
    try {
      // Get harvests assigned to this user that are not yet completed
      const harvests = await HarvestService.getAssignmentsByUserId(userId);
      setAssignedHarvests(harvests);
    } catch (error) {
      console.error("Error fetching assigned harvests:", error);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchCurrentUserAndAssignments(), syncData()]);
    setRefreshing(false);
  };

  const syncData = async () => {
    // Sync harvest data
    try {
      await UserService.syncUsersFromServer();
    } catch (err) {
      console.error("Error syncing user data:", err);
    }

    try {
      // Sync all flowers that is unsynced maybe new or user updated it offline
      try {
        FlowerService.syncAll();
      } catch (err) {
        console.error("Error syncing flower data:", err);
      }

      // ===== FLOWER SYNC Get all new data or updated data =====
      try {
        const { needsSync: flowersNeedSync, flowerCount } =
          await FlowerService.checkAndSync();

        if (flowersNeedSync) {
          const flowerResult = await FlowerService.syncFlowersFromServer();

          if (flowerResult.synced > 0) {
            console.log(`✅ Synced ${flowerResult.synced} flowers from server`);
          }

          if (flowerResult.errors.length > 0) {
            console.warn("Flower sync errors:", flowerResult.errors);
          }
        } else {
          console.log("✅ Flowers are up to date");
        }
      } catch (flowerError) {
        console.error("❌ Flower sync from server failed:", flowerError);
      }

      // Sync all fruit that is unsynced maybe new or user updated it offline
      try {
        FruitService.syncAll();
      } catch (err) {
        console.error("Error syncing fruit data:", err);
      }

      // ===== FRUIT SYNC Get all new data or updated data =====
      try {
        const { needsSync: fruitsNeedSync, fruitCount } =
          await FruitService.checkAndSync();

        if (fruitsNeedSync) {
          const fruitResult = await FruitService.syncFruitsFromServer();

          if (fruitResult.synced > 0) {
            console.log(`✅ Synced ${fruitResult.synced} fruits from server`);
          }

          if (fruitResult.errors.length > 0) {
            console.warn("Fruit sync errors:", fruitResult.errors);
          }
        } else {
          console.log("✅ Fruits are up to date");
        }
      } catch (fruitError) {
        console.error("❌ Fruit sync from server failed:", fruitError);
      }

      // Get unsynced harvests count
      const unsyncedCount = await HarvestService.getUnsyncedCount();

      console.log(`📊 Found ${unsyncedCount} unsynced harvest(s)`);

      if (unsyncedCount > 0) {
        // Sync all unsynced harvests and get results
        const syncResult = await HarvestService.syncAllUnsyncedHarvests();

        // Update UI with results
        if (syncResult.synced > 0) {
          console.log(
            `✅ Successfully uploaded ${syncResult.synced} harvests to server`,
          );
        }

        if (syncResult.errors.length > 0) {
          console.warn(
            `⚠️ Harvest upload completed with ${syncResult.errors.length} errors`,
          );
        }
      } else {
        console.log("✅ All harvests are synced");
      }
    } catch (harvestError: any) {
      console.error("❌ Harvest sync failed:", harvestError);
    }

    console.log("📥 Checking for new harvests from server...");

    const harvestResult = await HarvestService.syncHarvestsFromServer();

    if (harvestResult.synced > 0) {
      console.log(`✅ Downloaded ${harvestResult.synced} harvests from server`);
    }
  };

  const renderAssignedHarvestItem = ({ item }) => {
    // Function to get status style and label
    const getStatusStyle = (status: string) => {
      switch (status) {
        case "pending":
          return {
            container: "bg-blue-100",
            text: "text-blue-700",
            label: "Pending Harvest",
            icon: Clock,
            iconColor: "#3B82F6",
          };
        case "partial":
          return {
            container: "bg-yellow-100",
            text: "text-yellow-700",
            label: "Partial Harvest",
            icon: RefreshCw,
            iconColor: "#EAB308",
          };
        case "harvested":
          return {
            container: "bg-green-100",
            text: "text-green-700",
            label: "Harvested",
            icon: CheckCircle2,
            iconColor: "#10B981",
          };
        default:
          return {
            container: "bg-gray-100",
            text: "text-gray-700",
            label: "Unknown",
            icon: Package,
            iconColor: "#6B7280",
          };
      }
    };

    const statusStyle = getStatusStyle(item.status);
    const StatusIcon = statusStyle.icon;

    return (
      <TouchableOpacity
        className="bg-white rounded-xl p-4 mb-3 border border-gray-200 flex-row items-center"
        onPress={() => {
          if (item.fruit) {
            router.push({
              pathname: "/harvest",
              params: {
                fruitData: JSON.stringify(item.fruit),
                harvestId: item.id,
              },
            });
          } else {
            Alert.alert("Error", "Fruit details not available");
          }
        }}
        activeOpacity={0.7}
      >
        {/* Status Icon */}
        <View
          className={`mr-3 w-12 h-12 ${statusStyle.container} rounded-full items-center justify-center`}
        >
          <StatusIcon size={24} color={statusStyle.iconColor} />
        </View>

        <View className="flex-1">
          {/* Tree Name and Status Badge */}
          <View className="flex-row items-center justify-between mb-1">
            <Text
              className="text-lg font-bold text-gray-900 flex-1 mr-2"
              numberOfLines={1}
            >
              {item.fruit?.tree?.description ||
                item.fruit?.treeName ||
                `Fruit #${item.fruit_id?.substring(0, 8)}`}
            </Text>
            <View className={`rounded-full px-3 py-1 ${statusStyle.container}`}>
              <Text className={`text-xs font-medium ${statusStyle.text}`}>
                {statusStyle.label}
              </Text>
            </View>
          </View>

          {/* Flower ID and Tree Type */}
          <View className="flex-row gap-2 mb-2">
            {item.fruit?.flower_id && (
              <View className="bg-blue-50 px-2 py-1 rounded-md flex-row items-center">
                <Flower2 size={12} color="#3B82F6" />
                <Text className="text-xs text-blue-700 font-medium ml-1">
                  {item.fruit.flower_id.substring(0, 6)}
                </Text>
              </View>
            )}
            {item.fruit?.tree?.type && (
              <View className="bg-green-50 px-2 py-1 rounded-md flex-row items-center">
                <Trees size={12} color="#059669" />
                <Text className="text-xs text-green-700 font-medium ml-1">
                  {item.fruit.tree.type}
                </Text>
              </View>
            )}
          </View>

          {/* Bagged Date and Quantity */}
          <View className="flex-row gap-3 mb-2">
            {item.fruit?.bagged_at && (
              <View className="flex-row items-center">
                <Calendar size={12} color="#6B7280" />
                <Text className="text-xs text-gray-500 ml-1">
                  Bagged:{" "}
                  {new Date(item.fruit.bagged_at).toLocaleDateString("en-PH", {
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
              </View>
            )}
            {item.fruit?.quantity && (
              <View className="flex-row items-center">
                <Package size={12} color="#6B7280" />
                <Text className="text-xs text-gray-500 ml-1">
                  Qty: {item.fruit.quantity}
                </Text>
              </View>
            )}
          </View>

          {/* Days since bagged */}
          {item.fruit?.bagged_at && (
            <View className="flex-row items-center mt-1">
              <Clock size={12} color="#9CA3AF" />
              <Text className="text-xs text-gray-400 ml-1">
                {Math.floor(
                  (new Date().getTime() -
                    new Date(item.fruit.bagged_at).getTime()) /
                    (1000 * 60 * 60 * 24),
                )}{" "}
                days ago
              </Text>
            </View>
          )}

          {/* Show remaining quantity if partial */}
          {item.status === "partial" && item.fruit?.remaining_quantity > 0 && (
            <View className="mt-2 flex-row items-center">
              <Package size={12} color="#F97316" />
              <Text className="text-xs text-orange-600 ml-1">
                {item.fruit.remaining_quantity} remaining
              </Text>
            </View>
          )}

          {/* Show harvest date if harvested */}
          {item.harvest_at && item.status === "harvested" && (
            <View className="mt-1 flex-row items-center">
              <CheckCircle2 size={12} color="#10B981" />
              <Text className="text-xs text-green-600 ml-1">
                Harvested: {new Date(item.harvest_at).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>

        <ChevronRight size={20} color="#9CA3AF" />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

      {/* Header */}
      <View className="bg-white px-6 pt-6 pb-4 border-b border-gray-200">
        <View className="flex-row justify-between items-center mb-4">
          <View>
            <Text className="text-3xl font-bold text-gray-900">
              {getTimeBasedGreeting()},
            </Text>
            <Text className="text-lg text-gray-600">Welcome to Kalangka</Text>
          </View>
          <TouchableOpacity
            className="w-12 h-12 rounded-full bg-gray-100 items-center justify-center"
            onPress={() => router.push("/users/profile")}
          >
            <User size={24} color="#4B5563" />
          </TouchableOpacity>
        </View>

        {/* Network Status & Sync */}
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center gap-2">
            <View
              className={`flex-row items-center px-3 py-1.5 rounded-full ${isOnline ? "bg-emerald-50" : "bg-gray-100"}`}
            >
              {isOnline ? (
                <>
                  <Cloud size={16} color="#059669" />
                  <Text className="ml-2 text-emerald-700 font-medium">
                    Online
                  </Text>
                </>
              ) : (
                <>
                  <CloudOff size={16} color="#6B7280" />
                  <Text className="ml-2 text-gray-600 font-medium">
                    Offline
                  </Text>
                </>
              )}
            </View>
          </View>
          <TouchableOpacity
            onPress={onRefresh}
            className="flex-row items-center gap-2"
          >
            <RefreshCw size={18} color="#059669" />
            <Text className="text-sm text-emerald-600">Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#059669"]}
            tintColor="#059669"
          />
        }
      >
        {user && (
          <View className="px-6 my-6">
            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-row items-center">
                <Sprout size={24} color="#F97316" />
                <Text className="text-2xl font-bold text-gray-900 ml-2">
                  My Assigned Harvests
                </Text>
              </View>
              {assignedHarvests.length > 0 && (
                <TouchableOpacity
                  onPress={() => router.push("/users/assigned")}
                >
                  <Text className="text-emerald-600 font-medium">View All</Text>
                </TouchableOpacity>
              )}
            </View>

            {loadingAssignments ? (
              <View className="bg-white rounded-xl p-8 items-center">
                <ActivityIndicator size="large" color="#F97316" />
                <Text className="text-gray-600 mt-3">
                  Loading assignments...
                </Text>
              </View>
            ) : assignedHarvests.length === 0 ? (
              <View className="bg-white rounded-xl p-8 items-center border border-gray-200">
                <View className="w-16 h-16 bg-orange-50 rounded-full items-center justify-center mb-3">
                  <CheckCircle2 size={32} color="#F97316" />
                </View>
                <Text className="text-lg font-medium text-gray-900 mb-1">
                  No Assigned Harvests
                </Text>
                <Text className="text-gray-500 text-center">
                  You don&apos;t have any pending harvest assignments.
                </Text>
              </View>
            ) : (
              <View>
                <FlatList
                  data={assignedHarvests.slice(0, 5)}
                  renderItem={renderAssignedHarvestItem}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
                {assignedHarvests.length > 3 && (
                  <TouchableOpacity
                    className="mt-2 bg-orange-50 rounded-xl p-3 items-center"
                    onPress={() => router.push("/users/assigned")}
                  >
                    <Text className="text-orange-700 font-medium">
                      View {assignedHarvests.length - 3} More Assignments
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {/* QR Scan Section - Main Feature */}
        <View className="px-6 pt-2 pb-4">
          <Text className="text-2xl font-bold text-gray-900 mb-2">
            Quick Tree Access
          </Text>
          <Text className="text-gray-600 mb-6">
            Scan any tree&apos;s QR code to instantly access its details
          </Text>

          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              className="bg-emerald-600 rounded-3xl p-6"
              onPress={() => router.push("/users/qrcam")}
              activeOpacity={0.9}
            >
              <Animated.View
                style={{ transform: [{ scale: scanButtonScale }] }}
                className="items-center mb-4"
              >
                <View className="w-20 h-20 bg-white/20 rounded-full items-center justify-center mb-4">
                  <QrCode size={40} color="white" />
                </View>

                <View className="flex-row items-center mb-2 gap-2">
                  <Camera size={20} color="white" />
                  <Text className="text-white text-2xl font-bold">
                    Scan Tree QR Code
                  </Text>
                </View>

                <Text className="text-emerald-100 text-center mb-6">
                  Tap to open camera and scan any tree&apos;s QR code
                </Text>
              </Animated.View>

              <View className="bg-white/20 rounded-xl p-4">
                <View className="flex-row items-center">
                  <View className="w-10 h-10 bg-white rounded-full items-center justify-center mr-3">
                    <Zap size={20} color="#059669" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-bold">
                      Instant Tree Access
                    </Text>
                    <Text className="text-emerald-100 text-sm">
                      Register • Monitor • Report activities
                    </Text>
                  </View>
                  <ArrowRight size={20} color="white" />
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
