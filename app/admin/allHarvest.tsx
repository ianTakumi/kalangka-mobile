import HarvestService from "@/services/HarvestService";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface Harvest {
  id: string;
  fruit_id: string;
  user_id: string;
  ripe_quantity: number | null;
  harvest_at: string;
  status: string;
  created_at: string;
  updated_at: string;
  total_weight: number;
  total_waste: number;
  fruit: {
    id: string;
    quantity: number;
    tree: {
      description: string;
      type: string;
    };
  };
  user: {
    first_name: string;
    last_name: string;
    email: string;
  };
  fruit_weights: {
    weight: number;
  }[];
  wastes: {
    waste_quantity: number;
    reason: string;
  }[];
}

export default function AllHarvest() {
  const router = useRouter();
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const fetchHarvests = async () => {
    try {
      const harvestRecords = await HarvestService.getAllHarvests();
      setHarvests(harvestRecords);
    } catch (error) {
      console.error("Error fetching harvests:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHarvests();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHarvests();
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "bg-blue-500";
      case "partial":
        return "bg-yellow-500";
      case "harvested":
        return "bg-green-500";
      default:
        return "bg-gray-400";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const filteredHarvests =
    selectedStatus === "all"
      ? harvests
      : harvests.filter((h) => h.status === selectedStatus);

  const renderHarvestCard = ({ item }: { item: Harvest }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      className="bg-white rounded-2xl mb-4 shadow-sm overflow-hidden"
    >
      {/* Header */}
      <View className="flex-row justify-between items-center p-4 border-b border-gray-100">
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-800">
            {item.fruit?.tree?.description || "Unknown Tree"}
          </Text>
          <Text className="text-sm text-gray-500 mt-1">
            {item.fruit?.tree?.type || "N/A"}
          </Text>
        </View>

        <View
          className={`px-3 py-1 rounded-full ${getStatusColor(item.status)}`}
        >
          <Text className="text-white text-xs font-bold">
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Content */}
      <View className="p-4">
        <View className="flex-row justify-between mb-3">
          <Text className="text-gray-500 font-medium">Harvest Date:</Text>
          <Text className="text-gray-800 font-medium">
            {formatDate(item.harvest_at)}
          </Text>
        </View>

        <View className="flex-row justify-between mb-3">
          <Text className="text-gray-500 font-medium">Farmer:</Text>
          <Text className="text-gray-800 font-medium">
            {item.user
              ? `${item.user.first_name} ${item.user.last_name}`
              : "Unassigned"}
          </Text>
        </View>

        <View className="flex-row justify-between mb-3">
          <Text className="text-gray-500 font-medium">Total Fruit:</Text>
          <Text className="text-gray-800 font-medium">
            {item.fruit?.quantity || 0} pcs
          </Text>
        </View>

        {item.ripe_quantity !== null && item.ripe_quantity > 0 && (
          <View className="flex-row justify-between mb-3">
            <Text className="text-gray-500 font-medium">Ripe Quantity:</Text>
            <Text className="text-gray-800 font-medium">
              {item.ripe_quantity} pcs
            </Text>
          </View>
        )}

        {item.total_weight > 0 && (
          <View className="flex-row justify-between mb-3">
            <Text className="text-gray-500 font-medium">Total Weight:</Text>
            <Text className="text-gray-800 font-medium">
              {item.total_weight.toFixed(2)} kg
            </Text>
          </View>
        )}

        {item.total_waste > 0 && (
          <View className="flex-row justify-between mb-3">
            <Text className="text-gray-500 font-medium">Total Waste:</Text>
            <Text className="text-red-500 font-medium">
              {item.total_waste} pcs
            </Text>
          </View>
        )}

        {item.wastes && item.wastes.length > 0 && (
          <View className="mt-2 pt-2 border-t border-gray-100">
            <Text className="text-gray-500 font-medium">Waste Details:</Text>
            {item.wastes.map((waste, index) => (
              <Text key={index} className="text-red-500 text-sm mt-1 ml-2">
                • {waste.waste_quantity} pcs - {waste.reason}
              </Text>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View className="mb-5">
      <Text className="text-3xl font-bold text-gray-800">Harvest Records</Text>

      <Text className="text-sm text-gray-500 mb-4">
        Total: {filteredHarvests.length} harvest
        {filteredHarvests.length !== 1 ? "s" : ""}
      </Text>

      <View className="flex-row flex-wrap gap-2">
        {["all", "pending", "partial", "harvested"].map((status) => (
          <TouchableOpacity
            key={status}
            onPress={() => setSelectedStatus(status)}
            className={`px-4 py-2 rounded-full border ${
              selectedStatus === status
                ? "bg-green-500 border-green-500"
                : "bg-white border-gray-300"
            }`}
          >
            <Text
              className={`text-sm ${
                selectedStatus === status
                  ? "text-white font-semibold"
                  : "text-gray-600"
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-100">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#4caf50" />
          <Text className="mt-2 text-gray-500">Loading harvests...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-100" edges={["top"]}>
      {/* Header with Back Button */}
      <View className="bg-white px-5 pt-4 pb-4 border-b border-gray-200">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.push("/admin/(drawers)/(tabs)")}
            className="w-10 h-10 rounded-full items-center justify-center bg-gray-100 mr-3"
          >
            <Ionicons name="arrow-back" size={22} color="#374151" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-800">
            Harvest Records
          </Text>
        </View>
      </View>

      <FlatList
        data={filteredHarvests}
        renderItem={renderHarvestCard}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={{ padding: 16, backgroundColor: "#f5f5f5" }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#4caf50"]}
            tintColor="#4caf50"
          />
        }
        ListEmptyComponent={() => (
          <View className="flex-1 justify-center items-center py-16">
            <Text className="text-gray-400 text-base">
              No harvest records found
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
