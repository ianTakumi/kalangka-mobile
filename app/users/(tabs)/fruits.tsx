import FruitCamera from "@/components/FruitCamera";
import FlowerService from "@/services/FlowerService";
import FruitService from "@/services/FruitService";
import { Flower, Fruit } from "@/types/index";
import { formatLocalDateTime } from "@/utils/helpers";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import NetInfo from "@react-native-community/netinfo";
import { useFocusEffect } from "@react-navigation/native";
import * as FileSystem from "expo-file-system/legacy";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  Flower as FlowerIcon,
  Package,
  Plus,
  Tag,
  Wifi,
  WifiOff,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import Toast from "react-native-toast-message";
import { useSelector } from "react-redux";

const FRUIT_IMAGES_DIR = FileSystem.documentDirectory + "fruit_images/";

const ensureImagesDirExists = async () => {
  const dirInfo = await FileSystem.getInfoAsync(FRUIT_IMAGES_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(FRUIT_IMAGES_DIR, {
      intermediates: true,
    });
  }
};

export default function FruitsScreen() {
  const [fruits, setFruits] = useState<Fruit[]>([]);
  const [flowers, setFlowers] = useState<Flower[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [storedTreeData, setStoredTreeData] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [editingFruit, setEditingFruit] = useState<Fruit | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [showFlowerSelector, setShowFlowerSelector] = useState(false);
  const [withoutFlower, setWithoutFlower] = useState(false);
  const [selectedFlower, setSelectedFlower] = useState<Flower | null>(null);
  const [formData, setFormData] = useState({
    tree_id: "",
    flower_id: "",
    quantity: "1",
    bagged_at: new Date().toISOString(),
    tag_id: 1,
    image_url: "",
  });
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const user = useSelector((state: any) => state.auth.user);
  const [treeDetails, setTreeDetails] = useState<any>(null);

  const router = useRouter();
  const params = useLocalSearchParams();

  const tagOptions = [
    { id: 1, label: "Tag 1", color: "bg-blue-100", textColor: "text-blue-700" },
    {
      id: 2,
      label: "Tag 2",
      color: "bg-green-100",
      textColor: "text-green-700",
    },
    {
      id: 3,
      label: "Tag 3",
      color: "bg-yellow-100",
      textColor: "text-yellow-700",
    },
    {
      id: 4,
      label: "Tag 4",
      color: "bg-orange-100",
      textColor: "text-orange-700",
    },
  ];

  const treeIdFromParams = params.treeId as string;
  const flowerDataFromParams = params.flowerData
    ? JSON.parse(params.flowerData as string)
    : null;
  const sourceFromParams = params.source as string;

  useEffect(() => {
    ensureImagesDirExists();
    loadInitialData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (storedTreeData?.id) {
        loadFruits(storedTreeData.id);
        loadFlowers(storedTreeData.id);
      } else {
        loadInitialData();
      }
    }, [storedTreeData?.id]),
  );

  useEffect(() => {
    if (flowerDataFromParams) {
      setSelectedFlower(flowerDataFromParams);
      setWithoutFlower(false);
      setFormData((prev) => ({
        ...prev,
        flower_id: flowerDataFromParams.id,
        tree_id: flowerDataFromParams.tree_id,
      }));
      setModalVisible(true);
    } else if (sourceFromParams === "tree" && treeIdFromParams) {
      setWithoutFlower(true);
      setFormData((prev) => ({
        ...prev,
        tree_id: treeIdFromParams,
        flower_id: "",
      }));
      setModalVisible(true);
    }
  }, [flowerDataFromParams, sourceFromParams, treeIdFromParams]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected ?? false;
      setIsOnline(online);
      if (online) autoSync();
    });
    return () => unsubscribe();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const treeJson = await AsyncStorage.getItem("currentTree");
      if (treeJson) {
        const tree = JSON.parse(treeJson);
        setStoredTreeData(tree);
        setTreeDetails(tree);

        // Load flowers and fruits after tree data is loaded
        await Promise.all([loadFlowers(tree.id), loadFruits(tree.id)]);
      } else {
        setFruits([]);
        setFlowers([]);
      }
    } catch (error) {
      console.error("Error loading initial data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadFlowers = async (treeId?: string) => {
    try {
      await FlowerService.init();
      const effectiveTreeId = treeId || storedTreeData?.id;

      if (!effectiveTreeId) {
        console.log("No tree ID available for loading flowers");
        return;
      }

      const data = await FlowerService.getFlowersByTreeId(
        effectiveTreeId,
        false,
      );
      setFlowers(data);
    } catch (error) {
      console.error("Load flowers error:", error);
    }
  };

  const loadFruits = async (treeId?: string) => {
    try {
      await FruitService.init();
      const effectiveTreeId = treeId || storedTreeData?.id;

      if (!effectiveTreeId) {
        console.log("No tree ID available for loading fruits");
        setFruits([]);
        return;
      }

      const data = await FruitService.getFruitsByTreeId(effectiveTreeId, false);
      setFruits(data);
    } catch (error) {
      console.error("Load fruits error:", error);
      Toast.show({
        type: "error",
        text1: "Load Failed",
        text2: "Failed to load fruits",
      });
    }
  };

  const autoSync = async () => {
    try {
      await FruitService.syncAll();
      if (storedTreeData?.id) {
        await loadFruits(storedTreeData.id);
      }
    } catch (error) {
      console.error("Auto-sync error:", error);
    }
  };

  const handleTakePhoto = () => {
    setCameraVisible(true);
  };

  const handlePhotoCaptured = async (photoUri: string) => {
    try {
      const timestamp = Date.now();
      const filename = `fruit_${timestamp}.jpg`;
      const newPath = FRUIT_IMAGES_DIR + filename;

      await FileSystem.copyAsync({ from: photoUri, to: newPath });

      setFormData((prev) => ({ ...prev, image_url: newPath }));
      setPreviewImage(newPath);
      setCameraVisible(false);

      Toast.show({
        type: "success",
        text1: "Photo Captured",
        text2: "Fruit photo saved",
      });
    } catch (error) {
      console.error("Error handling photo:", error);
    }
  };

  const handleCreate = async () => {
    if (creating || isSubmitting) return;

    const quantity = parseInt(formData.quantity);
    if (isNaN(quantity) || quantity < 1) {
      Toast.show({
        type: "error",
        text1: "Invalid",
        text2: "Enter valid quantity",
      });
      return;
    }

    const effectiveTreeId =
      formData.tree_id || treeIdFromParams || storedTreeData?.id;
    if (!effectiveTreeId) {
      Toast.show({
        type: "error",
        text1: "Missing Info",
        text2: "Tree information is required",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      setCreating(true);

      const fruitData: any = {
        tree_id: effectiveTreeId,
        user_id: user.id,
        quantity: quantity,
        bagged_at: formatLocalDateTime(new Date(formData.bagged_at)),
        tag_id: formData.tag_id,
        image_uri: formData.image_url || "",
      };

      if (!withoutFlower && formData.flower_id) {
        fruitData.flower_id = formData.flower_id;
      }

      await FruitService.createFruit(fruitData);

      Toast.show({
        type: "success",
        text1: "Success",
        text2: "Fruit created successfully",
      });

      if (storedTreeData?.id) {
        await loadFruits(storedTreeData.id);
      }
      resetForm();
      setModalVisible(false);
      setPreviewImage(null);
      setSelectedFlower(null);
    } catch (error: any) {
      console.error("Create error:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.message || "Failed to create fruit",
      });
    } finally {
      setCreating(false);
      setIsSubmitting(false);
    }
  };

  const handleEdit = (fruit: Fruit) => {
    setEditingFruit(fruit);
    setWithoutFlower(!fruit.flower_id);

    // Find and set the selected flower if flower_id exists
    if (fruit.flower_id) {
      const flower = flowers.find((f) => f.id === fruit.flower_id);
      setSelectedFlower(flower || null);
    } else {
      setSelectedFlower(null);
    }

    setFormData({
      tree_id: fruit.tree_id,
      flower_id: fruit.flower_id || "",
      quantity: fruit.quantity.toString(),
      bagged_at: new Date(fruit.bagged_at).toISOString(),
      tag_id: fruit.tag_id || 1,
      image_url: fruit.image_uri || "",
    });
    setPreviewImage(fruit.image_uri || null);
    setModalVisible(true);
  };

  const handleUpdate = async () => {
    if (updating || isSubmitting || !editingFruit) return;

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
      setIsSubmitting(true);
      setUpdating(true);

      await FruitService.updateFruit(editingFruit.id, {
        quantity: quantity,
        bagged_at: new Date(formData.bagged_at),
        tag_id: formData.tag_id,
        image_uri: formData.image_url || editingFruit.image_uri,
        flower_id: withoutFlower ? null : formData.flower_id,
        user_id: user.id,
      });

      Toast.show({
        type: "success",
        text1: "Success",
        text2: "Fruit updated successfully",
      });

      if (storedTreeData?.id) {
        await loadFruits(storedTreeData.id);
      }
      resetForm();
      setModalVisible(false);
      setPreviewImage(null);
      setSelectedFlower(null);
    } catch (error: any) {
      console.error("Update error:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.message || "Failed to update fruit",
      });
    } finally {
      setUpdating(false);
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert("Delete Fruit", "Are you sure you want to delete this fruit?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await FruitService.deleteFruit(id);
            if (storedTreeData?.id) {
              await loadFruits(storedTreeData.id);
            }
            Toast.show({
              type: "success",
              text1: "Deleted",
              text2: "Fruit deleted successfully",
            });
          } catch (error) {
            Toast.show({
              type: "error",
              text1: "Error",
              text2: "Failed to delete fruit",
            });
          }
        },
      },
    ]);
  };

  const resetForm = () => {
    setEditingFruit(null);
    const effectiveTreeId = treeIdFromParams || storedTreeData?.id || "";
    setFormData({
      tree_id: effectiveTreeId,
      flower_id: "",
      quantity: "1",
      bagged_at: new Date().toISOString(),
      tag_id: 1,
      image_url: "",
    });
    setPreviewImage(null);
    setShowTagDropdown(false);
    setWithoutFlower(false);
    setSelectedFlower(null);
  };

  const getTagLabel = (tagId: number) => {
    return tagOptions.find((t) => t.id === tagId)?.label || `Tag ${tagId}`;
  };

  const getTagColor = (tagId: number) => {
    return tagOptions.find((t) => t.id === tagId)?.color || "bg-gray-100";
  };

  const getTagTextColor = (tagId: number) => {
    return tagOptions.find((t) => t.id === tagId)?.textColor || "text-gray-700";
  };

  // Flower Selector Modal
  const FlowerSelectorModal = () => {
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={showFlowerSelector}
        onRequestClose={() => setShowFlowerSelector(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6 max-h-[90%]">
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text className="text-2xl font-bold text-gray-900">
                  Select Flower
                </Text>
                <Text className="text-sm text-gray-600 mt-1">
                  Choose a flower to create fruit from
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowFlowerSelector(false)}
                className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
              >
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View className="bg-orange-50 rounded-xl p-3 mb-4 flex-row justify-between items-center">
              <Text className="text-orange-700 font-medium">
                Available Flowers: {flowers.length}
              </Text>
              <View className="bg-orange-200 px-3 py-1 rounded-full">
                <Text className="text-xs text-orange-700 font-medium">
                  Select One
                </Text>
              </View>
            </View>

            <FlatList
              data={flowers}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item }) => {
                const flowerShortId = item.id.substring(0, 6).toUpperCase();
                const userData = (item as any).user;
                const fruitCount = (item as any).fruits_count || 0;

                return (
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedFlower(item);
                      setWithoutFlower(false);
                      setFormData((prev) => ({
                        ...prev,
                        flower_id: item.id,
                        tree_id: item.tree_id,
                      }));
                      setShowFlowerSelector(false);
                    }}
                    className="flex-row items-center p-4 border-b border-gray-100 active:bg-gray-50"
                  >
                    {item.image_url ? (
                      <Image
                        source={{ uri: item.image_url }}
                        className="w-14 h-14 rounded-xl mr-4"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="w-14 h-14 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl mr-4 items-center justify-center">
                        <FlowerIcon size={28} color="#F97316" />
                      </View>
                    )}

                    <View className="flex-1">
                      <View className="flex-row items-center justify-between mb-1">
                        <Text className="font-bold text-gray-900">
                          FLOWER-{flowerShortId}
                        </Text>
                        {fruitCount > 0 && (
                          <View className="bg-green-100 px-2 py-0.5 rounded-full">
                            <Text className="text-xs text-green-700">
                              🍎 {fruitCount} fruit{fruitCount !== 1 ? "s" : ""}
                            </Text>
                          </View>
                        )}
                      </View>

                      {userData && (
                        <View className="flex-row items-center mb-1">
                          <Text className="text-xs text-gray-500 ml-1">
                            👤 {userData.first_name} {userData.last_name}
                          </Text>
                        </View>
                      )}

                      <View className="flex-row items-center gap-3 mt-1">
                        <View className="flex-row items-center">
                          <Calendar size={12} color="#6B7280" />
                          <Text className="text-xs text-gray-600 ml-1">
                            {new Date(item.wrapped_at).toLocaleDateString(
                              "en-PH",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              },
                            )}
                          </Text>
                        </View>
                        <View className="flex-row items-center">
                          <FlowerIcon size={12} color="#6B7280" />
                          <Text className="text-xs text-gray-600 ml-1">
                            {item.quantity} pc{item.quantity !== 1 ? "s" : ""}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View className="ml-3">
                      <ChevronDown
                        size={20}
                        color="#F97316"
                        style={{ transform: [{ rotate: "-90deg" }] }}
                      />
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View className="items-center justify-center py-16">
                  <View className="w-20 h-20 bg-orange-50 rounded-full items-center justify-center mb-4">
                    <FlowerIcon size={40} color="#F97316" />
                  </View>
                  <Text className="text-xl font-bold text-gray-900 text-center mb-2">
                    No Flowers Available
                  </Text>
                  <Text className="text-gray-600 text-center mb-6">
                    You need to add flowers first before creating fruits from
                    flowers.
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    );
  };

  const renderFruitItem = ({ item }: { item: Fruit }) => {
    const hasLocalImage = item.image_uri;
    const fruitShortId = item.id.substring(0, 6).toUpperCase();
    const userData = (item as any).user;
    const treeData = (item as any).tree;
    const flowerData = (item as any).flower;

    return (
      <TouchableOpacity onPress={() => handleEdit(item)} activeOpacity={0.7}>
        <View className="bg-white p-4 rounded-xl mb-3 shadow-sm border border-gray-100">
          <View className="flex-row">
            {hasLocalImage ? (
              <Image
                source={{ uri: item.image_uri }}
                className="w-20 h-20 rounded-lg mr-4"
                resizeMode="cover"
              />
            ) : (
              <View className="w-20 h-20 bg-gray-100 rounded-lg mr-4 items-center justify-center">
                <Package size={24} color="#9ca3af" />
              </View>
            )}

            <View className="flex-1 mr-16">
              <View className="flex-row items-center justify-between mb-2">
                <View className="bg-gray-100 px-2 py-0.5 rounded-full">
                  <Text className="text-xs font-mono text-gray-600">
                    FRUIT-{fruitShortId}
                  </Text>
                </View>
                <View
                  className={`px-2 py-0.5 rounded-full ${getTagColor(item.tag_id || 1)}`}
                >
                  <Text
                    className={`text-xs font-medium ${getTagTextColor(item.tag_id || 1)}`}
                  >
                    {getTagLabel(item.tag_id || 1)}
                  </Text>
                </View>
              </View>

              {treeData && (
                <Text className="text-xs text-gray-500 mb-1">
                  🌳{" "}
                  {treeData.description ||
                    `Tree ${treeData.id?.substring(0, 6)}`}
                </Text>
              )}

              {flowerData && (
                <Text className="text-xs text-purple-500 mb-1">
                  🌸 From Flower {flowerData.id?.substring(0, 6).toUpperCase()}
                </Text>
              )}

              {userData && (
                <Text className="text-xs text-gray-400 mb-1">
                  👤 {userData.first_name} {userData.last_name}
                </Text>
              )}

              <View className="flex-row items-center mb-1">
                <Calendar size={14} color="#6b7280" />
                <Text className="text-sm text-gray-600 ml-1">
                  Bagged: {new Date(item.bagged_at).toLocaleDateString("en-PH")}
                </Text>
              </View>

              <View className="flex-row items-center mb-2">
                <Package size={14} color="#6b7280" />
                <Text className="text-sm text-gray-600 ml-1 font-semibold">
                  {item.quantity} fruit{item.quantity !== 1 ? "s" : ""}
                </Text>
              </View>

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
              </View>
            </View>

            <View className="absolute right-2 top-1/2 -translate-y-1/2 flex-col gap-2">
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

  const displayTreeName =
    treeDetails?.description || storedTreeData?.description || "Tree";

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white pt-12 pb-4 px-4 border-b border-gray-100">
        <View className="flex-row items-center mb-4">
          <TouchableOpacity
            onPress={() => router.push("/users/qrcam")}
            className="w-10 h-10 rounded-full items-center justify-center bg-gray-100 mr-3"
          >
            <ArrowLeft size={24} color="#374151" />
          </TouchableOpacity>
          <Text className="flex-1 text-xl font-bold text-gray-800">
            {displayTreeName} Fruits
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

        <TouchableOpacity
          className="bg-green-500 py-3 rounded-xl flex-row items-center justify-center"
          onPress={() => {
            resetForm();
            setModalVisible(true);
          }}
        >
          <Plus size={18} color="white" />
          <Text className="text-white font-semibold ml-2">Add Fruit</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={fruits}
        renderItem={renderFruitItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              if (storedTreeData?.id) {
                await Promise.all([
                  loadFruits(storedTreeData.id),
                  loadFlowers(storedTreeData.id),
                ]);
              }
              setRefreshing(false);
            }}
            colors={["#6366f1"]}
            tintColor="#6366f1"
          />
        }
        ListEmptyComponent={
          <View className="items-center py-20">
            <View className="bg-gray-100 p-6 rounded-full mb-4">
              <Package size={48} color="#9ca3af" />
            </View>
            <Text className="text-lg font-medium text-gray-600 mb-2">
              No Fruits Yet
            </Text>
            <Text className="text-gray-400 text-center mb-6">
              {treeDetails || storedTreeData
                ? `No fruits for ${displayTreeName} tree`
                : "Add a fruit to get started"}
            </Text>
            <TouchableOpacity
              className="bg-indigo-500 px-6 py-3 rounded-xl"
              onPress={() => {
                resetForm();
                setModalVisible(true);
              }}
            >
              <Text className="text-white font-semibold">Add First Fruit</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Camera Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={cameraVisible}
        onRequestClose={() => setCameraVisible(false)}
      >
        <FruitCamera
          onPhotoCaptured={handlePhotoCaptured}
          onClose={() => setCameraVisible(false)}
        />
      </Modal>

      {/* Flower Selector Modal */}
      <FlowerSelectorModal />

      {/* Add/Edit Modal */}
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
                {editingFruit ? "Edit Fruit" : "Add Fruit"}
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

            <KeyboardAwareScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              extraScrollHeight={100}
              enableOnAndroid={true}
            >
              {/* Fruit ID Display (for editing) */}
              {editingFruit && (
                <View className="mb-4">
                  <Text className="text-gray-700 font-medium mb-2">
                    Fruit ID
                  </Text>
                  <View className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-100">
                    <Text className="text-gray-800 font-mono">
                      FRUIT-{editingFruit.id.substring(0, 8).toUpperCase()}
                    </Text>
                  </View>
                </View>
              )}

              {/* Photo Section */}
              {previewImage ? (
                <View className="mb-4">
                  <Text className="text-gray-700 font-medium mb-2">Photo</Text>
                  <Image
                    source={{ uri: previewImage }}
                    className="w-full h-48 rounded-xl"
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    className="absolute top-8 right-2 bg-black/50 rounded-full p-2"
                    onPress={() => {
                      setPreviewImage(null);
                      setFormData((prev) => ({ ...prev, image_url: "" }));
                    }}
                  >
                    <X size={16} color="white" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  className="border-2 border-dashed border-gray-300 rounded-xl h-32 items-center justify-center mb-4 bg-gray-50"
                  onPress={handleTakePhoto}
                >
                  <Plus size={32} color="#9ca3af" />
                  <Text className="text-gray-500 mt-2">Add Fruit Photo</Text>
                </TouchableOpacity>
              )}

              {/* Without Flower Toggle */}
              <View className="mb-4 flex-row items-center justify-between">
                <View>
                  <Text className="text-gray-700 font-medium">
                    Without Flower Source
                  </Text>
                  <Text className="text-xs text-gray-500">
                    Check if this fruit is not from any flower
                  </Text>
                </View>
                <Switch
                  value={withoutFlower}
                  onValueChange={(value) => {
                    setWithoutFlower(value);
                    if (value) {
                      setSelectedFlower(null);
                      setFormData((prev) => ({ ...prev, flower_id: "" }));
                    }
                  }}
                  trackColor={{ false: "#d1d5db", true: "#6366f1" }}
                  thumbColor={withoutFlower ? "#ffffff" : "#f3f4f6"}
                />
              </View>

              {/* Flower Selection (if not without flower) */}
              {!withoutFlower && (
                <View className="mb-4">
                  <Text className="text-gray-700 font-medium mb-2">
                    Source Flower {!editingFruit && "*"}
                  </Text>
                  {selectedFlower ? (
                    <View className="border border-gray-200 rounded-xl p-3 bg-orange-50 flex-row items-center justify-between">
                      <View className="flex-row items-center flex-1">
                        {selectedFlower.image_url ? (
                          <Image
                            source={{ uri: selectedFlower.image_url }}
                            className="w-12 h-12 rounded-lg mr-3"
                            resizeMode="cover"
                          />
                        ) : (
                          <View className="w-12 h-12 bg-orange-100 rounded-lg mr-3 items-center justify-center">
                            <FlowerIcon size={20} color="#F97316" />
                          </View>
                        )}
                        <View className="flex-1">
                          <Text className="font-semibold text-gray-800">
                            Flower{" "}
                            {selectedFlower.id.substring(0, 6).toUpperCase()}
                          </Text>
                          <Text className="text-xs text-gray-500">
                            Wrapped:{" "}
                            {new Date(
                              selectedFlower.wrapped_at,
                            ).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedFlower(null);
                          setFormData((prev) => ({ ...prev, flower_id: "" }));
                        }}
                        className="p-2"
                      >
                        <X size={18} color="#6b7280" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => setShowFlowerSelector(true)}
                      className="border border-dashed border-orange-400 rounded-xl p-4 items-center justify-center bg-orange-50"
                    >
                      <FlowerIcon size={24} color="#F97316" />
                      <Text className="text-orange-600 font-medium mt-2">
                        Select a Flower
                      </Text>
                      <Text className="text-xs text-gray-500 mt-1">
                        Choose which flower this fruit came from
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Tag Selection */}
              <View className="mb-4">
                <Text className="text-gray-700 font-medium mb-2">
                  Batch Tag
                </Text>
                <TouchableOpacity
                  onPress={() => setShowTagDropdown(!showTagDropdown)}
                  className="flex-row items-center justify-between border border-gray-200 rounded-xl px-4 py-3 bg-gray-50"
                >
                  <View className="flex-row items-center">
                    <Tag size={18} color="#6b7280" />
                    <View
                      className={`ml-2 px-3 py-1 rounded-full ${getTagColor(formData.tag_id)}`}
                    >
                      <Text
                        className={`text-sm font-medium ${getTagTextColor(formData.tag_id)}`}
                      >
                        {getTagLabel(formData.tag_id)}
                      </Text>
                    </View>
                  </View>
                  <ChevronDown size={18} color="#6b7280" />
                </TouchableOpacity>

                {showTagDropdown && (
                  <View className="mt-1 border border-gray-200 rounded-xl bg-white overflow-hidden">
                    {tagOptions.map((tag) => (
                      <TouchableOpacity
                        key={tag.id}
                        onPress={() => {
                          setFormData((prev) => ({ ...prev, tag_id: tag.id }));
                          setShowTagDropdown(false);
                        }}
                        className={`flex-row items-center px-4 py-3 ${formData.tag_id === tag.id ? "bg-orange-50" : "bg-white"}`}
                      >
                        <View className={`px-3 py-1 rounded-full ${tag.color}`}>
                          <Text
                            className={`text-sm font-medium ${tag.textColor}`}
                          >
                            {tag.label}
                          </Text>
                        </View>
                        {formData.tag_id === tag.id && (
                          <Text className="ml-auto text-orange-500 text-sm">
                            ✓
                          </Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Quantity */}
              <View className="mb-4">
                <Text className="text-gray-700 font-medium mb-2">
                  Quantity *
                </Text>
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50"
                  placeholder="Number of fruits"
                  value={formData.quantity}
                  onChangeText={(text) =>
                    setFormData({ ...formData, quantity: text })
                  }
                  keyboardType="numeric"
                  autoFocus={true}
                />
              </View>

              {/* Bagged Date */}
              <View className="mb-6">
                <Text className="text-gray-700 font-medium mb-2">
                  Bagged Date *
                </Text>

                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 flex-row items-center"
                >
                  <Calendar size={18} color="#6B7280" />
                  <Text className="ml-2 text-gray-800">
                    {new Date(formData.bagged_at).toLocaleString("en-PH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </TouchableOpacity>

                {showDatePicker && (
                  <DateTimePicker
                    value={new Date(formData.bagged_at)}
                    mode="date"
                    display="default"
                    maximumDate={new Date()}
                    onChange={(event, selectedDate) => {
                      setShowDatePicker(false);
                      if (selectedDate) {
                        // Keep the selected date but use current time
                        const now = new Date();
                        selectedDate.setHours(
                          now.getHours(),
                          now.getMinutes(),
                          now.getSeconds(),
                        );

                        setFormData({
                          ...formData,
                          bagged_at: selectedDate.toISOString(),
                        });
                      }
                    }}
                  />
                )}
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-3 mt-4 mb-4">
                <TouchableOpacity
                  className="flex-1 bg-gray-200 py-4 rounded-xl"
                  onPress={() => {
                    setModalVisible(false);
                    resetForm();
                  }}
                  disabled={isSubmitting || creating || updating}
                >
                  <Text className="text-center font-semibold text-gray-700">
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`flex-1 py-4 rounded-xl flex-row items-center justify-center ${
                    isSubmitting || creating || updating
                      ? "bg-indigo-300"
                      : "bg-indigo-500"
                  }`}
                  onPress={editingFruit ? handleUpdate : handleCreate}
                  disabled={
                    isSubmitting ||
                    creating ||
                    updating ||
                    (!withoutFlower && !selectedFlower && !editingFruit) ||
                    !formData.image_url // Add this line - disable if no image
                  }
                >
                  {isSubmitting || creating || updating ? (
                    <>
                      <ActivityIndicator size="small" color="white" />
                      <Text className="text-center font-semibold text-white ml-2">
                        {editingFruit ? "Updating..." : "Saving..."}
                      </Text>
                    </>
                  ) : (
                    <Text className="text-center font-semibold text-white">
                      {editingFruit ? "Update" : "Save"}
                    </Text>
                  )}
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
