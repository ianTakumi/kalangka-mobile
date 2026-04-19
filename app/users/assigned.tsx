import HarvestService from "@/services/HarvestService";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  Clock,
  Clock3,
  Package,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";

export default function AssignedHarvestsScreen() {
  const router = useRouter();
  const [assignedHarvests, setAssignedHarvests] = useState([]);
  const [filteredHarvests, setFilteredHarvests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all"); // 'all', 'pending', 'partial'
  const user = useSelector((state) => state.auth.user);

  useEffect(() => {
    fetchCurrentUserAndAssignments();
  }, []);

  // Apply filter whenever assignedHarvests or activeFilter changes
  useEffect(() => {
    applyFilter();
  }, [assignedHarvests, activeFilter]);

  const fetchCurrentUserAndAssignments = async () => {
    try {
      if (user) {
        await fetchAllAssignedHarvests(user.id);
      }
    } catch (error) {
      console.error("Error fetching user:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllAssignedHarvests = async (userId: string) => {
    try {
      const harvests = await HarvestService.getAssignmentsByUserId(userId);
      console.log(
        "Fetched assigned harvests:",
        JSON.stringify(harvests, null, 2),
      );

      // ✅ FIX 1: Filter out completed harvests (harvested and wasted) from the list entirely
      const activeHarvests = harvests.filter(
        (item) => item.status !== "harvested" && item.status !== "wasted",
      );

      setAssignedHarvests(activeHarvests);
    } catch (error) {
      console.error("Error fetching assigned harvests:", error);
    }
  };

  const applyFilter = () => {
    if (activeFilter === "all") {
      setFilteredHarvests(assignedHarvests);
    } else if (activeFilter === "pending") {
      const pending = assignedHarvests.filter(
        (item) => item.status === "pending",
      );
      setFilteredHarvests(pending);
    } else if (activeFilter === "partial") {
      const partial = assignedHarvests.filter(
        (item) => item.status === "partial",
      );
      setFilteredHarvests(partial);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (user) {
      await fetchAllAssignedHarvests(user.id);
    }
    setRefreshing(false);
  }, [user]);

  const renderItem = ({ item }) => {
    // Calculate processed fruits count
    const fruitWeightsCount = item.fruit_weights?.length || 0;
    const wasteCount =
      item.wastes?.reduce((sum, w) => sum + (w.waste_quantity || 0), 0) || 0;
    const totalProcessed = fruitWeightsCount + wasteCount;
    const totalFruits = item.fruit?.quantity || 0;

    // ✅ FIX 2: Correct remaining calculation
    // remaining_quantity should come from backend, but fallback to calculation
    const remainingFruits =
      item.fruit?.remaining_quantity !== undefined
        ? item.fruit.remaining_quantity
        : totalFruits - totalProcessed;

    return (
      <TouchableOpacity
        className="bg-white rounded-xl p-4 mb-3 border border-gray-200"
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
        <View className="flex-row items-center">
          <View className="w-14 h-14 bg-orange-100 rounded-full items-center justify-center mr-3">
            <Package size={28} color="#F97316" />
          </View>

          <View className="flex-1">
            <View className="flex-row items-center justify-between">
              <Text className="font-bold text-gray-900 text-lg">
                {item.fruit?.tree?.description ||
                  item.fruit?.treeName ||
                  `Tree at ${item.fruit?.tree?.latitude?.toFixed(4)}, ${item.fruit?.tree?.longitude?.toFixed(4)}`}
              </Text>

              <View
                className={`px-3 py-1 rounded-full ${
                  item.status === "pending"
                    ? "bg-blue-100"
                    : item.status === "partial"
                      ? "bg-yellow-100"
                      : "bg-gray-100"
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    item.status === "pending"
                      ? "text-blue-700"
                      : item.status === "partial"
                        ? "text-yellow-700"
                        : "text-gray-700"
                  }`}
                >
                  {item.status === "pending"
                    ? "Pending Harvest"
                    : item.status === "partial"
                      ? `Partial (${remainingFruits} left)`
                      : "Unknown"}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center mt-2">
              <Clock size={14} color="#6B7280" />
              <Text className="text-xs text-gray-600 ml-1">
                Assigned: {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>

            {item.fruit?.bagged_at && (
              <View className="flex-row items-center mt-1">
                <Calendar size={14} color="#6B7280" />
                <Text className="text-xs text-gray-600 ml-1">
                  Bagged: {new Date(item.fruit.bagged_at).toLocaleDateString()}
                </Text>
              </View>
            )}

            {/* Progress indicator for partial harvests */}
            {item.status === "partial" && totalFruits > 0 && (
              <View className="mt-2">
                <View className="flex-row justify-between mb-1">
                  <Text className="text-xs text-gray-600">
                    Progress: {totalProcessed}/{totalFruits} fruits
                  </Text>
                  <Text className="text-xs text-gray-600">
                    {Math.round((totalProcessed / totalFruits) * 100)}%
                  </Text>
                </View>
                <View className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <View
                    className="h-full bg-orange-500 rounded-full"
                    style={{
                      width: `${(totalProcessed / totalFruits) * 100}%`,
                    }}
                  />
                </View>
              </View>
            )}

            {item.status === "pending" && totalFruits > 0 && (
              <Text className="text-sm text-gray-700 mt-2">
                Total: {totalFruits} fruit(s)
              </Text>
            )}
          </View>

          <ChevronRight size={20} color="#9CA3AF" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => {
    const pendingCount = assignedHarvests.filter(
      (item) => item.status === "pending",
    ).length;

    const partialCount = assignedHarvests.filter(
      (item) => item.status === "partial",
    ).length;

    return (
      <View className="bg-white border-b border-gray-200">
        <View className="px-4 py-4">
          <View className="flex-row items-center mb-2">
            <TouchableOpacity onPress={() => router.back()} className="mr-3">
              <ArrowLeft size={24} color="#374151" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-gray-900">
              My Assigned Harvests
            </Text>
          </View>
        </View>

        {/* Filter Tabs - removed Completed tab */}
        <View className="flex-row px-4 pb-2">
          <TouchableOpacity
            onPress={() => setActiveFilter("all")}
            className={`mr-4 pb-2 ${
              activeFilter === "all" ? "border-b-2 border-orange-500" : ""
            }`}
          >
            <Text
              className={`${
                activeFilter === "all"
                  ? "text-orange-600 font-semibold"
                  : "text-gray-500"
              }`}
            >
              All ({assignedHarvests.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveFilter("pending")}
            className={`mr-4 pb-2 ${
              activeFilter === "pending" ? "border-b-2 border-orange-500" : ""
            }`}
          >
            <View className="flex-row items-center">
              <Clock3
                size={16}
                color={activeFilter === "pending" ? "#F97316" : "#6B7280"}
              />
              <Text
                className={`ml-1 ${
                  activeFilter === "pending"
                    ? "text-orange-600 font-semibold"
                    : "text-gray-500"
                }`}
              >
                Pending ({pendingCount})
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveFilter("partial")}
            className={`pb-2 ${
              activeFilter === "partial" ? "border-b-2 border-orange-500" : ""
            }`}
          >
            <View className="flex-row items-center">
              <Clock
                size={16}
                color={activeFilter === "partial" ? "#F97316" : "#6B7280"}
              />
              <Text
                className={`ml-1 ${
                  activeFilter === "partial"
                    ? "text-orange-600 font-semibold"
                    : "text-gray-500"
                }`}
              >
                Partial ({partialCount})
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    let message = "You don't have any ";
    if (activeFilter === "pending") {
      message += "pending harvest assignments.";
    } else if (activeFilter === "partial") {
      message += "partial harvests.";
    } else {
      message += "harvest assignments.";
    }

    return (
      <View className="flex-1 items-center justify-center px-6 py-16">
        <View className="w-24 h-24 bg-orange-50 rounded-full items-center justify-center mb-4">
          <Package size={48} color="#F97316" />
        </View>
        <Text className="text-2xl font-bold text-gray-900 text-center mb-2">
          No {activeFilter !== "all" ? activeFilter : ""} Items
        </Text>
        <Text className="text-gray-600 text-center mb-6">{message}</Text>
        {activeFilter !== "all" && (
          <TouchableOpacity
            onPress={() => setActiveFilter("all")}
            className="bg-orange-600 px-6 py-3 rounded-xl"
          >
            <Text className="text-white font-medium">View All</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#F97316" />
          <Text className="text-gray-600 mt-3">
            Loading assigned harvests...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

      {renderHeader()}

      {filteredHarvests.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={filteredHarvests}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#F97316"]}
              tintColor="#F97316"
              title="Pull to refresh"
              titleColor="#6B7280"
            />
          }
          ListFooterComponent={
            <View className="py-4 items-center">
              <Text className="text-gray-500 text-sm">
                Showing {filteredHarvests.length} of {assignedHarvests.length}{" "}
                total
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
