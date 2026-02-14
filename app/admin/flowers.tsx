import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  RefreshControl,
} from "react-native";
import FlowerService from "@/services/FlowerService";
import NetInfo from "@react-native-community/netinfo";
import Toast from "react-native-toast-message";
import { Flower } from "@/types/index";
import {
  Flower as FlowerIcon,
  Trees as TreeIcon,
  Wifi,
  WifiOff,
  RefreshCw,
  Camera,
  X,
  Calendar,
  Package,
  MapPin,
} from "lucide-react-native";
import FlowerCamera from "@/components/FlowerCamera";
import * as FileSystem from "expo-file-system/legacy";
import { useLocalSearchParams, useRouter } from "expo-router";
// Create directory for flower images
const FLOWER_IMAGES_DIR = FileSystem.documentDirectory + "flower_images/";

const ensureImagesDirExists = async () => {
  const dirInfo = await FileSystem.getInfoAsync(FLOWER_IMAGES_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(FLOWER_IMAGES_DIR, {
      intermediates: true,
    });
  }
};

export default function FlowersScreen() {
  const [flowers, setFlowers] = useState<Flower[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const router = useRouter();

  // Get tree data from params
  const params = useLocalSearchParams();
  const treeData = params.treeData
    ? JSON.parse(params.treeData as string)
    : null;
  const selectedTreeId = treeData.id || null;
  const treeId = treeData?.id || null;

  // For CRUD operations
  const [modalVisible, setModalVisible] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [editingFlower, setEditingFlower] = useState<Flower | null>(null);
  const [formData, setFormData] = useState({
    tree_id: selectedTreeId || "", // Pre-fill with selected tree ID
    quantity: "1",
    wrapped_at: new Date().toISOString().split("T")[0], // Default to today
    image_url: "",
  });
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    synced: 0,
    unsynced: 0,
    deleted: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    initApp();
    ensureImagesDirExists();

    // Listen to network changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected ?? false;
      setIsOnline(online);

      // Auto-sync when coming online
      if (online) {
        autoSync();
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (treeId && treeId !== formData.tree_id) {
      setFormData((prev) => ({
        ...prev,
        tree_id: treeId,
      }));
    }
  }, [treeId]);

  const initApp = async () => {
    try {
      setLoading(true);
      await FlowerService.init();
      await loadFlowers(treeData.id);
      await loadStats();
    } catch (error) {
      console.error("Init error:", error);
      Toast.show({
        type: "error",
        text1: "Initialization Error",
        text2: "Failed to initialize database. Please restart the app.",
      });
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Refresh flowers and stats
      if (selectedTreeId) {
        await loadFlowers(selectedTreeId);
      } else {
        await loadFlowers();
      }
      await loadStats();

      // If online, also sync
      if (isOnline) {
        await autoSync();
      }
    } catch (error) {
      console.error("Refresh error:", error);
      Toast.show({
        type: "error",
        text1: "Refresh Failed",
        text2: "Failed to refresh data",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const loadFlowers = async (treeId?: string) => {
    try {
      let data;
      data = await FlowerService.getFlowersByTreeId(treeId, false);
      setFlowers(data);
    } catch (error) {
      console.error("Load flowers error:", error);
      Toast.show({
        type: "error",
        text1: "Load Failed",
        text2: "Failed to load flowers from database",
      });
    }
  };

  const loadStats = async () => {
    try {
      const databaseStats = await FlowerService.getStats();
      setStats(databaseStats);
    } catch (error) {
      console.error("Load stats error:", error);
    }
  };

  const handleTakePhoto = () => {
    // Reset form and open camera
    resetForm();
    setCameraVisible(true);
  };

  const handlePhotoCaptured = async (photoUri: string) => {
    try {
      // Generate unique filename
      const timestamp = Date.now();
      const filename = `flower_${timestamp}.jpg`;
      const newPath = FLOWER_IMAGES_DIR + filename;

      // Copy image to our app directory
      await FileSystem.copyAsync({
        from: photoUri,
        to: newPath,
      });

      // Set form data with the selected tree ID
      setFormData({
        ...formData,
        image_url: newPath,
        tree_id: selectedTreeId || "", // Ensure tree_id is set
      });

      setPreviewImage(newPath);
      setCameraVisible(false);

      // Show the modal to enter remaining details
      setModalVisible(true);

      Toast.show({
        type: "success",
        text1: "Photo Captured",
        text2: "Flower photo saved. Enter details.",
      });
    } catch (error) {
      console.error("Error handling photo:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to save photo",
      });
    }
  };

  const handleCreate = async () => {
    if (creating) return;

    if (!formData.tree_id.trim()) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Tree is required",
      });
      return;
    }

    if (!formData.wrapped_at.trim()) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Please select wrapping date",
      });
      return;
    }

    const quantity = parseInt(formData.quantity);
    if (isNaN(quantity) || quantity < 1) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Please enter a valid quantity (minimum 1)",
      });
      return;
    }

    try {
      setCreating(true);
      const flowerData = {
        tree_id: formData.tree_id,
        quantity: quantity,
        wrapped_at: new Date(formData.wrapped_at),
        image_url: formData.image_url || "",
      };

      console.log("Creating flower with data:", flowerData);
      await FlowerService.createFlower(flowerData);

      Toast.show({
        type: "success",
        text1: "Flower Created",
        text2: isOnline ? "Synced to server" : "Saved locally (offline)",
      });

      // Reload flowers for the current tree
      if (selectedTreeId) {
        await loadFlowers(selectedTreeId);
      } else {
        await loadFlowers();
      }

      await loadStats();
      resetForm();
      setModalVisible(false);
      setPreviewImage(null);
    } catch (error) {
      console.error("Create error:", error);

      Toast.show({
        type: "error",
        text1: "Create Failed",
        text2: "Failed to create flower",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = (flower: Flower) => {
    setEditingFlower(flower);
    setFormData({
      tree_id: flower.tree_id,
      quantity: flower.quantity.toString(),
      wrapped_at: flower.wrapped_at.toISOString().split("T")[0],
      image_url: flower.image_url || "",
    });
    setPreviewImage(flower.image_url || null);
    setModalVisible(true);
  };

  const handleUpdate = async () => {
    if (updating || !editingFlower) return;

    const quantity = parseInt(formData.quantity);
    if (isNaN(quantity) || quantity < 1) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Please enter a valid quantity (minimum 1)",
      });
      return;
    }

    try {
      setUpdating(true);
      const updates = {
        tree_id: formData.tree_id,
        quantity: quantity,
        wrapped_at: new Date(formData.wrapped_at),
        image_url: formData.image_url || "",
      };

      const result = await FlowerService.updateFlower(
        editingFlower.id,
        updates,
      );
      if (!result) {
        throw new Error("Update failed");
      }

      Toast.show({
        type: "success",
        text1: "Flower Updated",
        text2: isOnline ? "Synced to server" : "Updated locally (offline)",
      });

      if (selectedTreeId) {
        await loadFlowers(selectedTreeId);
      }

      await loadStats();
      resetForm();
      setModalVisible(false);
      setPreviewImage(null);
    } catch (error) {
      console.error("Update error:", error);
      Toast.show({
        type: "error",
        text1: "Update Failed",
        text2: "Failed to update flower",
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      "Delete Flower",
      "Are you sure you want to delete this flower?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await FlowerService.deleteFlower(id);

              Toast.show({
                type: "success",
                text1: "Flower Deleted",
                text2: isOnline ? "Synced to server" : "Deleted locally",
              });

              if (selectedTreeId) {
                await loadFlowers(selectedTreeId);
              } else {
                await loadFlowers();
              }

              await loadStats();
            } catch (error) {
              console.error("Delete error:", error);
              Toast.show({
                type: "error",
                text1: "Delete Failed",
                text2: "Failed to delete flower",
              });
            }
          },
        },
      ],
    );
  };

  const handleHardDelete = async (id: string) => {
    Alert.alert(
      "Permanently Delete",
      "This will permanently remove the flower. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Permanently",
          style: "destructive",
          onPress: async () => {
            try {
              await FlowerService.hardDeleteFlower(id);

              Toast.show({
                type: "success",
                text1: "Flower Deleted",
                text2: "Permanently removed",
              });

              if (selectedTreeId) {
                await loadFlowers(selectedTreeId);
              } else {
                await loadFlowers();
              }

              await loadStats();
            } catch (error) {
              console.error("Hard delete error:", error);
              Toast.show({
                type: "error",
                text1: "Delete Failed",
                text2: "Failed to delete flower",
              });
            }
          },
        },
      ],
    );
  };

  const handleRestore = async (id: string) => {
    try {
      await FlowerService.restoreFlower(id);

      Toast.show({
        type: "success",
        text1: "Flower Restored",
        text2: "Flower has been restored",
      });

      if (selectedTreeId) {
        await loadFlowers(selectedTreeId);
      } else {
        await loadFlowers();
      }

      await loadStats();
    } catch (error) {
      console.error("Restore error:", error);
      Toast.show({
        type: "error",
        text1: "Restore Failed",
        text2: "Failed to restore flower",
      });
    }
  };

  const resetForm = () => {
    setEditingFlower(null);
    setFormData({
      tree_id: selectedTreeId || "", // Reset to selected tree ID
      quantity: "1",
      wrapped_at: new Date().toISOString().split("T")[0],
      image_url: "",
    });
    setPreviewImage(null);
  };

  const manualSync = async () => {
    if (!isOnline) {
      Toast.show({
        type: "info",
        text1: "Offline Mode",
        text2: "Cannot sync while offline",
      });
      return;
    }

    setSyncing(true);
    try {
      await FlowerService.syncAll();

      if (selectedTreeId) {
        await loadFlowers(selectedTreeId);
      } else {
        await loadFlowers();
      }

      await loadStats();

      Toast.show({
        type: "success",
        text1: "Sync Complete",
        text2: "All flowers synchronized",
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Sync Failed",
        text2: "Failed to sync flowers",
      });
    } finally {
      setSyncing(false);
    }
  };

  const autoSync = async () => {
    try {
      console.log("Auto-sync triggered");
      Toast.show({
        type: "info",
        text1: "Auto-syncing...",
        text2: "Syncing with your changes, please wait...",
        visibilityTime: 5000,
      });
      await FlowerService.syncAll();

      if (selectedTreeId) {
        await loadFlowers(selectedTreeId);
      }

      await loadStats();
      Toast.show({
        type: "success",
        text1: "Auto-sync Complete",
        text2: "All flowers synchronized",
        visibilityTime: 5000,
      });
    } catch (error) {
      console.error("Auto-sync error:", error);
      Toast.show({
        type: "error",
        text1: "Auto-sync Failed",
        text2: "Failed to sync flowers",
      });
    }
  };

  // Clear database (for testing/debugging)
  const handleClearDatabase = async () => {
    Alert.alert(
      "Clear Database",
      "Warning: This will delete ALL flowers. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            try {
              await FlowerService.clearDatabase();
              await loadFlowers();
              await loadStats();

              Toast.show({
                type: "success",
                text1: "Database Cleared",
                text2: "All flowers have been removed",
              });
            } catch (error) {
              Toast.show({
                type: "error",
                text1: "Clear Failed",
                text2: "Failed to clear database",
              });
            }
          },
        },
      ],
    );
  };

  const renderFlowerItem = ({ item }: { item: Flower }) => {
    const hasLocalImage = item.image_url;
    const flowerShortId = item.id.substring(0, 6).toUpperCase(); // Get first 6 chars of ID

    return (
      <TouchableOpacity
        onPress={() => {
          console.log("Clicked item:", item);
          router.push({
            pathname: "/admin/fruits",
            params: { flowerData: JSON.stringify(item) },
          });
        }}
        activeOpacity={0.7}
      >
        <View className="bg-white p-4 rounded-xl mb-3 shadow-sm border border-gray-100">
          <View className="flex-row">
            {/* Image Preview */}
            {hasLocalImage ? (
              <View className="mr-4">
                <Image
                  source={{ uri: item.image_url }}
                  className="w-20 h-20 rounded-lg"
                  resizeMode="cover"
                />
              </View>
            ) : (
              <View className="mr-4 w-20 h-20 bg-gray-100 rounded-lg items-center justify-center">
                <FlowerIcon size={24} color="#9ca3af" />
              </View>
            )}

            <View className="flex-1">
              {/* Flower ID Badge */}
              <View className="flex-row items-center mb-1">
                <View className="bg-purple-100 px-2 py-0.5 rounded-full">
                  <Text className="text-xs font-mono text-purple-700">
                    FLOWER-{flowerShortId}
                  </Text>
                </View>
              </View>

              {/* Show tree name if available from treeData */}
              {treeData && (
                <View className="flex-row items-center mb-1">
                  <TreeIcon size={14} color="#059669" />
                  <Text
                    className="text-sm text-gray-600 ml-1 flex-1"
                    numberOfLines={1}
                  >
                    {treeData.type} - {treeData.description}
                  </Text>
                </View>
              )}

              {/* Date and Quantity - Now with better spacing */}
              <View className="flex-row items-center mb-1">
                <Calendar size={14} color="#6b7280" />
                <Text className="text-sm text-gray-600 ml-1">
                  {item.wrapped_at.toLocaleDateString()}
                </Text>
              </View>

              {/* Quantity moved to separate line for better visibility */}
              <View className="flex-row items-center mb-2">
                <Package size={14} color="#6b7280" />
                <Text className="text-sm text-gray-600 ml-1 font-semibold">
                  {item.quantity} flower{item.quantity !== 1 ? "s" : ""}
                </Text>
              </View>

              {/* Status indicators */}
              <View className="flex-row items-center justify-between mt-1">
                <View className="flex-row items-center">
                  <View
                    className={`w-2 h-2 rounded-full mr-2 ${item.is_synced ? "bg-green-500" : "bg-yellow-500"}`}
                  />
                  <Text className="text-xs text-gray-500">
                    {item.is_synced ? "Synced" : "Pending Sync"}
                  </Text>
                </View>

                {item.deleted_at ? (
                  <View className="px-2 py-1 bg-red-100 rounded-full">
                    <Text className="text-xs text-red-700">Deleted</Text>
                  </View>
                ) : (
                  <Text className="text-xs text-gray-400">
                    {item.created_at
                      ? new Date(item.created_at).toLocaleDateString()
                      : "No date"}
                  </Text>
                )}
              </View>
            </View>

            {/* Action Buttons - Moved to bottom right with better layout */}
            <View className="absolute bottom-2 right-2 flex-row">
              {item.deleted_at ? (
                <>
                  <TouchableOpacity
                    className="p-2 bg-green-50 rounded-lg mr-2"
                    onPress={() => handleRestore(item.id)}
                  >
                    <Text className="text-xs text-green-600 font-medium">
                      Restore
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="p-2 bg-red-50 rounded-lg"
                    onPress={() => handleHardDelete(item.id)}
                  >
                    <Text className="text-xs text-red-600 font-medium">
                      Delete
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    className="p-2 bg-blue-50 rounded-lg mr-2"
                    onPress={() => handleEdit(item)}
                  >
                    <Text className="text-xs text-blue-600 font-medium">
                      Edit
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="p-2 bg-red-50 rounded-lg"
                    onPress={() => handleDelete(item.id)}
                  >
                    <Text className="text-xs text-red-600 font-medium">
                      Delete
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#059669" />
        <Text className="mt-4 text-gray-600">Loading...</Text>
      </View>
    );
  }

  return (
    <>
      <View className="flex-1 bg-gray-50">
        {/* Header */}
        <View className="bg-white pt-12 pb-4 px-4 shadow-sm border-b border-gray-200">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-2xl font-bold text-gray-800">
              {treeData.description} Flowers
            </Text>

            <View className="flex-row items-center">
              {isOnline ? (
                <Wifi size={20} color="#059669" />
              ) : (
                <WifiOff size={20} color="#6b7280" />
              )}
              <Text
                className={`ml-2 ${isOnline ? "text-green-600" : "text-gray-500"}`}
              >
                {isOnline ? "Online" : "Offline"}
              </Text>
            </View>
          </View>

          {/* Tree Info Card */}
          {treeData && (
            <View className="bg-blue-50 rounded-xl p-3 mb-4">
              <View className="flex-row items-center">
                <View className="mr-3">
                  <TreeIcon size={24} color="#3b82f6" />
                </View>
                <View className="flex-1">
                  <Text className="text-blue-700 font-medium">
                    {treeData.type} - {treeData.description}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Stats Overview */}
          <View className="bg-gray-50 rounded-xl p-3 mb-4">
            <View className="flex-row justify-between">
              <View className="items-center">
                <Text className="text-2xl font-bold text-gray-800">
                  {stats.total}
                </Text>
                <Text className="text-xs text-gray-500">Total</Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-yellow-600">
                  {stats.unsynced}
                </Text>
                <Text className="text-xs text-gray-500">Pending</Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-blue-600">
                  {stats.synced}
                </Text>
                <Text className="text-xs text-gray-500">Synced</Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-red-600">
                  {stats.deleted}
                </Text>
                <Text className="text-xs text-gray-500">Deleted</Text>
              </View>
            </View>
          </View>

          <View className="flex-row">
            <TouchableOpacity
              className="flex-1 bg-purple-600 py-3 rounded-xl flex-row items-center justify-center"
              onPress={handleTakePhoto}
            >
              <Camera size={20} color="white" />
              <Text className="text-white font-semibold ml-2">
                Take Flower Photo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`ml-3 px-4 py-3 rounded-xl flex-row items-center ${isOnline && !syncing ? "bg-blue-600" : "bg-gray-300"}`}
              onPress={manualSync}
              disabled={!isOnline || syncing}
            >
              <RefreshCw
                size={20}
                color={isOnline && !syncing ? "white" : "#9ca3af"}
                className={syncing ? "animate-spin" : ""}
              />
              <Text
                className={`ml-2 font-medium ${isOnline && !syncing ? "text-white" : "text-gray-400"}`}
              >
                {syncing ? "Syncing..." : "Sync"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Debug button - remove in production */}
          {__DEV__ && (
            <TouchableOpacity
              className="mt-3 bg-red-100 py-2 rounded-xl"
              onPress={handleClearDatabase}
            >
              <Text className="text-red-600 text-center font-medium">
                [DEV] Clear Database
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Flower List */}
        <FlatList
          data={flowers}
          renderItem={renderFlowerItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#059669"]}
              tintColor="#059669"
              title="Pull to refresh"
              titleColor="#6b7280"
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20 px-4">
              <View className="bg-gray-100 p-6 rounded-full mb-4">
                <FlowerIcon size={48} color="#9ca3af" />
              </View>
              <Text className="text-xl font-medium text-gray-700 mb-2">
                No Flowers Yet
              </Text>
              <Text className="text-gray-500 text-center mb-6">
                {treeData
                  ? `No flowers for ${treeData.type} tree yet`
                  : "Take a photo of your flowers to get started"}
              </Text>
              <TouchableOpacity
                className="bg-purple-600 px-6 py-3 rounded-xl"
                onPress={handleTakePhoto}
              >
                <Text className="text-white font-semibold">
                  Take First Photo
                </Text>
              </TouchableOpacity>
            </View>
          }
          ListHeaderComponent={
            flowers.length > 0 ? (
              <View className="mb-4">
                <Text className="text-gray-600">
                  Showing {flowers.length} flower
                  {flowers.length !== 1 ? "s" : ""}
                  {treeData && ` for ${treeData.type} tree`}
                  {stats.unsynced > 0 && (
                    <Text className="text-yellow-600">
                      {" "}
                      ({stats.unsynced} pending sync)
                    </Text>
                  )}
                </Text>
              </View>
            ) : null
          }
        />

        {/* Camera Modal */}
        <Modal
          animationType="slide"
          transparent={false}
          visible={cameraVisible}
          onRequestClose={() => setCameraVisible(false)}
        >
          <FlowerCamera
            onPhotoCaptured={handlePhotoCaptured}
            onClose={() => setCameraVisible(false)}
          />
        </Modal>

        {/* Flower Details Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => {
            setModalVisible(false);
            resetForm();
          }}
        >
          <View className="flex-1 justify-end">
            <View className="bg-white rounded-t-3xl pt-6 pb-8 px-6 max-h-[90%]">
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-2xl font-bold text-gray-800">
                  {editingFlower ? "Edit Flower" : "Add Flower Details"}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setModalVisible(false);
                    resetForm();
                  }}
                  className="p-2"
                >
                  <X size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Image Preview */}
                {previewImage && (
                  <View className="mb-4">
                    <Text className="text-gray-700 font-medium mb-2">
                      Flower Photo
                    </Text>
                    <Image
                      source={{ uri: previewImage }}
                      className="w-full h-64 rounded-xl"
                      resizeMode="cover"
                    />
                  </View>
                )}

                {/* Tree Info (read-only) */}
                {treeData && (
                  <View className="mb-4">
                    <Text className="text-gray-700 font-medium mb-2">Tree</Text>
                    <View className="border border-gray-300 rounded-xl px-4 py-3 bg-gray-50">
                      <Text className="text-gray-800">
                        {treeData.type} - {treeData.description}
                      </Text>
                    </View>
                  </View>
                )}

                <View className="mb-4">
                  <Text className="text-gray-700 font-medium mb-2">
                    Quantity *
                  </Text>
                  <TextInput
                    className="border border-gray-300 rounded-xl px-4 py-3 bg-gray-50"
                    placeholder="Number of flowers"
                    value={formData.quantity}
                    onChangeText={(text) =>
                      setFormData({ ...formData, quantity: text })
                    }
                    keyboardType="numeric"
                  />
                </View>

                <View className="mb-6">
                  <Text className="text-gray-700 font-medium mb-2">
                    Wrapping Date *
                  </Text>
                  <View className="border border-gray-300 rounded-xl px-4 py-3 bg-gray-50">
                    <TextInput
                      value={formData.wrapped_at}
                      onChangeText={(text) =>
                        setFormData({ ...formData, wrapped_at: text })
                      }
                      placeholder="YYYY-MM-DD"
                    />
                    <Text className="text-xs text-gray-500 mt-1">
                      Date when the flowers were wrapped
                    </Text>
                  </View>
                </View>

                <View className="flex-row mt-4">
                  <TouchableOpacity
                    className="flex-1 bg-gray-200 py-4 rounded-xl mr-3"
                    onPress={() => {
                      setModalVisible(false);
                      resetForm();
                    }}
                    disabled={creating || updating}
                  >
                    <Text className="text-center font-semibold text-gray-700">
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 bg-purple-600 py-4 rounded-xl"
                    disabled={creating || updating}
                    onPress={editingFlower ? handleUpdate : handleCreate}
                  >
                    {creating || updating ? (
                      <>
                        <ActivityIndicator size="small" color="white" />
                        <Text className="text-center font-semibold text-white ml-2">
                          {updating ? "Updating..." : "Saving..."}
                        </Text>
                      </>
                    ) : (
                      <Text className="text-center font-semibold text-white">
                        {editingFlower ? "Update" : "Save"}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
        <Toast />
      </View>
    </>
  );
}
