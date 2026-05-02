import HarvestService from "@/services/HarvestService";
import { Ionicons } from "@expo/vector-icons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

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
    id: string;
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

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export default function AllHarvest() {
  const router = useRouter();
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [filteredHarvests, setFilteredHarvests] = useState<Harvest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [users, setUsers] = useState<User[]>([]);

  // Filter modal states
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [tempSelectedStatus, setTempSelectedStatus] = useState<string>("all");
  const [tempSelectedUserId, setTempSelectedUserId] = useState<string>("");
  const [tempFromDate, setTempFromDate] = useState<string>("");
  const [tempToDate, setTempToDate] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Modal states for harvest details
  const [selectedHarvest, setSelectedHarvest] = useState<Harvest | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchHarvests();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [harvests, selectedStatus, selectedUserId, fromDate, toDate, searchQuery]);

  const fetchHarvests = async () => {
    try {
      setLoading(true);
      const harvestRecords = await HarvestService.getAllHarvests();
      setHarvests(harvestRecords);
      setFilteredHarvests(harvestRecords);

      // Extract unique users
      const uniqueUsers = Array.from(
        new Map(
          harvestRecords
            .map((harvest: Harvest) => [harvest.user?.id, harvest.user])
            .filter(([id]) => id),
        ).values(),
      );
      setUsers(uniqueUsers);
    } catch (error) {
      console.error("Error fetching harvests:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchHarvests();
    resetFilters();
    setRefreshing(false);
  };

  const applyFilters = () => {
    let filtered = [...harvests];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (harvest) =>
          harvest.fruit?.tree?.description
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          `${harvest.user?.first_name || ""} ${harvest.user?.last_name || ""}`
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          harvest.fruit?.tree?.type
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()),
      );
    }

    // Status filter
    if (selectedStatus !== "all") {
      filtered = filtered.filter(
        (harvest) => harvest.status === selectedStatus,
      );
    }

    // User filter
    if (selectedUserId) {
      filtered = filtered.filter(
        (harvest) => harvest.user?.id === selectedUserId,
      );
    }

    // Date filters
    if (fromDate) {
      filtered = filtered.filter(
        (harvest) => harvest.harvest_at.split("T")[0] >= fromDate,
      );
    }
    if (toDate) {
      filtered = filtered.filter(
        (harvest) => harvest.harvest_at.split("T")[0] <= toDate,
      );
    }

    setFilteredHarvests(filtered);
  };

  const openFilterModal = () => {
    setTempSelectedStatus(selectedStatus);
    setTempSelectedUserId(selectedUserId);
    setTempFromDate(fromDate);
    setTempToDate(toDate);
    setFilterModalVisible(true);
  };

  const applyFilterChanges = () => {
    setSelectedStatus(tempSelectedStatus);
    setSelectedUserId(tempSelectedUserId);
    setFromDate(tempFromDate);
    setToDate(tempToDate);
    setFilterModalVisible(false);
  };

  const resetFilters = () => {
    setSelectedStatus("all");
    setSelectedUserId("");
    setFromDate("");
    setToDate("");
    setSearchQuery("");
    setTempSelectedStatus("all");
    setTempSelectedUserId("");
    setTempFromDate("");
    setTempToDate("");
    setFilterModalVisible(false);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "bg-blue-100 text-blue-700";
      case "partial":
        return "bg-yellow-100 text-yellow-700";
      case "harvested":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "bg-blue-500";
      case "partial":
        return "bg-yellow-500";
      case "harvested":
        return "bg-green-600";
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

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return "Any";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const renderHarvestCard = ({ item }: { item: Harvest; index: number }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => {
        setSelectedHarvest(item);
        setModalVisible(true);
      }}
      className="mx-4 mb-3"
    >
      <View
        className="bg-white rounded-2xl"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        }}
      >
        <View className="p-4">
          {/* Header with Status */}
          <View className="flex-row justify-between items-start mb-3">
            <View className="flex-1 mr-2">
              <Text className="text-lg font-bold text-gray-800">
                {item.fruit?.tree?.description || "Unknown Tree"}
              </Text>
              <View className="flex-row items-center mt-1">
                <View
                  className={`px-2 py-0.5 rounded-full ${getStatusColor(item.status)}`}
                >
                  <Text className="text-xs font-medium capitalize">
                    {item.status}
                  </Text>
                </View>
                <Text className="text-xs text-gray-400 ml-2">
                  {item.fruit?.tree?.type || "N/A"}
                </Text>
              </View>
            </View>
            <View className="bg-green-600 rounded-full px-3 py-1">
              <Text className="text-white font-bold text-lg">
                x{item.fruit?.quantity || 0}
              </Text>
            </View>
          </View>

          {/* User Info */}
          <View className="flex-row items-center mb-2">
            <View className="w-8 h-8 bg-green-100 rounded-full items-center justify-center">
              <Text className="text-green-700 font-bold text-sm">
                {item.user?.first_name?.charAt(0) || "U"}
                {item.user?.last_name?.charAt(0) || ""}
              </Text>
            </View>
            <View className="ml-2 flex-1">
              <Text className="text-sm font-medium text-gray-700">
                {item.user
                  ? `${item.user.first_name} ${item.user.last_name}`
                  : "Unassigned"}
              </Text>
              <Text className="text-xs text-gray-400">{item.user?.email}</Text>
            </View>
          </View>

          {/* Harvest Info */}
          <View className="flex-row items-center mb-2">
            <Ionicons name="calendar-outline" size={14} color="#059669" />
            <Text className="text-xs text-gray-500 ml-1">
              Harvest: {formatDate(item.harvest_at)}
            </Text>
          </View>

          {item.total_weight > 0 && (
            <View className="flex-row items-center mb-2">
              <MaterialCommunityIcons name="weight" size={14} color="#059669" />
              <Text className="text-xs text-gray-500 ml-1">
                Weight: {item.total_weight.toFixed(2)} kg
              </Text>
            </View>
          )}

          {item.total_waste > 0 && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="trash-outline" size={14} color="#ef4444" />
              <Text className="text-xs text-red-500 ml-1">
                Waste: {item.total_waste} pcs
              </Text>
            </View>
          )}

          {/* Date */}
          <View className="flex-row items-center justify-between pt-2 border-t border-gray-100">
            <View className="flex-row items-center">
              <Ionicons name="time-outline" size={14} color="#9ca3af" />
              <Text className="text-xs text-gray-400 ml-1">
                Recorded: {formatDate(item.created_at)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderFilterModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={filterModalVisible}
      onRequestClose={() => setFilterModalVisible(false)}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl max-h-[85%]">
          {/* Modal Header */}
          <View className="flex-row justify-between items-center p-5 border-b border-gray-100">
            <Text className="text-xl font-bold text-gray-800">
              Filter Harvests
            </Text>
            <TouchableOpacity
              onPress={() => setFilterModalVisible(false)}
              className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center"
            >
              <Ionicons name="close" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="p-5">
            {/* Status Filter */}
            <View className="mb-6">
              <View className="flex-row items-center mb-3">
                <View className="w-10 h-10 bg-green-600 rounded-xl items-center justify-center">
                  <MaterialCommunityIcons name="tag" size={20} color="white" />
                </View>
                <Text className="text-lg font-bold text-gray-800 ml-3">
                  Filter by Status
                </Text>
              </View>
              <View className="flex-row flex-wrap gap-2">
                {["all", "pending", "partial", "harvested"].map((status) => (
                  <TouchableOpacity
                    key={status}
                    className={`px-4 py-2 rounded-full ${
                      tempSelectedStatus === status
                        ? "bg-green-600"
                        : "bg-gray-100"
                    }`}
                    onPress={() => setTempSelectedStatus(status)}
                  >
                    <Text
                      className={`text-sm ${
                        tempSelectedStatus === status
                          ? "text-white"
                          : "text-gray-700"
                      }`}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* User Filter */}
            <View className="mb-6">
              <View className="flex-row items-center mb-3">
                <View className="w-10 h-10 bg-purple-500 rounded-xl items-center justify-center">
                  <Ionicons name="person" size={20} color="white" />
                </View>
                <Text className="text-lg font-bold text-gray-800 ml-3">
                  Filter by Harvester
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="flex-row"
              >
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    className={`px-4 py-2 rounded-full ${
                      !tempSelectedUserId ? "bg-green-600" : "bg-gray-100"
                    }`}
                    onPress={() => setTempSelectedUserId("")}
                  >
                    <Text
                      className={`text-sm ${
                        !tempSelectedUserId ? "text-white" : "text-gray-700"
                      }`}
                    >
                      All Harvesters
                    </Text>
                  </TouchableOpacity>
                  {users.map((user) => (
                    <TouchableOpacity
                      key={user.id}
                      className={`px-4 py-2 rounded-full ${
                        tempSelectedUserId === user.id
                          ? "bg-green-600"
                          : "bg-gray-100"
                      }`}
                      onPress={() => setTempSelectedUserId(user.id)}
                    >
                      <Text
                        className={`text-sm ${
                          tempSelectedUserId === user.id
                            ? "text-white"
                            : "text-gray-700"
                        }`}
                      >
                        {user.first_name} {user.last_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Date Range Filter */}
            <View className="mb-6">
              <View className="flex-row items-center mb-3">
                <View className="w-10 h-10 bg-green-600 rounded-xl items-center justify-center">
                  <Ionicons name="calendar" size={20} color="white" />
                </View>
                <Text className="text-lg font-bold text-gray-800 ml-3">
                  Date Range (Harvest Date)
                </Text>
              </View>

              <View className="flex-row gap-4">
                <View className="flex-1">
                  <Text className="text-sm font-medium text-gray-600 mb-2">
                    From Date
                  </Text>
                  <TextInput
                    className="bg-gray-50 rounded-xl p-3 border border-gray-200"
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#9ca3af"
                    value={tempFromDate}
                    onChangeText={setTempFromDate}
                  />
                </View>

                <View className="flex-1">
                  <Text className="text-sm font-medium text-gray-600 mb-2">
                    To Date
                  </Text>
                  <TextInput
                    className="bg-gray-50 rounded-xl p-3 border border-gray-200"
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#9ca3af"
                    value={tempToDate}
                    onChangeText={setTempToDate}
                  />
                </View>
              </View>

              {/* Active Filters Summary */}
              {(tempSelectedStatus !== "all" ||
                tempSelectedUserId ||
                tempFromDate ||
                tempToDate) && (
                <View className="mt-4 p-3 bg-gray-50 rounded-xl">
                  <Text className="text-xs font-semibold text-gray-500 mb-2">
                    ACTIVE FILTERS:
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {tempSelectedStatus !== "all" && (
                      <View className="bg-green-100 px-2 py-1 rounded-full">
                        <Text className="text-xs text-green-700">
                          Status:{" "}
                          {tempSelectedStatus.charAt(0).toUpperCase() +
                            tempSelectedStatus.slice(1)}
                        </Text>
                      </View>
                    )}
                    {tempSelectedUserId &&
                      users.find((u) => u.id === tempSelectedUserId) && (
                        <View className="bg-purple-100 px-2 py-1 rounded-full">
                          <Text className="text-xs text-purple-700">
                            Harvester:{" "}
                            {
                              users.find((u) => u.id === tempSelectedUserId)
                                ?.first_name
                            }
                          </Text>
                        </View>
                      )}
                    {tempFromDate && (
                      <View className="bg-green-100 px-2 py-1 rounded-full">
                        <Text className="text-xs text-green-700">
                          From: {formatDateForDisplay(tempFromDate)}
                        </Text>
                      </View>
                    )}
                    {tempToDate && (
                      <View className="bg-green-100 px-2 py-1 rounded-full">
                        <Text className="text-xs text-green-700">
                          To: {formatDateForDisplay(tempToDate)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View className="p-5 pt-0 gap-3">
            <TouchableOpacity
              className="bg-green-600 py-3 rounded-xl"
              onPress={applyFilterChanges}
            >
              <Text className="text-white font-bold text-center text-base">
                Apply Filters
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-gray-100 py-3 rounded-xl"
              onPress={resetFilters}
            >
              <Text className="text-gray-700 font-semibold text-center">
                Reset All Filters
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderHarvestDetailModal = () => {
    const handleScroll = (event: any) => {
      const { layoutMeasurement, contentOffset, contentSize } =
        event.nativeEvent;
      const paddingToBottom = 20;
      const isBottom =
        layoutMeasurement.height + contentOffset.y >=
        contentSize.height - paddingToBottom;
      setIsAtBottom(isBottom);
    };

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View
            className="bg-white rounded-t-3xl relative"
            style={{ maxHeight: "85%" }}
          >
            {/* Scroll Indicator Badge */}
            {!isAtBottom && (
              <View className="absolute top-2 left-0 right-0 z-10 items-center">
                <View className="bg-gray-800/80 px-4 py-1.5 rounded-full flex-row items-center gap-2">
                  <Ionicons name="chevron-down" size={14} color="white" />
                  <Text className="text-white text-xs font-medium">
                    Scroll for more
                  </Text>
                  <Ionicons name="chevron-down" size={14} color="white" />
                </View>
              </View>
            )}

            {/* Modal Header */}
            <View className="flex-row justify-between items-center p-5 border-b border-gray-100 pt-6">
              <Text className="text-xl font-bold text-gray-800">
                Harvest Details
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  setIsAtBottom(false);
                }}
                className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center"
              >
                <Ionicons name="close" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {selectedHarvest && (
              <ScrollView
                ref={scrollViewRef}
                showsVerticalScrollIndicator={false}
                className="p-5"
                onScroll={handleScroll}
                scrollEventThrottle={16}
                contentContainerStyle={{ paddingBottom: 20 }}
              >
                {/* Status Section */}
                <View className="mb-6">
                  <View className="flex-row items-center mb-3">
                    <View className="w-10 h-10 bg-green-600 rounded-xl items-center justify-center">
                      <MaterialCommunityIcons
                        name="tag"
                        size={20}
                        color="white"
                      />
                    </View>
                    <Text className="text-lg font-bold text-gray-800 ml-3">
                      Status
                    </Text>
                  </View>
                  <View className="bg-gray-50 rounded-xl p-4">
                    <View
                      className={`self-start px-4 py-2 rounded-full ${getStatusBgColor(selectedHarvest.status)}`}
                    >
                      <Text className="text-white font-bold">
                        {selectedHarvest.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Tree Section */}
                <View className="mb-6">
                  <View className="flex-row items-center mb-3">
                    <View className="w-10 h-10 bg-green-600 rounded-xl items-center justify-center">
                      <MaterialCommunityIcons
                        name="tree"
                        size={20}
                        color="white"
                      />
                    </View>
                    <Text className="text-lg font-bold text-gray-800 ml-3">
                      Tree Information
                    </Text>
                  </View>
                  <View className="bg-gray-50 rounded-xl p-4">
                    <View className="mb-2">
                      <Text className="text-xs text-gray-500 uppercase tracking-wide">
                        Name
                      </Text>
                      <Text className="text-base font-semibold text-gray-800">
                        {selectedHarvest.fruit?.tree?.description || "N/A"}
                      </Text>
                    </View>
                    <View>
                      <Text className="text-xs text-gray-500 uppercase tracking-wide">
                        Type
                      </Text>
                      <Text className="text-base text-gray-700">
                        {selectedHarvest.fruit?.tree?.type || "N/A"}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* User Section */}
                <View className="mb-6">
                  <View className="flex-row items-center mb-3">
                    <View className="w-10 h-10 bg-purple-500 rounded-xl items-center justify-center">
                      <Ionicons name="person" size={20} color="white" />
                    </View>
                    <Text className="text-lg font-bold text-gray-800 ml-3">
                      Harvester Information
                    </Text>
                  </View>
                  <View className="bg-gray-50 rounded-xl p-4">
                    <View className="mb-2">
                      <Text className="text-xs text-gray-500 uppercase tracking-wide">
                        Name
                      </Text>
                      <Text className="text-base font-semibold text-gray-800">
                        {selectedHarvest.user
                          ? `${selectedHarvest.user.first_name} ${selectedHarvest.user.last_name}`
                          : "Unassigned"}
                      </Text>
                    </View>
                    <View>
                      <Text className="text-xs text-gray-500 uppercase tracking-wide">
                        Email
                      </Text>
                      <Text className="text-base text-gray-700">
                        {selectedHarvest.user?.email || "N/A"}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Harvest Section */}
                <View className="mb-6">
                  <View className="flex-row items-center mb-3">
                    <View className="w-10 h-10 bg-green-600 rounded-xl items-center justify-center">
                      <MaterialCommunityIcons
                        name="fruit-pear"
                        size={20}
                        color="white"
                      />
                    </View>
                    <Text className="text-lg font-bold text-gray-800 ml-3">
                      Harvest Details
                    </Text>
                  </View>
                  <View className="bg-gray-50 rounded-xl p-4">
                    <View className="mb-2">
                      <Text className="text-xs text-gray-500 uppercase tracking-wide">
                        Total Fruit Quantity
                      </Text>
                      <Text className="text-2xl font-bold text-green-700">
                        {selectedHarvest.fruit?.quantity || 0} pcs
                      </Text>
                    </View>
                    {selectedHarvest.ripe_quantity !== null &&
                      selectedHarvest.ripe_quantity > 0 && (
                        <View className="mb-2">
                          <Text className="text-xs text-gray-500 uppercase tracking-wide">
                            Ripe Quantity
                          </Text>
                          <Text className="text-base text-gray-700">
                            {selectedHarvest.ripe_quantity} pcs
                          </Text>
                        </View>
                      )}
                    <View className="mb-2">
                      <Text className="text-xs text-gray-500 uppercase tracking-wide">
                        Harvest Date
                      </Text>
                      <Text className="text-base text-gray-700">
                        {formatDateTime(selectedHarvest.harvest_at)}
                      </Text>
                    </View>
                    <View>
                      <Text className="text-xs text-gray-500 uppercase tracking-wide">
                        Record Created
                      </Text>
                      <Text className="text-base text-gray-700">
                        {formatDateTime(selectedHarvest.created_at)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Weights Section */}
                {selectedHarvest.fruit_weights &&
                  selectedHarvest.fruit_weights.length > 0 && (
                    <View className="mb-6">
                      <View className="flex-row items-center mb-3">
                        <View className="w-10 h-10 bg-blue-500 rounded-xl items-center justify-center">
                          <MaterialCommunityIcons
                            name="weight"
                            size={20}
                            color="white"
                          />
                        </View>
                        <Text className="text-lg font-bold text-gray-800 ml-3">
                          Fruit Weights
                        </Text>
                      </View>
                      <View className="bg-gray-50 rounded-xl p-4">
                        <View className="mb-2">
                          <Text className="text-xs text-gray-500 uppercase tracking-wide">
                            Total Weight
                          </Text>
                          <Text className="text-base font-semibold text-gray-800">
                            {selectedHarvest.total_weight.toFixed(2)} kg
                          </Text>
                        </View>
                        <View>
                          <Text className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                            Individual Weights
                          </Text>
                          {selectedHarvest.fruit_weights.map(
                            (weight, index) => (
                              <Text
                                key={index}
                                className="text-sm text-gray-600"
                              >
                                • {weight.weight} kg
                              </Text>
                            ),
                          )}
                        </View>
                      </View>
                    </View>
                  )}

                {/* Wastes Section */}
                {selectedHarvest.wastes &&
                  selectedHarvest.wastes.length > 0 && (
                    <View className="mb-6">
                      <View className="flex-row items-center mb-3">
                        <View className="w-10 h-10 bg-red-500 rounded-xl items-center justify-center">
                          <Ionicons name="trash" size={20} color="white" />
                        </View>
                        <Text className="text-lg font-bold text-gray-800 ml-3">
                          Waste Details
                        </Text>
                      </View>
                      <View className="bg-gray-50 rounded-xl p-4">
                        <View className="mb-2">
                          <Text className="text-xs text-gray-500 uppercase tracking-wide">
                            Total Waste
                          </Text>
                          <Text className="text-base font-semibold text-red-600">
                            {selectedHarvest.total_waste} pcs
                          </Text>
                        </View>
                        <View>
                          <Text className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                            Waste Breakdown
                          </Text>
                          {selectedHarvest.wastes.map((waste, index) => (
                            <Text key={index} className="text-sm text-red-600">
                              • {waste.waste_quantity} pcs - {waste.reason}
                            </Text>
                          ))}
                        </View>
                      </View>
                    </View>
                  )}
              </ScrollView>
            )}

            {/* Bottom Close Button with Insets */}
            <View
              style={{
                paddingBottom: Platform.OS === "android" ? insets.bottom : 0,
              }}
              className="p-5 pt-0 bg-white"
            >
              <TouchableOpacity
                className={`py-3 rounded-xl flex-row items-center justify-center gap-2 ${
                  isAtBottom ? "bg-green-600" : "bg-gray-200"
                }`}
                onPress={() => {
                  if (isAtBottom) {
                    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
                    setIsAtBottom(false);
                  } else {
                    setModalVisible(false);
                  }
                }}
              >
                <Ionicons
                  name={isAtBottom ? "arrow-up" : "close"}
                  size={18}
                  color={isAtBottom ? "white" : "#6b7280"}
                />
                <Text
                  className={`font-bold text-center text-base ${
                    isAtBottom ? "text-white" : "text-gray-500"
                  }`}
                >
                  {isAtBottom ? "Back to Top" : "Close"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#059669" />
          <Text className="text-gray-500 mt-3">Loading harvests...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

      {/* Header with Back Button */}
      <View className="bg-white px-5 pt-4 pb-5 border-b border-gray-200">
        <View className="flex-row items-center mb-4">
          <TouchableOpacity
            onPress={() => router.push("/admin/(drawers)/(tabs)/")}
            className="w-10 h-10 rounded-full items-center justify-center bg-gray-100 mr-3"
          >
            <Ionicons name="arrow-back" size={22} color="#374151" />
          </TouchableOpacity>
          <View>
            <Text className="text-3xl font-bold text-gray-900">
              All Harvests
            </Text>
            <Text className="text-gray-500 text-sm mt-1">
              Track and manage all harvest records
            </Text>
          </View>
          <TouchableOpacity
            className="bg-gray-100 px-4 py-2 rounded-full ml-auto"
            onPress={openFilterModal}
          >
            <View className="flex-row items-center">
              <Ionicons name="filter" size={18} color="#059669" />
              <Text className="text-green-700 ml-2 font-medium">Filter</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center bg-gray-100 rounded-xl px-3 py-2">
          <Ionicons name="search" size={20} color="#9ca3af" />
          <TextInput
            className="flex-1 ml-2 text-gray-800"
            placeholder="Search by tree, harvester, or type..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== "" && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>

        {/* Active Filters Chips */}
        {(selectedStatus !== "all" || selectedUserId || fromDate || toDate) && (
          <View className="flex-row flex-wrap gap-2 mt-3">
            {selectedStatus !== "all" && (
              <View className="bg-green-100 px-3 py-1 rounded-full flex-row items-center">
                <Text className="text-xs text-green-700">
                  Status:{" "}
                  {selectedStatus.charAt(0).toUpperCase() +
                    selectedStatus.slice(1)}
                </Text>
                <TouchableOpacity
                  onPress={() => setSelectedStatus("all")}
                  className="ml-2"
                >
                  <Ionicons name="close-circle" size={14} color="#059669" />
                </TouchableOpacity>
              </View>
            )}
            {selectedUserId && users.find((u) => u.id === selectedUserId) && (
              <View className="bg-purple-100 px-3 py-1 rounded-full flex-row items-center">
                <Text className="text-xs text-purple-700">
                  Harvester:{" "}
                  {users.find((u) => u.id === selectedUserId)?.first_name}
                </Text>
                <TouchableOpacity
                  onPress={() => setSelectedUserId("")}
                  className="ml-2"
                >
                  <Ionicons name="close-circle" size={14} color="#9333ea" />
                </TouchableOpacity>
              </View>
            )}
            {fromDate && (
              <View className="bg-green-100 px-3 py-1 rounded-full flex-row items-center">
                <Text className="text-xs text-green-700">
                  From: {formatDateForDisplay(fromDate)}
                </Text>
                <TouchableOpacity
                  onPress={() => setFromDate("")}
                  className="ml-2"
                >
                  <Ionicons name="close-circle" size={14} color="#059669" />
                </TouchableOpacity>
              </View>
            )}
            {toDate && (
              <View className="bg-green-100 px-3 py-1 rounded-full flex-row items-center">
                <Text className="text-xs text-green-700">
                  To: {formatDateForDisplay(toDate)}
                </Text>
                <TouchableOpacity
                  onPress={() => setToDate("")}
                  className="ml-2"
                >
                  <Ionicons name="close-circle" size={14} color="#059669" />
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity onPress={resetFilters}>
              <View className="bg-gray-100 px-3 py-1 rounded-full">
                <Text className="text-xs text-gray-600">Clear All</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Stats Bar */}
      <View className="flex-row justify-between items-center px-5 py-3 bg-white border-b border-gray-100">
        <View className="flex-row items-center">
          <MaterialCommunityIcons name="fruit-pear" size={18} color="#059669" />
          <Text className="text-sm text-gray-600 ml-2">
            Showing{" "}
            <Text className="font-bold text-green-700">
              {filteredHarvests.length}
            </Text>{" "}
            of <Text className="font-bold">{harvests.length}</Text> harvests
          </Text>
        </View>
        {filteredHarvests.length > 0 && (
          <View className="bg-green-50 px-2 py-1 rounded-full">
            <Text className="text-xs text-green-700">
              {((filteredHarvests.length / harvests.length) * 100).toFixed(0)}%
            </Text>
          </View>
        )}
      </View>

      {/* Harvest List */}
      <FlatList
        data={filteredHarvests}
        keyExtractor={(item) => item.id}
        renderItem={renderHarvestCard}
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: 20,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#059669"]}
            tintColor="#059669"
          />
        }
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center py-20">
            <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-4">
              <MaterialCommunityIcons
                name="fruit-pear"
                size={40}
                color="#9ca3af"
              />
            </View>
            <Text className="text-lg font-medium text-gray-500 mb-2">
              No harvests found
            </Text>
            <Text className="text-sm text-gray-400 text-center px-10">
              {searchQuery ||
              selectedStatus !== "all" ||
              selectedUserId ||
              fromDate ||
              toDate
                ? "Try adjusting your filters or search query"
                : "No harvests have been recorded yet"}
            </Text>
          </View>
        }
      />

      {renderFilterModal()}
      {renderHarvestDetailModal()}
    </SafeAreaView>
  );
}
