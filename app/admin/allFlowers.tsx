import client from "@/utils/axiosInstance";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
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
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

interface Flower {
  id: string;
  tree_id: string;
  user_id: string;
  quantity: number;
  wrapped_at: string;
  image_url: string;
  created_at: string;
  updated_at: string;
  tree: {
    id: string;
    description: string;
    latitude: number;
    longitude: number;
    status: string;
    is_synced: boolean;
    type: string;
    image_url: string;
    created_at: string;
    updated_at: string;
  };
  user: {
    id: string;
    first_name: string;
    last_name: string;
    gender: string;
    email: string;
    role: string;
    created_at: string;
    updated_at: string;
  };
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface Tree {
  id: string;
  description: string;
  type: string;
}

export default function AllFlowers() {
  const router = useRouter();
  const [flowers, setFlowers] = useState<Flower[]>([]);
  const [filteredFlowers, setFilteredFlowers] = useState<Flower[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [trees, setTrees] = useState<Tree[]>([]);

  // Filter states
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedTreeId, setSelectedTreeId] = useState<string>("");
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);

  // Filter modal states
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [tempUserId, setTempUserId] = useState<string>("");
  const [tempTreeId, setTempTreeId] = useState<string>("");
  const [tempFromDate, setTempFromDate] = useState<Date | null>(null);
  const [tempToDate, setTempToDate] = useState<Date | null>(null);

  // Date picker states
  const [showFromDatePicker, setShowFromDatePicker] = useState(false);
  const [showToDatePicker, setShowToDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<"from" | "to">("from");

  // Modal states for flower details
  const [selectedFlower, setSelectedFlower] = useState<Flower | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchFlowers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [flowers, selectedUserId, selectedTreeId, fromDate, toDate, searchQuery]);

