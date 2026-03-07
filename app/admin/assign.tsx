import FruitService, { Fruit } from "@/services/FruitService";
import HarvestService from "@/services/HarvestService"; // Import HarvestService
import UserService from "@/services/UserService";
import { User as UserType } from "@/types/index";
import { router } from "expo-router";
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle,
  ChevronDown,
  Circle,
  MapPin,
  Package,
  User,
  Users,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AssignHarvestScreen() {
  const [fruits, setFruits] = useState<Fruit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFruits, setSelectedFruits] = useState<Set<string>>(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [users, setUsers] = useState<UserType[]>([]);
  const [selectedHarvester, setSelectedHarvester] = useState<UserType | null>(
    null,
  );
  const [assigning, setAssigning] = useState(false);
  const [userDropdownVisible, setUserDropdownVisible] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    await Promise.all([fetchUnassignedFruits(), fetchUsers()]);
  };

  const fetchUnassignedFruits = async () => {
    setLoading(true);
    try {
      // Use your existing getFruitsWithoutHarvest method
      const unassignedFruits =
        await FruitService.getFruitsWithoutHarvest(false);
      setFruits(unassignedFruits);
    } catch (error) {
      console.error("Error fetching unassigned fruits:", error);
      Alert.alert("Error", "Failed to fetch unassigned fruits");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const fetchedUsers = await UserService.getUsers();
      // Filter only users with appropriate role (adjust based on your role system)
      const harvesters = fetchedUsers.filter(
        (user) =>
          user.role === "harvester" ||
          user.role === "worker" ||
          user.role === "user",
      );
      setUsers(harvesters);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setSelectedFruits(new Set()); // Clear selections on refresh
    setSelectedHarvester(null); // Clear selected harvester
    try {
      await Promise.all([fetchUnassignedFruits(), fetchUsers()]);
    } catch (error) {
      console.error("Error refreshing data:", error);
      Alert.alert("Error", "Failed to refresh data");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const toggleFruitSelection = (fruitId: string) => {
    const newSelection = new Set(selectedFruits);
    if (newSelection.has(fruitId)) {
      newSelection.delete(fruitId);
    } else {
      newSelection.add(fruitId);
    }
    setSelectedFruits(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedFruits.size === fruits.length) {
      setSelectedFruits(new Set());
    } else {
      setSelectedFruits(new Set(fruits.map((f) => f.id)));
    }
  };

  const handleAssignPress = () => {
    if (selectedFruits.size === 0) {
      Alert.alert("No Selection", "Please select at least one fruit to assign");
      return;
    }
    setModalVisible(true);
  };

  const handleAssign = async () => {
    if (!selectedHarvester) {
      Alert.alert("No Harvester", "Please select a harvester to assign");
      return;
    }

    setAssigning(true);
    try {
      const fruitIds = Array.from(selectedFruits);

      // Call the HarvestService to create harvest assignments
      const result = await HarvestService.createHarvestAssignments(
        fruitIds,
        selectedHarvester.id,
      );

      if (result.success) {
        // Show success message with details
        const message =
          result.errors.length > 0
            ? `Successfully assigned ${result.createdCount} fruit(s) to ${selectedHarvester.first_name} ${selectedHarvester.last_name}.\n\nEncountered ${result.errors.length} error(s).`
            : `Successfully assigned ${result.createdCount} fruit(s) to ${selectedHarvester.first_name} ${selectedHarvester.last_name}.`;

        Alert.alert(
          result.errors.length > 0 ? "Partial Success" : "Success",
          message,
          [
            {
              text: "OK",
              onPress: () => {
                setModalVisible(false);
                setSelectedFruits(new Set());
                setSelectedHarvester(null);
                setUserDropdownVisible(false);
                fetchUnassignedFruits(); // Refresh the list
              },
            },
          ],
        );

        // Log errors for debugging
        if (result.errors.length > 0) {
          console.warn("Assignment errors:", result.errors);
        }
      } else {
        // Show error message
        Alert.alert(
          "Assignment Failed",
          `Failed to assign fruits. ${result.errors.join("\n")}`,
        );
      }
    } catch (error: any) {
      console.error("Error assigning harvesters:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to assign harvesters. Please try again.",
      );
    } finally {
      setAssigning(false);
    }
  };

  const renderFruitCard = ({ item }: { item: Fruit }) => (
    <TouchableOpacity
      onPress={() => toggleFruitSelection(item.id)}
      className="bg-white rounded-xl p-4 mb-3 border border-gray-200 flex-row items-center"
    >
      <View className="mr-3">
        {selectedFruits.has(item.id) ? (
          <CheckCircle size={24} color="#F97316" />
        ) : (
          <Circle size={24} color="#D1D5DB" />
        )}
      </View>

      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-bold text-gray-900">
            {item.treeName || `Fruit #${item.id.substring(0, 8)}`}
          </Text>
          <View className="bg-orange-100 px-3 py-1 rounded-full">
            <Text className="text-xs text-orange-700 font-medium">
              Unassigned
            </Text>
          </View>
        </View>

        <View className="flex-row mt-2 space-x-4">
          <View className="flex-row items-center mr-4">
            <Calendar size={14} color="#6B7280" />
            <Text className="text-xs text-gray-600 ml-1">
              Bagged:{" "}
              {item.bagged_at
                ? new Date(item.bagged_at).toLocaleDateString()
                : item.created_at
                  ? new Date(item.created_at).toLocaleDateString()
                  : "N/A"}
            </Text>
          </View>

          {item.location && (
            <View className="flex-row items-center">
              <MapPin size={14} color="#6B7280" />
              <Text className="text-xs text-gray-600 ml-1">
                {item.location}
              </Text>
            </View>
          )}
        </View>

        {item.estimated_weight && (
          <Text className="text-sm text-gray-700 mt-2">
            Est. Weight: {item.estimated_weight} kg
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

      {/* Header */}
      <View className="bg-white px-4 py-4 border-b border-gray-200">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="mr-3">
              <ArrowLeft size={24} color="#374151" />
            </TouchableOpacity>
            <View>
              <Text className="text-2xl font-bold text-gray-900">
                Assign Harvesters
              </Text>
              <Text className="text-sm text-gray-600">
                Select bagged fruits to assign
              </Text>
            </View>
          </View>

          <View className="bg-orange-100 px-3 py-2 rounded-full">
            <Text className="text-orange-700 font-medium">
              {selectedFruits.size} selected
            </Text>
          </View>
        </View>
      </View>

      {/* Main Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#F97316" />
          <Text className="text-gray-600 mt-3">Loading bagged fruits...</Text>
        </View>
      ) : (
        <FlatList
          data={fruits}
          renderItem={renderFruitCard}
          keyExtractor={(item) => item.id}
          contentContainerClassName="p-4 pb-24"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#F97316"]}
              tintColor="#F97316"
            />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-16 px-6">
              <View className="w-24 h-24 bg-orange-50 rounded-full items-center justify-center mb-4">
                <Package size={48} color="#F97316" />
              </View>
              <Text className="text-2xl font-bold text-gray-900 text-center mb-2">
                No Unassigned Fruits
              </Text>
              <Text className="text-gray-600 text-center mb-6">
                All bagged fruits have been assigned to harvesters
              </Text>
              <TouchableOpacity
                onPress={() => router.back()}
                className="bg-orange-600 px-6 py-3 rounded-xl"
              >
                <Text className="text-white font-medium">Go Back</Text>
              </TouchableOpacity>
            </View>
          }
          ListHeaderComponent={
            fruits.length > 0 ? (
              <View className="bg-white px-4 py-3 mb-3 rounded-xl border border-gray-200 flex-row justify-between items-center">
                <TouchableOpacity
                  onPress={toggleSelectAll}
                  className="flex-row items-center"
                >
                  {selectedFruits.size === fruits.length ? (
                    <CheckCircle size={20} color="#F97316" />
                  ) : (
                    <Circle size={20} color="#D1D5DB" />
                  )}
                  <Text className="ml-2 text-gray-700 font-medium">
                    {selectedFruits.size === fruits.length
                      ? "Deselect All"
                      : "Select All"}
                  </Text>
                </TouchableOpacity>

                <Text className="text-gray-500">
                  {fruits.length} total fruit{fruits.length !== 1 ? "s" : ""}
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Bottom Action Bar */}
      {selectedFruits.size > 0 && (
        <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 shadow-lg">
          <TouchableOpacity
            onPress={handleAssignPress}
            className="bg-orange-600 rounded-xl py-4 flex-row items-center justify-center"
          >
            <Users size={20} color="#FFFFFF" />
            <Text className="text-white font-bold text-lg ml-2">
              Assign to Harvester ({selectedFruits.size})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Assignment Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6">
            {/* Modal Header */}
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-gray-900">
                Assign Harvester
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Selected Fruits Summary */}
            <View className="bg-orange-50 rounded-xl p-4 mb-6">
              <Text className="text-orange-700 font-medium mb-2">
                Selected Fruits: {selectedFruits.size}
              </Text>
              <Text className="text-gray-600 text-sm" numberOfLines={2}>
                {Array.from(selectedFruits)
                  .slice(0, 3)
                  .map((id) => {
                    const fruit = fruits.find((f) => f.id === id);
                    return fruit?.treeName || `Fruit #${id.substring(0, 6)}`;
                  })
                  .join(", ")}
                {selectedFruits.size > 3 &&
                  `, and ${selectedFruits.size - 3} more`}
              </Text>
            </View>

            {/* Harvester Selection */}
            <Text className="text-lg font-semibold text-gray-900 mb-3">
              Select Harvester
            </Text>

            <TouchableOpacity
              onPress={() => setUserDropdownVisible(!userDropdownVisible)}
              className="border border-gray-300 rounded-xl p-4 flex-row justify-between items-center mb-2"
            >
              <View className="flex-row items-center">
                <User size={20} color="#6B7280" />
                <Text className="ml-2 text-gray-700">
                  {selectedHarvester
                    ? `${selectedHarvester.first_name} ${selectedHarvester.last_name}`
                    : "Choose a harvester"}
                </Text>
              </View>
              <ChevronDown size={20} color="#6B7280" />
            </TouchableOpacity>

            {/* User Dropdown */}
            {userDropdownVisible && (
              <View className="border border-gray-200 rounded-xl max-h-60 mb-4">
                <FlatList
                  data={users}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedHarvester(item);
                        setUserDropdownVisible(false);
                      }}
                      className="p-4 border-b border-gray-100 flex-row items-center"
                    >
                      <View className="w-10 h-10 bg-orange-100 rounded-full items-center justify-center mr-3">
                        <User size={20} color="#F97316" />
                      </View>
                      <View className="flex-1">
                        <Text className="font-medium text-gray-900">
                          {item.first_name} {item.last_name}
                        </Text>
                        <Text className="text-sm text-gray-500">
                          {item.email}
                        </Text>
                      </View>
                      {selectedHarvester?.id === item.id && (
                        <Check size={20} color="#F97316" />
                      )}
                    </TouchableOpacity>
                  )}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View className="p-8 items-center">
                      <Text className="text-gray-500">No harvesters found</Text>
                    </View>
                  }
                />
              </View>
            )}

            {/* Action Buttons */}
            <View className="flex-row space-x-3 mt-4">
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  setUserDropdownVisible(false);
                }}
                className="flex-1 border border-gray-300 rounded-xl py-4 items-center"
              >
                <Text className="text-gray-700 font-medium">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleAssign}
                disabled={!selectedHarvester || assigning}
                className={`flex-1 rounded-xl py-4 items-center ${
                  !selectedHarvester || assigning
                    ? "bg-orange-300"
                    : "bg-orange-600"
                }`}
              >
                {assigning ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-white font-medium">Assign</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
