import FlowerCamera from "@/components/FlowerCamera";
import FlowerService from "@/services/FlowerService";
import FruitService from "@/services/FruitService";
import treeService from "@/services/treeService";
import { Flower } from "@/types/index";
import NetInfo from "@react-native-community/netinfo";
import * as FileSystem from "expo-file-system/legacy";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Calendar,
  Flower as FlowerIcon,
  Package,
  Plus,
  RefreshCw,
  Trees as TreeIcon,
  Wifi,
  WifiOff,
  X,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import Toast from "react-native-toast-message";
import { useSelector } from "react-redux";

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

  const params = useLocalSearchParams();
  const treeId = (() => {
    // Old format: params.treeData is JSON string
    if (params.treeData) {
      try {
        const parsed = JSON.parse(params.treeData as string);
        return parsed.id || parsed._id;
      } catch (e) {
        return params.treeData;
      }
    }
    // New format: direct treeId param
    return params.treeId || params.id;
  })();

  const [modalVisible, setModalVisible] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [editingFlower, setEditingFlower] = useState<Flower | null>(null);
  const [formData, setFormData] = useState({
    tree_id: treeId || "",
    quantity: "1",
    wrapped_at: new Date().toISOString().split("T")[0],
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
  const user = useSelector((state: any) => state.auth.user);
  const [treeDetails, setTreeDetails] = useState<any>(null);

  useEffect(() => {
    const loadTreeDetails = async () => {
      if (treeId) {
        try {
          await treeService.init();
          const tree = await treeService.getTreeById(treeId as string);
          setTreeDetails(tree);
        } catch (error) {
          console.error("Error loading tree details:", error);
        }
      }
    };
    loadTreeDetails();
  }, [treeId]);

  useEffect(() => {
    initApp();
    ensureImagesDirExists();

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected ?? false;
      setIsOnline(online);
      if (online) autoSync();
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (treeId && treeId !== formData.tree_id) {
      setFormData((prev) => ({ ...prev, tree_id: treeId }));
    }
  }, [treeId]);

  const initApp = async () => {
    try {
      setLoading(true);
      await FlowerService.init();
      await loadFlowers(treeId);
      await loadStats();
    } catch (error) {
      console.error("Init error:", error);
      Toast.show({
        type: "error",
        text1: "Initialization Error",
        text2: "Failed to initialize database",
      });
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (treeId) await loadFlowers(treeId);
      else await loadFlowers();
      await loadStats();
      if (isOnline) await autoSync();
    } catch (error) {
      console.error("Refresh error:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const loadFlowers = async (treeId?: string) => {
    try {
      const data = await FlowerService.getFlowersByTreeId(treeId, false);
      setFlowers(data);
    } catch (error) {
      console.error("Load flowers error:", error);
      Toast.show({
        type: "error",
        text1: "Load Failed",
        text2: "Failed to load flowers",
      });
    }
  };

  const loadStats = async () => {
    try {
      const databaseStats = await FlowerService.getStats(treeId);
      setStats(databaseStats);
    } catch (error) {
      console.error("Load stats error:", error);
    }
  };

  const handleTakePhoto = () => {
    resetForm();
    setCameraVisible(true);
  };

  const handlePhotoCaptured = async (photoUri: string) => {
    try {
      const timestamp = Date.now();
      const filename = `flower_${timestamp}.jpg`;
      const newPath = FLOWER_IMAGES_DIR + filename;

      await FileSystem.copyAsync({ from: photoUri, to: newPath });

      setFormData({
        ...formData,
        image_url: newPath,
        tree_id: treeId || "",
      });
      setPreviewImage(newPath);
      setCameraVisible(false);
      setModalVisible(true);

      Toast.show({
        type: "success",
        text1: "Photo Captured",
        text2: "Flower photo saved",
      });
    } catch (error) {
      console.error("Error handling photo:", error);
    }
  };

  const handleCreate = async () => {
    if (creating) return;

    const quantity = parseInt(formData.quantity);
    if (isNaN(quantity) || quantity < 1) {
      Toast.show({
        type: "error",
        text1: "Invalid",
        text2: "Enter valid quantity",
      });
      return;
    }

    try {
      setCreating(true);
      await FlowerService.createFlower({
        tree_id: formData.tree_id,
        user_id: user.id,
        quantity: quantity,
        wrapped_at: new Date(formData.wrapped_at),
        image_url: formData.image_url || "",
      });

      Toast.show({
        type: "success",
        text1: "Success",
        text2: "Flower created",
      });
      if (treeId) await loadFlowers(treeId);
      else await loadFlowers();
      await loadStats();
      resetForm();
      setModalVisible(false);
      setPreviewImage(null);
    } catch (error) {
      console.error("Create error:", error);
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
        text1: "Invalid",
        text2: "Enter valid quantity",
      });
      return;
    }

    try {
      setUpdating(true);
      await FlowerService.updateFlower(editingFlower.id, {
        tree_id: formData.tree_id,
        user_id: user.id,
        quantity: quantity,
        wrapped_at: new Date(formData.wrapped_at),
        image_url: formData.image_url || "",
      });

      Toast.show({
        type: "success",
        text1: "Success",
        text2: "Flower updated",
      });
      if (treeId) await loadFlowers(treeId);
      await loadStats();
      resetForm();
      setModalVisible(false);
      setPreviewImage(null);
    } catch (error) {
      console.error("Update error:", error);
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert("Delete Flower", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await FlowerService.deleteFlower(id);
          if (treeId) await loadFlowers(treeId);
          else await loadFlowers();
          await loadStats();
          Toast.show({
            type: "success",
            text1: "Deleted",
            text2: "Flower deleted",
          });
        },
      },
    ]);
  };

  const resetForm = () => {
    setEditingFlower(null);
    setFormData({
      tree_id: treeId || "",
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
        text1: "Offline",
        text2: "Cannot sync while offline",
      });
      return;
    }

    setSyncing(true);
    try {
      await FlowerService.syncAll();
      if (treeId) await loadFlowers(treeId);
      else await loadFlowers();
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
        text2: "Failed to sync",
      });
    } finally {
      setSyncing(false);
    }
  };

  const autoSync = async () => {
    try {
      await FlowerService.syncAll();
      await FruitService.syncAll();
      if (treeId) await loadFlowers(treeId);
      await loadStats();
    } catch (error) {
      console.error("Auto-sync error:", error);
    }
  };

  const renderFlowerItem = ({ item }: { item: Flower }) => {
    const hasLocalImage = item.image_url;
    const flowerShortId = item.id.substring(0, 6).toUpperCase();
    const userData = (item as any).user;

    return (
      <TouchableOpacity
        onPress={() =>
          router.push({
            pathname: "/admin/fruits",
            params: { flowerData: JSON.stringify(item) },
          })
        }
        activeOpacity={0.7}
      >
        <View className="bg-white p-4 rounded-xl mb-3 shadow-sm border border-gray-100">
          <View className="flex-row">
            {/* Image Section */}
            {hasLocalImage ? (
              <Image
                source={{ uri: item.image_url }}
                className="w-20 h-20 rounded-lg mr-4"
                resizeMode="cover"
              />
            ) : (
              <View className="w-20 h-20 bg-gray-100 rounded-lg mr-4 items-center justify-center">
                <FlowerIcon size={24} color="#9ca3af" />
              </View>
            )}

            {/* Content Section - may malaking right margin para hindi matakpan ng buttons */}
            <View className="flex-1 mr-28">
              {/* Flower ID Badge */}
              <View className="bg-gray-100 px-2 py-0.5 rounded-full self-start mb-1">
                <Text className="text-xs font-mono text-gray-600">
                  FLOWER-{flowerShortId}
                </Text>
              </View>

              {/* Tree Info */}
              {treeDetails && (
                <View className="flex-row items-center mb-1">
                  <TreeIcon size={14} color="#6b7280" />
                  <Text
                    className="text-sm text-gray-600 ml-1 flex-1"
                    numberOfLines={1}
                  >
                    {treeDetails.type} - {treeDetails.description}
                  </Text>
                </View>
              )}

              {/* User Info */}
              {userData && (
                <Text className="text-xs text-gray-400 mb-1">
                  👤 {userData.first_name} {userData.last_name}
                </Text>
              )}

              {/* Date */}
              <View className="flex-row items-center mb-1">
                <Calendar size={14} color="#6b7280" />
                <Text className="text-sm text-gray-600 ml-1">
                  {item.wrapped_at.toLocaleDateString()}
                </Text>
              </View>

              {/* Quantity */}
              <View className="flex-row items-center mb-2">
                <Package size={14} color="#6b7280" />
                <Text className="text-sm text-gray-600 ml-1 font-semibold">
                  {item.quantity} flower{item.quantity !== 1 ? "s" : ""}
                </Text>
              </View>

              {/* Status */}
              <View className="flex-row items-center justify-between mt-1">
                <View className="flex-row items-center">
                  <View
                    className={`w-2 h-2 rounded-full mr-2 ${
                      item.is_synced ? "bg-green-500" : "bg-amber-500"
                    }`}
                  />
                  <Text className="text-xs text-gray-500">
                    {item.is_synced ? "Synced" : "Pending"}
                  </Text>
                </View>
                <Text className="text-xs text-gray-400">
                  {item.created_at
                    ? new Date(item.created_at).toLocaleDateString()
                    : "No date"}
                </Text>
              </View>
            </View>

            {/* Action Buttons - nakaposisyon sa kanan */}
            <View className="absolute right-2 top-1/2 -translate-y-1/2 flex-row gap-2">
              <TouchableOpacity
                className="p-2 bg-blue-500 rounded-lg"
                onPress={() => handleEdit(item)}
              >
                <Text className="text-xs text-white font-medium">Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="p-2 bg-red-500 rounded-lg"
                onPress={() => handleDelete(item.id)}
              >
                <Text className="text-xs text-white font-medium">Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#6366f1" />
        <Text className="mt-4 text-gray-500">Loading...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white pt-12 pb-4 px-4 shadow-sm border-b border-gray-100">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-2xl font-bold text-gray-800">
            {treeDetails.description} Flowers
          </Text>
          <View className="flex-row items-center">
            {isOnline ? (
              <Wifi size={16} color="#10b981" />
            ) : (
              <WifiOff size={16} color="#9ca3af" />
            )}
            <Text
              className={`ml-1 text-xs ${isOnline ? "text-green-600" : "text-gray-400"}`}
            >
              {isOnline ? "Online" : "Offline"}
            </Text>
          </View>
        </View>

        {treeDetails && (
          <View className="bg-gray-50 rounded-xl p-3 mb-4">
            <View className="flex-row items-center">
              <TreeIcon size={20} color="#6b7280" />
              <Text className="text-gray-700 ml-2">
                {treeDetails.type} - {treeDetails.description}
              </Text>
            </View>
          </View>
        )}

        <View className="flex-row bg-gray-100 rounded-xl p-3 mb-4">
          <View className="flex-1 items-center">
            <Text className="text-2xl font-bold text-gray-800">
              {stats.total}
            </Text>
            <Text className="text-xs text-gray-500">Total</Text>
          </View>
          <View className="flex-1 items-center">
            <Text className="text-2xl font-bold text-amber-600">
              {stats.unsynced}
            </Text>
            <Text className="text-xs text-gray-500">Pending</Text>
          </View>
          <View className="flex-1 items-center">
            <Text className="text-2xl font-bold text-green-600">
              {stats.synced}
            </Text>
            <Text className="text-xs text-gray-500">Synced</Text>
          </View>
        </View>

        <View className="flex-row gap-3">
          <TouchableOpacity
            className="flex-1 bg-indigo-500 py-3 rounded-xl flex-row items-center justify-center"
            onPress={handleTakePhoto}
          >
            <Plus size={18} color="white" />
            <Text className="text-white font-semibold ml-2">Add Flower</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`px-4 py-3 rounded-xl flex-row items-center ${isOnline && !syncing ? "bg-indigo-500" : "bg-gray-200"}`}
            onPress={manualSync}
            disabled={!isOnline || syncing}
          >
            <RefreshCw
              size={18}
              color={isOnline && !syncing ? "white" : "#9ca3af"}
            />
            <Text
              className={`ml-2 font-medium ${isOnline && !syncing ? "text-white" : "text-gray-400"}`}
            >
              {syncing ? "Syncing..." : "Sync"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={flowers}
        renderItem={renderFlowerItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#6366f1"]}
            tintColor="#6366f1"
          />
        }
        ListEmptyComponent={
          <View className="items-center py-20">
            <View className="bg-gray-100 p-6 rounded-full mb-4">
              <FlowerIcon size={48} color="#9ca3af" />
            </View>
            <Text className="text-lg font-medium text-gray-600 mb-2">
              No Flowers Yet
            </Text>
            <Text className="text-gray-400 text-center mb-6">
              {treeDetails
                ? `No flowers for ${treeDetails.type} tree`
                : "Take a photo to get started"}
            </Text>
            <TouchableOpacity
              className="bg-indigo-500 px-6 py-3 rounded-xl"
              onPress={handleTakePhoto}
            >
              <Text className="text-white font-semibold">Take First Photo</Text>
            </TouchableOpacity>
          </View>
        }
      />

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

      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(false);
          resetForm();
        }}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl pt-6 pb-8 px-6 max-h-[90%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-gray-800">
                {editingFlower ? "Edit Flower" : "Add Flower"}
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

            {/* Use KeyboardAwareScrollView instead of ScrollView */}
            <KeyboardAwareScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              extraScrollHeight={100}
              enableOnAndroid={true}
            >
              {previewImage && (
                <View className="mb-4">
                  <Text className="text-gray-700 font-medium mb-2">Photo</Text>
                  <Image
                    source={{ uri: previewImage }}
                    className="w-full h-48 rounded-xl"
                    resizeMode="cover"
                  />
                </View>
              )}

              {treeDetails && (
                <View className="mb-4">
                  <Text className="text-gray-700 font-medium mb-2">Tree</Text>
                  <View className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50">
                    <Text className="text-gray-800">
                      {treeDetails.type} - {treeDetails.description}
                    </Text>
                  </View>
                </View>
              )}

              <View className="mb-4">
                <Text className="text-gray-700 font-medium mb-2">
                  Quantity *
                </Text>
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50"
                  placeholder="Number of flowers"
                  value={formData.quantity}
                  onChangeText={(text) =>
                    setFormData({ ...formData, quantity: text })
                  }
                  keyboardType="numeric"
                  autoFocus={true}
                />
              </View>

              <View className="mb-6">
                <Text className="text-gray-700 font-medium mb-2">
                  Wrapping Date *
                </Text>
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50"
                  value={formData.wrapped_at}
                  onChangeText={(text) =>
                    setFormData({ ...formData, wrapped_at: text })
                  }
                  placeholder="YYYY-MM-DD"
                />
              </View>

              <View className="flex-row gap-3 mt-4 mb-4">
                <TouchableOpacity
                  className="flex-1 bg-gray-200 py-4 rounded-xl"
                  onPress={() => {
                    setModalVisible(false);
                    resetForm();
                  }}
                >
                  <Text className="text-center font-semibold text-gray-700">
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-indigo-500 py-4 rounded-xl"
                  onPress={editingFlower ? handleUpdate : handleCreate}
                  disabled={creating || updating}
                >
                  <Text className="text-center font-semibold text-white">
                    {editingFlower ? "Update" : "Save"}
                  </Text>
                </TouchableOpacity>
              </View>
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>

      <Toast />
    </View>
  );
}