  const fetchFlowers = async () => {
    try {
      setLoading(true);
      const response = await client.get("/flowers");
      if (response.data.success) {
        setFlowers(response.data.data);
        setFilteredFlowers(response.data.data);

        const uniqueUsers = Array.from(
          new Map(
            response.data.data.map((flower: Flower) => [
              flower.user.id,
              flower.user,
            ]),
          ).values(),
        );
        setUsers(uniqueUsers);

        const uniqueTrees = Array.from(
          new Map(
            response.data.data.map((flower: Flower) => [
              flower.tree.id,
              flower.tree,
            ]),
          ).values(),
        );
        setTrees(uniqueTrees);
      }
    } catch (error) {
      console.error("Error fetching flowers:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFlowers();
    resetFilters();
    setRefreshing(false);
  };

  const applyFilters = () => {
    let filtered = [...flowers];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (flower) =>
          flower.tree.description
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          `${flower.user.first_name} ${flower.user.last_name}`
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          flower.tree.type.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    if (selectedUserId) {
      filtered = filtered.filter((flower) => flower.user.id === selectedUserId);
    }

    if (selectedTreeId) {
      filtered = filtered.filter((flower) => flower.tree.id === selectedTreeId);
    }

    if (fromDate) {
      const fromDateStr = fromDate.toISOString().split("T")[0];
      filtered = filtered.filter(
        (flower) => flower.wrapped_at.split("T")[0] >= fromDateStr,
      );
    }
    if (toDate) {
      const toDateStr = toDate.toISOString().split("T")[0];
      filtered = filtered.filter(
        (flower) => flower.wrapped_at.split("T")[0] <= toDateStr,
      );
    }

    setFilteredFlowers(filtered);
  };

  const openFilterModal = () => {
    setTempUserId(selectedUserId);
    setTempTreeId(selectedTreeId);
    setTempFromDate(fromDate);
    setTempToDate(toDate);
    setFilterModalVisible(true);
  };

  const applyFilterChanges = () => {
    setSelectedUserId(tempUserId);
    setSelectedTreeId(tempTreeId);
    setFromDate(tempFromDate);
    setToDate(tempToDate);
    setFilterModalVisible(false);
  };

  const resetFilters = () => {
    setSelectedUserId("");
    setSelectedTreeId("");
    setFromDate(null);
    setToDate(null);
    setSearchQuery("");
    setTempUserId("");
    setTempTreeId("");
    setTempFromDate(null);
    setTempToDate(null);
    setFilterModalVisible(false);
  };

  const clearDateFilter = (type: "from" | "to") => {
    if (type === "from") {
      setTempFromDate(null);
    } else {
      setTempToDate(null);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowFromDatePicker(false);
      setShowToDatePicker(false);
    }

    if (selectedDate) {
      if (pickerMode === "from") {
        setTempFromDate(selectedDate);
      } else {
        setTempToDate(selectedDate);
      }
    }

    if (Platform.OS === "ios") {
      // Keep picker open on iOS for continuous selection
    } else {
      setShowFromDatePicker(false);
      setShowToDatePicker(false);
    }
  };

  const formatDateForDisplay = (date: Date | null) => {
    if (!date) return "Any";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateForAPI = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
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

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-700";
      case "inactive":
        return "bg-gray-100 text-gray-700";
      case "flowering":
        return "bg-pink-100 text-pink-700";
      case "fruiting":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-blue-100 text-blue-700";
    }
  };

  const renderFlowerCard = ({ item }: { item: Flower; index: number }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => {
        setSelectedFlower(item);
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
          {/* Header */}
          <View className="flex-row justify-between items-start mb-3">
            <View className="flex-1 mr-2">
              <Text className="text-lg font-bold text-gray-800">
                {item.tree.description}
              </Text>
              <View className="flex-row items-center mt-1">
                <View
                  className={`px-2 py-0.5 rounded-full ${getStatusColor(item.tree.status)}`}
                >
                  <Text className="text-xs font-medium capitalize">
                    {item.tree.status}
                  </Text>
                </View>
                <Text className="text-xs text-gray-400 ml-2">
                  {item.tree.type}
                </Text>
              </View>
            </View>
            <View className="bg-pink-500 rounded-full px-3 py-1">
              <Text className="text-white font-bold text-lg">
                x{item.quantity}
              </Text>
            </View>
          </View>

          {/* User Info */}
          <View className="flex-row items-center mb-2">
            <View className="w-8 h-8 bg-pink-100 rounded-full items-center justify-center">
              <Text className="text-pink-600 font-bold text-sm">
                {item.user.first_name.charAt(0)}
                {item.user.last_name.charAt(0)}
              </Text>
            </View>
            <View className="ml-2 flex-1">
              <Text className="text-sm font-medium text-gray-700">
                {item.user.first_name} {item.user.last_name}
              </Text>
              <Text className="text-xs text-gray-400">{item.user.email}</Text>
            </View>
          </View>

          {/* Date */}
          <View className="flex-row items-center justify-between pt-2 border-t border-gray-100">
            <View className="flex-row items-center">
              <Ionicons name="calendar-outline" size={14} color="#9ca3af" />
              <Text className="text-xs text-gray-400 ml-1">
                Wrapped: {formatDateForAPI(item.wrapped_at)}
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
        <View className="bg-white rounded-t-3xl max-h-[90%]">
          {/* Modal Header */}
          <View className="flex-row justify-between items-center p-5 border-b border-gray-100">
            <Text className="text-xl font-bold text-gray-800">
              Filter Flowers
            </Text>
            <TouchableOpacity
              onPress={() => setFilterModalVisible(false)}
              className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center"
            >
              <Ionicons name="close" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="p-5">
            {/* User Filter */}
            <View className="mb-6">
              <View className="flex-row items-center mb-3">
                <View className="w-10 h-10 bg-purple-500 rounded-xl items-center justify-center">
                  <Ionicons name="person" size={20} color="white" />
                </View>
                <Text className="text-lg font-bold text-gray-800 ml-3">
                  Filter by User
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="flex-row"
              >
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    className={`px-4 py-2 rounded-full ${!tempUserId ? "bg-pink-500" : "bg-gray-100"}`}
                    onPress={() => setTempUserId("")}
                  >
                    <Text
                      className={`text-sm ${!tempUserId ? "text-white" : "text-gray-700"}`}
                    >
                      All Users
                    </Text>
                  </TouchableOpacity>
                  {users.map((user) => (
                    <TouchableOpacity
                      key={user.id}
                      className={`px-4 py-2 rounded-full ${tempUserId === user.id ? "bg-pink-500" : "bg-gray-100"}`}
                      onPress={() => setTempUserId(user.id)}
                    >
                      <Text
                        className={`text-sm ${tempUserId === user.id ? "text-white" : "text-gray-700"}`}
                      >
                        {user.first_name} {user.last_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Tree Filter */}
            <View className="mb-6">
              <View className="flex-row items-center mb-3">
                <View className="w-10 h-10 bg-green-500 rounded-xl items-center justify-center">
                  <Ionicons name="leaf" size={20} color="white" />
                </View>
                <Text className="text-lg font-bold text-gray-800 ml-3">
                  Filter by Tree
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="flex-row"
              >
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    className={`px-4 py-2 rounded-full ${!tempTreeId ? "bg-pink-500" : "bg-gray-100"}`}
                    onPress={() => setTempTreeId("")}
                  >
                    <Text
                      className={`text-sm ${!tempTreeId ? "text-white" : "text-gray-700"}`}
                    >
                      All Trees
                    </Text>
                  </TouchableOpacity>
                  {trees.map((tree) => (
                    <TouchableOpacity
                      key={tree.id}
                      className={`px-4 py-2 rounded-full ${tempTreeId === tree.id ? "bg-pink-500" : "bg-gray-100"}`}
                      onPress={() => setTempTreeId(tree.id)}
                    >
                      <Text
                        className={`text-sm ${tempTreeId === tree.id ? "text-white" : "text-gray-700"}`}
                        numberOfLines={1}
                      >
                        {tree.description.length > 20
                          ? tree.description.substring(0, 20) + "..."
                          : tree.description}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Date Range Filter */}
            <View className="mb-6">
              <View className="flex-row items-center mb-3">
                <View className="w-10 h-10 bg-orange-500 rounded-xl items-center justify-center">
                  <Ionicons name="calendar" size={20} color="white" />
                </View>
                <Text className="text-lg font-bold text-gray-800 ml-3">
                  Date Range
                </Text>
              </View>

              <View className="flex-row gap-4">
                {/* From Date */}
                <View className="flex-1">
                  <Text className="text-sm font-medium text-gray-600 mb-2">
                    From Date
                  </Text>
                  <TouchableOpacity
                    className="flex-row items-center justify-between bg-gray-50 rounded-xl p-3 border border-gray-200"
                    onPress={() => {
                      setPickerMode("from");
                      setShowFromDatePicker(true);
                    }}
                  >
                    <Text className="text-gray-700">
                      {tempFromDate
                        ? formatDateForDisplay(tempFromDate)
                        : "Select date"}
                    </Text>
                    {tempFromDate && (
                      <TouchableOpacity onPress={() => clearDateFilter("from")}>
                        <Ionicons
                          name="close-circle"
                          size={18}
                          color="#9ca3af"
                        />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                </View>

                {/* To Date */}
                <View className="flex-1">
                  <Text className="text-sm font-medium text-gray-600 mb-2">
                    To Date
                  </Text>
                  <TouchableOpacity
                    className="flex-row items-center justify-between bg-gray-50 rounded-xl p-3 border border-gray-200"
                    onPress={() => {
                      setPickerMode("to");
                      setShowToDatePicker(true);
                    }}
                  >
                    <Text className="text-gray-700">
                      {tempToDate
                        ? formatDateForDisplay(tempToDate)
                        : "Select date"}
                    </Text>
                    {tempToDate && (
                      <TouchableOpacity onPress={() => clearDateFilter("to")}>
                        <Ionicons
                          name="close-circle"
                          size={18}
                          color="#9ca3af"
                        />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Active Filters Summary */}
              {(tempUserId || tempTreeId || tempFromDate || tempToDate) && (
                <View className="mt-4 p-3 bg-gray-50 rounded-xl">
                  <Text className="text-xs font-semibold text-gray-500 mb-2">
                    ACTIVE FILTERS:
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {tempUserId && users.find((u) => u.id === tempUserId) && (
                      <View className="bg-pink-100 px-2 py-1 rounded-full">
                        <Text className="text-xs text-pink-700">
                          User:{" "}
                          {users.find((u) => u.id === tempUserId)?.first_name}
                        </Text>
                      </View>
                    )}
                    {tempTreeId && trees.find((t) => t.id === tempTreeId) && (
                      <View className="bg-pink-100 px-2 py-1 rounded-full">
                        <Text className="text-xs text-pink-700">
                          Tree:{" "}
                          {trees
                            .find((t) => t.id === tempTreeId)
                            ?.description.substring(0, 15)}
                        </Text>
                      </View>
                    )}
                    {tempFromDate && (
                      <View className="bg-orange-100 px-2 py-1 rounded-full">
                        <Text className="text-xs text-orange-700">
                          From: {formatDateForDisplay(tempFromDate)}
                        </Text>
                      </View>
                    )}
                    {tempToDate && (
                      <View className="bg-orange-100 px-2 py-1 rounded-full">
                        <Text className="text-xs text-orange-700">
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
              className="bg-pink-500 py-3 rounded-xl"
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

      {/* Date Pickers */}
      {showFromDatePicker && (
        <DateTimePicker
          value={tempFromDate || new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onDateChange}
          maximumDate={tempToDate || undefined}
        />
      )}
      {showToDatePicker && (
        <DateTimePicker
          value={tempToDate || new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onDateChange}
          minimumDate={tempFromDate || undefined}
        />
      )}
    </Modal>
  );

  const renderFlowerDetailModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={modalVisible}
      onRequestClose={() => setModalVisible(false)}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl max-h-[85%]">
          {/* Modal Header */}
          <View className="flex-row justify-between items-center p-5 border-b border-gray-100">
            <Text className="text-xl font-bold text-gray-800">
              Flower Details
            </Text>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center"
            >
              <Ionicons name="close" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {selectedFlower && (
            <ScrollView showsVerticalScrollIndicator={false} className="p-5">
              {/* Tree Section */}
              <View className="mb-6">
                <View className="flex-row items-center mb-3">
                  <View className="w-10 h-10 bg-green-500 rounded-xl items-center justify-center">
                    <Ionicons name="leaf" size={20} color="white" />
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
                      {selectedFlower.tree.description}
                    </Text>
                  </View>
                  <View className="mb-2">
                    <Text className="text-xs text-gray-500 uppercase tracking-wide">
                      Type
                    </Text>
                    <Text className="text-base text-gray-700">
                      {selectedFlower.tree.type}
                    </Text>
                  </View>
                  <View className="mb-2">
                    <Text className="text-xs text-gray-500 uppercase tracking-wide">
                      Status
                    </Text>
                    <View
                      className={`self-start px-2 py-0.5 rounded-full mt-1 ${getStatusColor(selectedFlower.tree.status)}`}
                    >
                      <Text className="text-xs font-medium capitalize">
                        {selectedFlower.tree.status}
                      </Text>
                    </View>
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
                    User Information
                  </Text>
                </View>
                <View className="bg-gray-50 rounded-xl p-4">
                  <View className="mb-2">
                    <Text className="text-xs text-gray-500 uppercase tracking-wide">
                      Name
                    </Text>
                    <Text className="text-base font-semibold text-gray-800">
                      {selectedFlower.user.first_name}{" "}
                      {selectedFlower.user.last_name}
                    </Text>
                  </View>
                  <View className="mb-2">
                    <Text className="text-xs text-gray-500 uppercase tracking-wide">
                      Email
                    </Text>
                    <Text className="text-base text-gray-700">
                      {selectedFlower.user.email}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-xs text-gray-500 uppercase tracking-wide">
                      Gender
                    </Text>
                    <Text className="text-base text-gray-700 capitalize">
                      {selectedFlower.user.gender}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Flower Image Section */}
              {selectedFlower.image_url && (
                <View className="mb-6">
                  <View className="flex-row items-center mb-3">
                    <View className="w-10 h-10 bg-pink-500 rounded-xl items-center justify-center">
                      <Ionicons name="image" size={20} color="white" />
                    </View>
                    <Text className="text-lg font-bold text-gray-800 ml-3">
                      Flower Image
                    </Text>
                  </View>
                  <View className="bg-gray-50 rounded-xl p-4 items-center">
                    <Image
                      source={{ uri: selectedFlower.image_url }}
                      className="w-full h-48 rounded-xl"
                      resizeMode="cover"
                      onError={(e) =>
                        console.log("Image load error:", e.nativeEvent.error)
                      }
                    />
                  </View>
                </View>
              )}

              {/* Flower Section */}
              <View className="mb-6">
                <View className="flex-row items-center mb-3">
                  <View className="w-10 h-10 bg-pink-500 rounded-xl items-center justify-center">
                    <Ionicons name="flower" size={20} color="white" />
                  </View>
                  <Text className="text-lg font-bold text-gray-800 ml-3">
                    Flower Details
                  </Text>
                </View>
                <View className="bg-gray-50 rounded-xl p-4">
                  <View className="mb-2">
                    <Text className="text-xs text-gray-500 uppercase tracking-wide">
                      Quantity
                    </Text>
                    <Text className="text-2xl font-bold text-pink-600">
                      {selectedFlower.quantity}
                    </Text>
                  </View>
                  <View className="mb-2">
                    <Text className="text-xs text-gray-500 uppercase tracking-wide">
                      Wrapped At
                    </Text>
                    <Text className="text-base text-gray-700">
                      {formatDateTime(selectedFlower.wrapped_at)}
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          )}

          <View className="p-5 pt-0">
            <TouchableOpacity
              className="bg-pink-500 py-3 rounded-xl"
              onPress={() => setModalVisible(false)}
            >
              <Text className="text-white font-bold text-center text-base">
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#ec489a" />
          <Text className="text-gray-500 mt-3">Loading flowers...</Text>
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
              All Flowers
            </Text>
            <Text className="text-gray-500 text-sm mt-1">
              Track and manage all wrapped flowers
            </Text>
          </View>
          <TouchableOpacity
            className="bg-gray-100 px-4 py-2 rounded-full ml-auto"
            onPress={openFilterModal}
          >
            <View className="flex-row items-center">
              <Ionicons name="filter" size={18} color="#ec489a" />
              <Text className="text-pink-500 ml-2 font-medium">Filter</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center bg-gray-100 rounded-xl px-3 py-2">
          <Ionicons name="search" size={20} color="#9ca3af" />
          <TextInput
            className="flex-1 ml-2 text-gray-800"
            placeholder="Search by tree, user, or type..."
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
        {(selectedUserId || selectedTreeId || fromDate || toDate) && (
          <View className="flex-row flex-wrap gap-2 mt-3">
            {selectedUserId && users.find((u) => u.id === selectedUserId) && (
              <View className="bg-pink-100 px-3 py-1 rounded-full flex-row items-center">
                <Text className="text-xs text-pink-700">
                  User: {users.find((u) => u.id === selectedUserId)?.first_name}
                </Text>
                <TouchableOpacity
                  onPress={() => setSelectedUserId("")}
                  className="ml-2"
                >
                  <Ionicons name="close-circle" size={14} color="#ec489a" />
                </TouchableOpacity>
              </View>
            )}
            {selectedTreeId && trees.find((t) => t.id === selectedTreeId) && (
              <View className="bg-pink-100 px-3 py-1 rounded-full flex-row items-center">
                <Text className="text-xs text-pink-700">
                  Tree:{" "}
                  {trees
                    .find((t) => t.id === selectedTreeId)
                    ?.description.substring(0, 15)}
                </Text>
                <TouchableOpacity
                  onPress={() => setSelectedTreeId("")}
                  className="ml-2"
                >
                  <Ionicons name="close-circle" size={14} color="#ec489a" />
                </TouchableOpacity>
              </View>
            )}
            {fromDate && (
              <View className="bg-orange-100 px-3 py-1 rounded-full flex-row items-center">
                <Text className="text-xs text-orange-700">
                  From: {formatDateForDisplay(fromDate)}
                </Text>
                <TouchableOpacity
                  onPress={() => setFromDate(null)}
                  className="ml-2"
                >
                  <Ionicons name="close-circle" size={14} color="#f97316" />
                </TouchableOpacity>
              </View>
            )}
            {toDate && (
              <View className="bg-orange-100 px-3 py-1 rounded-full flex-row items-center">
                <Text className="text-xs text-orange-700">
                  To: {formatDateForDisplay(toDate)}
                </Text>
                <TouchableOpacity
                  onPress={() => setToDate(null)}
                  className="ml-2"
                >
                  <Ionicons name="close-circle" size={14} color="#f97316" />
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
          <Ionicons name="flower" size={18} color="#ec489a" />
          <Text className="text-sm text-gray-600 ml-2">
            Showing{" "}
            <Text className="font-bold text-pink-500">
              {filteredFlowers.length}
            </Text>{" "}
            of <Text className="font-bold">{flowers.length}</Text> flowers
          </Text>
        </View>
        {filteredFlowers.length > 0 && (
          <View className="bg-pink-50 px-2 py-1 rounded-full">
            <Text className="text-xs text-pink-600">
              {((filteredFlowers.length / flowers.length) * 100).toFixed(0)}%
            </Text>
          </View>
        )}
      </View>

      {/* Flower List */}
      <FlatList
        data={filteredFlowers}
        keyExtractor={(item) => item.id}
        renderItem={renderFlowerCard}
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: 20,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#ec489a"]}
            tintColor="#ec489a"
          />
        }
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center py-20">
            <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-4">
              <Ionicons name="flower-outline" size={40} color="#9ca3af" />
            </View>
            <Text className="text-lg font-medium text-gray-500 mb-2">
              No flowers found
            </Text>
            <Text className="text-sm text-gray-400 text-center px-10">
              {searchQuery ||
              selectedUserId ||
              selectedTreeId ||
              fromDate ||
              toDate
                ? "Try adjusting your filters or search query"
                : "No flowers have been wrapped yet"}
            </Text>
          </View>
        }
      />

      {renderFilterModal()}
      {renderFlowerDetailModal()}
    </SafeAreaView>
  );
}
