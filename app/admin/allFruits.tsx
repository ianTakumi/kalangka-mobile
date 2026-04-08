import FruitService from "@/services/FruitService";
import { Ionicons } from "@expo/vector-icons";
import Entypo from "@expo/vector-icons/Entypo";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
interface Fruit {
  id: string;
  flower_id: string;
  tree_id: string;
  user_id: string;
  tag_id: number; // Add tag_id
  quantity: number;
  bagged_at: string;
  image_url: string;
  created_at: string;
  updated_at: string;
  flower: {
    id: string;
    tree_id: string;
    user_id: string;
    quantity: number;
    wrapped_at: string;
    image_url: string;
    created_at: string;
    updated_at: string;
  };
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

export default function AllFruits() {
  const [fruits, setFruits] = useState<Fruit[]>([]);
  const [filteredFruits, setFilteredFruits] = useState<Fruit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [trees, setTrees] = useState<Tree[]>([]);

  // Filter states
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedTreeId, setSelectedTreeId] = useState<string>("");
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null); // Add tag_id filter
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Filter modal states
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [tempUserId, setTempUserId] = useState<string>("");
  const [tempTreeId, setTempTreeId] = useState<string>("");
  const [tempTagId, setTempTagId] = useState<number | null>(null); // Add temp tag_id
  const [tempFromDate, setTempFromDate] = useState<string>("");
  const [tempToDate, setTempToDate] = useState<string>("");

  // Modal states for fruit details
  const [selectedFruit, setSelectedFruit] = useState<Fruit | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Batch summary state
  const [batchSummary, setBatchSummary] = useState({
    batch1: 0,
    batch2: 0,
    batch3: 0,
    batch4: 0,
  });

  useEffect(() => {
    fetchFruits();
  }, []);

  useEffect(() => {
    applyFilters();
    calculateBatchSummary();
  }, [
    fruits,
    selectedUserId,
    selectedTreeId,
    selectedTagId,
    fromDate,
    toDate,
    searchQuery,
  ]);

  const fetchFruits = async () => {
    try {
      setLoading(true);

      // Get fruits from local SQLite database
      const localFruits = await FruitService.getAllFruits();
      console.log(
        "Fetched fruits from local database:",
        JSON.stringify(localFruits),
      );
      if (localFruits.success && localFruits.data) {
        setFruits(localFruits.data);
        setFilteredFruits(localFruits.data);

        // Extract unique users
        const uniqueUsers = Array.from(
          new Map(
            localFruits.data.map((fruit: Fruit) => [fruit.user.id, fruit.user]),
          ).values(),
        );
        setUsers(uniqueUsers);

        // Extract unique trees
        const uniqueTrees = Array.from(
          new Map(
            localFruits.data.map((fruit: Fruit) => [fruit.tree.id, fruit.tree]),
          ).values(),
        );
        setTrees(uniqueTrees);

        console.log(
          `✅ Loaded ${localFruits.data.length} fruits from local database`,
        );
      } else {
        console.log("No fruits found in local database");
        setFruits([]);
        setFilteredFruits([]);
        setUsers([]);
        setTrees([]);
      }
    } catch (error) {
      console.error("Error fetching local fruits:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateBatchSummary = () => {
    const summary = {
      batch1: 0,
      batch2: 0,
      batch3: 0,
      batch4: 0,
    };

    filteredFruits.forEach((fruit) => {
      if (fruit.tag_id === 1) summary.batch1 += fruit.quantity;
      else if (fruit.tag_id === 2) summary.batch2 += fruit.quantity;
      else if (fruit.tag_id === 3) summary.batch3 += fruit.quantity;
      else if (fruit.tag_id === 4) summary.batch4 += fruit.quantity;
    });

    setBatchSummary(summary);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFruits(); // Just re-fetch from local database
    resetFilters();
    setRefreshing(false);
  };

  const applyFilters = () => {
    let filtered = [...fruits];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (fruit) =>
          fruit.tree.description
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          `${fruit.user.first_name} ${fruit.user.last_name}`
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          fruit.tree.type.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    if (selectedUserId) {
      filtered = filtered.filter((fruit) => fruit.user.id === selectedUserId);
    }

    if (selectedTreeId) {
      filtered = filtered.filter((fruit) => fruit.tree.id === selectedTreeId);
    }

    if (selectedTagId) {
      filtered = filtered.filter((fruit) => fruit.tag_id === selectedTagId);
    }

    if (fromDate) {
      filtered = filtered.filter(
        (fruit) => fruit.bagged_at.split("T")[0] >= fromDate,
      );
    }
    if (toDate) {
      filtered = filtered.filter(
        (fruit) => fruit.bagged_at.split("T")[0] <= toDate,
      );
    }

    setFilteredFruits(filtered);
  };

  const openFilterModal = () => {
    setTempUserId(selectedUserId);
    setTempTreeId(selectedTreeId);
    setTempTagId(selectedTagId);
    setTempFromDate(fromDate);
    setTempToDate(toDate);
    setFilterModalVisible(true);
  };

  const applyFilterChanges = () => {
    setSelectedUserId(tempUserId);
    setSelectedTreeId(tempTreeId);
    setSelectedTagId(tempTagId);
    setFromDate(tempFromDate);
    setToDate(tempToDate);
    setFilterModalVisible(false);
  };

  const resetFilters = () => {
    setSelectedUserId("");
    setSelectedTreeId("");
    setSelectedTagId(null);
    setFromDate("");
    setToDate("");
    setSearchQuery("");
    setTempUserId("");
    setTempTreeId("");
    setTempTagId(null);
    setTempFromDate("");
    setTempToDate("");
    setFilterModalVisible(false);
  };

  const validateDate = (date: string) => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) return false;
    const d = new Date(date);
    return d instanceof Date && !isNaN(d.getTime());
  };

  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return "Any";
    if (!validateDate(dateString)) return dateString;
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDate = (dateString: string) => {
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

  const getBatchColor = (tagId: number) => {
    switch (tagId) {
      case 1:
        return "bg-blue-100 text-blue-700";
      case 2:
        return "bg-green-100 text-green-700";
      case 3:
        return "bg-yellow-100 text-yellow-700";
      case 4:
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getBatchLabel = (tagId: number) => {
    switch (tagId) {
      case 1:
        return "Batch 1";
      case 2:
        return "Batch 2";
      case 3:
        return "Batch 3";
      case 4:
        return "Batch 4";
      default:
        return `Batch ${tagId}`;
    }
  };

  const renderFruitCard = ({ item, index }: { item: Fruit; index: number }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => {
        setSelectedFruit(item);
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
          {/* Header with Batch Tag */}
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
            <View className="flex-row gap-2">
              {/* Batch Badge */}
              <View
                className={`rounded-full px-3 py-1 ${getBatchColor(item.tag_id)}`}
              >
                <Text className="text-xs font-bold">
                  {getBatchLabel(item.tag_id)}
                </Text>
              </View>
              {/* Quantity Badge */}
              <View className="bg-orange-500 rounded-full px-3 py-1">
                <Text className="text-white font-bold text-lg">
                  x{item.quantity}
                </Text>
              </View>
            </View>
          </View>

          {/* User Info */}
          <View className="flex-row items-center mb-2">
            <View className="w-8 h-8 bg-orange-100 rounded-full items-center justify-center">
              <Text className="text-orange-600 font-bold text-sm">
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

          {/* Flower Info */}
          <View className="flex-row items-center mb-2">
            <Ionicons name="flower" size={14} color="#f97316" />
            <Text className="text-xs text-gray-500 ml-1">
              From flower: {formatDate(item.flower.wrapped_at)}
            </Text>
          </View>

          {/* Date */}
          <View className="flex-row items-center justify-between pt-2 border-t border-gray-100">
            <View className="flex-row items-center">
              <Ionicons name="calendar-outline" size={14} color="#9ca3af" />
              <Text className="text-xs text-gray-400 ml-1">
                Bagged: {formatDate(item.bagged_at)}
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
              Filter Fruits
            </Text>
            <TouchableOpacity
              onPress={() => setFilterModalVisible(false)}
              className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center"
            >
              <Ionicons name="close" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="p-5">
            {/* Batch Filter - New Section */}
            <View className="mb-6">
              <View className="flex-row items-center mb-3">
                <View className="w-10 h-10 bg-indigo-500 rounded-xl items-center justify-center">
                  <MaterialCommunityIcons name="tag" size={20} color="white" />
                </View>
                <Text className="text-lg font-bold text-gray-800 ml-3">
                  Filter by Batch
                </Text>
              </View>
              <View className="flex-row flex-wrap gap-2">
                <TouchableOpacity
                  className={`px-4 py-2 rounded-full ${tempTagId === null ? "bg-orange-500" : "bg-gray-100"}`}
                  onPress={() => setTempTagId(null)}
                >
                  <Text
                    className={`text-sm ${tempTagId === null ? "text-white" : "text-gray-700"}`}
                  >
                    All Batches
                  </Text>
                </TouchableOpacity>
                {[1, 2, 3, 4].map((batch) => (
                  <TouchableOpacity
                    key={batch}
                    className={`px-4 py-2 rounded-full ${tempTagId === batch ? "bg-orange-500" : "bg-gray-100"}`}
                    onPress={() => setTempTagId(batch)}
                  >
                    <Text
                      className={`text-sm ${tempTagId === batch ? "text-white" : "text-gray-700"}`}
                    >
                      Batch {batch}
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
                    className={`px-4 py-2 rounded-full ${!tempUserId ? "bg-orange-500" : "bg-gray-100"}`}
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
                      className={`px-4 py-2 rounded-full ${tempUserId === user.id ? "bg-orange-500" : "bg-gray-100"}`}
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
                    className={`px-4 py-2 rounded-full ${!tempTreeId ? "bg-orange-500" : "bg-gray-100"}`}
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
                      className={`px-4 py-2 rounded-full ${tempTreeId === tree.id ? "bg-orange-500" : "bg-gray-100"}`}
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
                  Date Range (Bagged Date)
                </Text>
              </View>

              <View className="flex-row gap-4">
                {/* From Date */}
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

                {/* To Date */}
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
              {(tempUserId ||
                tempTreeId ||
                tempTagId ||
                tempFromDate ||
                tempToDate) && (
                <View className="mt-4 p-3 bg-gray-50 rounded-xl">
                  <Text className="text-xs font-semibold text-gray-500 mb-2">
                    ACTIVE FILTERS:
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {tempTagId && (
                      <View className="bg-indigo-100 px-2 py-1 rounded-full">
                        <Text className="text-xs text-indigo-700">
                          Batch {tempTagId}
                        </Text>
                      </View>
                    )}
                    {tempUserId && users.find((u) => u.id === tempUserId) && (
                      <View className="bg-orange-100 px-2 py-1 rounded-full">
                        <Text className="text-xs text-orange-700">
                          User:{" "}
                          {users.find((u) => u.id === tempUserId)?.first_name}
                        </Text>
                      </View>
                    )}
                    {tempTreeId && trees.find((t) => t.id === tempTreeId) && (
                      <View className="bg-orange-100 px-2 py-1 rounded-full">
                        <Text className="text-xs text-orange-700">
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
              className="bg-orange-500 py-3 rounded-xl"
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

  const renderFruitDetailModal = () => (
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
              Fruit Details
            </Text>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center"
            >
              <Ionicons name="close" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {selectedFruit && (
            <ScrollView showsVerticalScrollIndicator={false} className="p-5">
              {/* Batch Section - New */}
              <View className="mb-6">
                <View className="flex-row items-center mb-3">
                  <View className="w-10 h-10 bg-indigo-500 rounded-xl items-center justify-center">
                    <MaterialCommunityIcons
                      name="tag"
                      size={20}
                      color="white"
                    />
                  </View>
                  <Text className="text-lg font-bold text-gray-800 ml-3">
                    Batch Information
                  </Text>
                </View>
                <View className="bg-gray-50 rounded-xl p-4">
                  <View className="flex-row justify-between items-center">
                    <View>
                      <Text className="text-xs text-gray-500 uppercase tracking-wide">
                        Batch Number
                      </Text>
                      <Text className="text-2xl font-bold text-indigo-600">
                        {getBatchLabel(selectedFruit.tag_id)}
                      </Text>
                    </View>
                    <View
                      className={`rounded-full px-4 py-2 ${getBatchColor(selectedFruit.tag_id)}`}
                    >
                      <Text className="text-sm font-bold">
                        Batch {selectedFruit.tag_id}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Tree Section */}
              <View className="mb-6">
                <View className="flex-row items-center mb-3">
                  <View className="w-10 h-10 bg-green-500 rounded-xl items-center justify-center">
                    <Entypo name="tree" size={20} color="white" />
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
                      {selectedFruit.tree.description}
                    </Text>
                  </View>
                  <View className="mb-2">
                    <Text className="text-xs text-gray-500 uppercase tracking-wide">
                      Type
                    </Text>
                    <Text className="text-base text-gray-700">
                      {selectedFruit.tree.type}
                    </Text>
                  </View>
                  <View className="mb-2">
                    <Text className="text-xs text-gray-500 uppercase tracking-wide">
                      Status
                    </Text>
                    <View
                      className={`self-start px-2 py-0.5 rounded-full mt-1 ${getStatusColor(selectedFruit.tree.status)}`}
                    >
                      <Text className="text-xs font-medium capitalize">
                        {selectedFruit.tree.status}
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
                      {selectedFruit.user.first_name}{" "}
                      {selectedFruit.user.last_name}
                    </Text>
                  </View>
                  <View className="mb-2">
                    <Text className="text-xs text-gray-500 uppercase tracking-wide">
                      Email
                    </Text>
                    <Text className="text-base text-gray-700">
                      {selectedFruit.user.email}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-xs text-gray-500 uppercase tracking-wide">
                      Gender
                    </Text>
                    <Text className="text-base text-gray-700 capitalize">
                      {selectedFruit.user.gender}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Flower Section */}
              <View className="mb-6">
                <View className="flex-row items-center mb-3">
                  <View className="w-10 h-10 bg-pink-500 rounded-xl items-center justify-center">
                    <Ionicons name="flower" size={20} color="white" />
                  </View>
                  <Text className="text-lg font-bold text-gray-800 ml-3">
                    Flower Information
                  </Text>
                </View>
                <View className="bg-gray-50 rounded-xl p-4">
                  <View className="mb-2">
                    <Text className="text-xs text-gray-500 uppercase tracking-wide">
                      Flower Quantity
                    </Text>
                    <Text className="text-base font-semibold text-gray-800">
                      {selectedFruit.flower.quantity}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-xs text-gray-500 uppercase tracking-wide">
                      Wrapped At
                    </Text>
                    <Text className="text-sm text-gray-600 mt-1">
                      {formatDateTime(selectedFruit.flower.wrapped_at)}
                    </Text>
                  </View>
                </View>
              </View>

              {selectedFruit.image_url && (
                <View className="mb-6">
                  <View className="flex-row items-center mb-3">
                    <View className="w-10 h-10 bg-orange-500 rounded-xl items-center justify-center">
                      <Ionicons name="image" size={20} color="white" />
                    </View>
                    <Text className="text-lg font-bold text-gray-800 ml-3">
                      Fruit Image
                    </Text>
                  </View>
                  <View className="bg-gray-50 rounded-xl p-4 items-center">
                    <Image
                      source={{ uri: selectedFruit.image_url }}
                      className="w-full h-48 rounded-xl"
                      resizeMode="cover"
                      onError={(e) =>
                        console.log("Image load error:", e.nativeEvent.error)
                      }
                    />
                  </View>
                </View>
              )}

              {/* Fruit Section */}
              <View className="mb-6">
                <View className="flex-row items-center mb-3">
                  <View className="w-10 h-10 bg-orange-500 rounded-xl items-center justify-center">
                    <MaterialCommunityIcons
                      name="fruit-pear"
                      size={20}
                      color="white"
                    />
                  </View>
                  <Text className="text-lg font-bold text-gray-800 ml-3">
                    Fruit Details
                  </Text>
                </View>
                <View className="bg-gray-50 rounded-xl p-4">
                  <View className="mb-2">
                    <Text className="text-xs text-gray-500 uppercase tracking-wide">
                      Quantity
                    </Text>
                    <Text className="text-2xl font-bold text-orange-600">
                      {selectedFruit.quantity}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-xs text-gray-500 uppercase tracking-wide">
                      Bagged At
                    </Text>
                    <Text className="text-base text-gray-700">
                      {formatDateTime(selectedFruit.bagged_at)}
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          )}

          <View className="p-5 pt-0">
            <TouchableOpacity
              className="bg-orange-500 py-3 rounded-xl"
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
          <ActivityIndicator size="large" color="#f97316" />
          <Text className="text-gray-500 mt-3">Loading fruits...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

      {/* Header */}
      <View className="bg-white px-5 pt-4 pb-5 border-b border-gray-200">
        <View className="flex-row justify-between items-center mb-4">
          <View>
            <Text className="text-3xl font-bold text-gray-900">All Fruits</Text>
            <Text className="text-gray-500 text-sm mt-1">
              Track and manage all bagged fruits
            </Text>
          </View>
          <TouchableOpacity
            className="bg-gray-100 px-4 py-2 rounded-full"
            onPress={openFilterModal}
          >
            <View className="flex-row items-center">
              <Ionicons name="filter" size={18} color="#f97316" />
              <Text className="text-orange-600 ml-2 font-medium">Filter</Text>
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
        {(selectedUserId ||
          selectedTreeId ||
          selectedTagId ||
          fromDate ||
          toDate) && (
          <View className="flex-row flex-wrap gap-2 mt-3">
            {selectedTagId && (
              <View className="bg-indigo-100 px-3 py-1 rounded-full flex-row items-center">
                <Text className="text-xs text-indigo-700">
                  Batch {selectedTagId}
                </Text>
                <TouchableOpacity
                  onPress={() => setSelectedTagId(null)}
                  className="ml-2"
                >
                  <Ionicons name="close-circle" size={14} color="#6366f1" />
                </TouchableOpacity>
              </View>
            )}
            {selectedUserId && users.find((u) => u.id === selectedUserId) && (
              <View className="bg-orange-100 px-3 py-1 rounded-full flex-row items-center">
                <Text className="text-xs text-orange-700">
                  User: {users.find((u) => u.id === selectedUserId)?.first_name}
                </Text>
                <TouchableOpacity
                  onPress={() => setSelectedUserId("")}
                  className="ml-2"
                >
                  <Ionicons name="close-circle" size={14} color="#f97316" />
                </TouchableOpacity>
              </View>
            )}
            {selectedTreeId && trees.find((t) => t.id === selectedTreeId) && (
              <View className="bg-orange-100 px-3 py-1 rounded-full flex-row items-center">
                <Text className="text-xs text-orange-700">
                  Tree:{" "}
                  {trees
                    .find((t) => t.id === selectedTreeId)
                    ?.description.substring(0, 15)}
                </Text>
                <TouchableOpacity
                  onPress={() => setSelectedTreeId("")}
                  className="ml-2"
                >
                  <Ionicons name="close-circle" size={14} color="#f97316" />
                </TouchableOpacity>
              </View>
            )}
            {fromDate && (
              <View className="bg-orange-100 px-3 py-1 rounded-full flex-row items-center">
                <Text className="text-xs text-orange-700">
                  From: {formatDateForDisplay(fromDate)}
                </Text>
                <TouchableOpacity
                  onPress={() => setFromDate("")}
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
                  onPress={() => setToDate("")}
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

      {/* Batch Summary Stats */}
      <View className="bg-white px-5 py-3 border-b border-gray-100">
        <Text className="text-xs font-semibold text-gray-500 mb-2">
          BATCH SUMMARY
        </Text>
        <View className="flex-row justify-between">
          <View className="items-center">
            <View className="bg-blue-100 rounded-full w-8 h-8 items-center justify-center">
              <Text className="text-blue-700 font-bold text-xs">B1</Text>
            </View>
            <Text className="text-sm font-bold text-gray-800 mt-1">
              {batchSummary.batch1}
            </Text>
            <Text className="text-xs text-gray-400">fruits</Text>
          </View>
          <View className="items-center">
            <View className="bg-green-100 rounded-full w-8 h-8 items-center justify-center">
              <Text className="text-green-700 font-bold text-xs">B2</Text>
            </View>
            <Text className="text-sm font-bold text-gray-800 mt-1">
              {batchSummary.batch2}
            </Text>
            <Text className="text-xs text-gray-400">fruits</Text>
          </View>
          <View className="items-center">
            <View className="bg-yellow-100 rounded-full w-8 h-8 items-center justify-center">
              <Text className="text-yellow-700 font-bold text-xs">B3</Text>
            </View>
            <Text className="text-sm font-bold text-gray-800 mt-1">
              {batchSummary.batch3}
            </Text>
            <Text className="text-xs text-gray-400">fruits</Text>
          </View>
          <View className="items-center">
            <View className="bg-red-100 rounded-full w-8 h-8 items-center justify-center">
              <Text className="text-red-700 font-bold text-xs">B4</Text>
            </View>
            <Text className="text-sm font-bold text-gray-800 mt-1">
              {batchSummary.batch4}
            </Text>
            <Text className="text-xs text-gray-400">fruits</Text>
          </View>
          <View className="items-center">
            <View className="bg-orange-100 rounded-full w-8 h-8 items-center justify-center">
              <Text className="text-orange-700 font-bold text-xs">∑</Text>
            </View>
            <Text className="text-sm font-bold text-gray-800 mt-1">
              {batchSummary.batch1 +
                batchSummary.batch2 +
                batchSummary.batch3 +
                batchSummary.batch4}
            </Text>
            <Text className="text-xs text-gray-400">total</Text>
          </View>
        </View>
      </View>

      {/* Stats Bar */}
      <View className="flex-row justify-between items-center px-5 py-3 bg-white border-b border-gray-100">
        <View className="flex-row items-center">
          <MaterialCommunityIcons name="fruit-pear" size={18} color="#f97316" />
          <Text className="text-sm text-gray-600 ml-2">
            Showing{" "}
            <Text className="font-bold text-orange-600">
              {filteredFruits.length}
            </Text>{" "}
            of <Text className="font-bold">{fruits.length}</Text> fruits
          </Text>
        </View>
        {filteredFruits.length > 0 && (
          <View className="bg-orange-50 px-2 py-1 rounded-full">
            <Text className="text-xs text-orange-600">
              {((filteredFruits.length / fruits.length) * 100).toFixed(0)}%
            </Text>
          </View>
        )}
      </View>

      {/* Fruit List */}
      <FlatList
        data={filteredFruits}
        keyExtractor={(item) => item.id}
        renderItem={renderFruitCard}
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: 20,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#f97316"]}
            tintColor="#f97316"
          />
        }
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center py-20">
            <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-4">
              <Ionicons name="nutrition-outline" size={40} color="#9ca3af" />
            </View>
            <Text className="text-lg font-medium text-gray-500 mb-2">
              No fruits found
            </Text>
            <Text className="text-sm text-gray-400 text-center px-10">
              {searchQuery ||
              selectedUserId ||
              selectedTreeId ||
              selectedTagId ||
              fromDate ||
              toDate
                ? "Try adjusting your filters or search query"
                : "No fruits have been bagged yet"}
            </Text>
          </View>
        }
      />

      {renderFilterModal()}
      {renderFruitDetailModal()}
    </SafeAreaView>
  );
}
