import FruitCamera from "@/components/FruitCamera";
import FruitService from "@/services/FruitService";
import TreeService from "@/services/treeService";
import { Fruit, Tree } from "@/types/index";
import NetInfo from "@react-native-community/netinfo";
import * as FileSystem from "expo-file-system/legacy";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Camera,
  ChevronDown,
  Package,
  RefreshCw,
  Tag,
  TreePine,
  Wifi,
  WifiOff,
  X,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
// Create directory for fruit images
const FRUIT_IMAGES_DIR = FileSystem.documentDirectory + "fruit_images/";

const ensureImagesDirExists = async () => {
  const dirInfo = await FileSystem.getInfoAsync(FRUIT_IMAGES_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(FRUIT_IMAGES_DIR, {
      intermediates: true,
    });
  }
};

export default function FruitReportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const flowerData = params.flowerData
    ? JSON.parse(params.flowerData as string)
    : null;
  const flowerId = flowerData?.id as string;
  const flowerDate = flowerData.flowerDate as string;
  const [isOnline, setIsOnline] = useState(false);
  const wasOfflineRef = useRef(false);

  const [fruit, setFruit] = useState<Fruit | null>(null);
  const [tree, setTree] = useState<Tree | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<number>(1);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [imageUri, setImageUri] = useState<string>("");
  const [cameraVisible, setCameraVisible] = useState(false);
  const [autoSyncInProgress, setAutoSyncInProgress] = useState(false);

  const tagOptions = [
    {
      id: 1,
      label: "Tag 1",
      color: "bg-blue-100",
      textColor: "text-blue-700",
    },
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

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected ?? false;

      if (online && wasOfflineRef.current === true) {
        console.log("🔄 Device came online, auto-refreshing...");
        handleAutoRefresh();
      }

      wasOfflineRef.current = !online;
      setIsOnline(online);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    ensureImagesDirExists();
    loadData();
  }, [flowerId]);

  const handleAutoRefresh = async () => {
    if (autoSyncInProgress) return;

    setAutoSyncInProgress(true);
    Toast.show({
      type: "info",
      text1: "Device Online",
      text2: "Auto-syncing and refreshing data...",
      visibilityTime: 3000,
    });

    try {
      const unsyncedFruits = await FruitService.getUnsyncedFruits();
      if (unsyncedFruits.length > 0) {
        await FruitService.syncAll();
      }

      await fetchData();

      Toast.show({
        type: "success",
        text1: "Auto-Refresh Complete",
        text2: "Data synchronized successfully",
        visibilityTime: 3000,
      });
    } catch (error) {
      console.error("Auto-refresh error:", error);
      Toast.show({
        type: "error",
        text1: "Auto-Refresh Failed",
        text2: "Could not sync data",
      });
    } finally {
      setAutoSyncInProgress(false);
    }
  };

  const isFruitReadyForHarvest = (baggedAt: string): boolean => {
    const baggedDate = new Date(baggedAt);
    const currentDate = new Date();
    const diffTime = currentDate.getTime() - baggedDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 115;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      await fetchData();
    } catch (error) {
      console.error("Error loading data:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to load data",
      });
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchData();

      if (isOnline) {
        Toast.show({
          type: "info",
          text1: "Refreshing",
          text2: "Syncing latest data...",
        });

        await FruitService.syncAll();
        await fetchData();

        Toast.show({
          type: "success",
          text1: "Refresh Complete",
          text2: "Data synchronized successfully",
        });
      } else {
        Toast.show({
          type: "info",
          text1: "Refresh Complete",
          text2: "Data loaded from local storage",
        });
      }
    } catch (error) {
      console.error("Error refreshing:", error);
      Toast.show({
        type: "error",
        text1: "Refresh Failed",
        text2: "Could not refresh data",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const fetchData = async () => {
    if (flowerData?.tree_id) {
      const treeData = await TreeService.getTree(flowerData.tree_id);
      setTree(treeData);
    }

    const fruits = await FruitService.getFruitsByFlowerId(flowerId, false);
    if (fruits && fruits.length > 0) {
      const existingFruit = fruits[0];
      console.log("Existing fruit image_uri:", existingFruit.image_uri);
      console.log(
        "Existing fruit full data:",
        JSON.stringify(existingFruit, null, 2),
      );

      setFruit(existingFruit);
      setQuantity(existingFruit.quantity.toString());
      setSelectedTagId(existingFruit.tag_id || 1);

      // ✅ IMPORTANTE: I-check kung may image_uri at kung valid ang path
      if (existingFruit.image_uri && existingFruit.image_uri !== "") {
        // I-verify kung existing ang file
        const fileExists = await FileSystem.getInfoAsync(
          existingFruit.image_uri,
        );
        if (fileExists.exists) {
          setImageUri(existingFruit.image_uri);
          console.log("✅ Image loaded from:", existingFruit.image_uri);
        } else {
          console.warn("⚠️ Image file not found at:", existingFruit.image_uri);
          setImageUri("");
        }
      } else {
        console.log("ℹ️ No image URI found for existing fruit");
        setImageUri("");
      }
    } else {
      setFruit(null);
      setQuantity("");
      setSelectedTagId(1);
      setImageUri("");
    }
  };

  const getFlowerShortId = (id: string) => {
    return id.substring(0, 6).toUpperCase();
  };

  const getTagLabel = (tagId: number) => {
    return tagOptions.find((t) => t.id === tagId)?.label || `Batch ${tagId}`;
  };

  const getTagColor = (tagId: number) => {
    return tagOptions.find((t) => t.id === tagId)?.color || "bg-gray-100";
  };

  const getTagTextColor = (tagId: number) => {
    return tagOptions.find((t) => t.id === tagId)?.textColor || "text-gray-700";
  };

  const handleTakePhoto = () => {
    setCameraVisible(true);
  };

  const handlePhotoCaptured = async (photoUri: string) => {
    try {
      const timestamp = Date.now();
      const filename = `fruit_report_${flowerId}_${timestamp}.jpg`;
      const newPath = FRUIT_IMAGES_DIR + filename;

      await FileSystem.copyAsync({
        from: photoUri,
        to: newPath,
      });

      setImageUri(newPath);
      setCameraVisible(false);

      Toast.show({
        type: "success",
        text1: "Photo Captured",
        text2: "Fruit photo saved",
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

  const submitReport = async () => {
    if (!quantity || parseInt(quantity) < 0) {
      Toast.show({
        type: "error",
        text1: "Invalid",
        text2: "Please enter fruit count",
      });
      return;
    }

    try {
      setSubmitting(true);

      if (fruit) {
        await FruitService.updateFruit(fruit.id, {
          ...fruit,
          quantity: parseInt(quantity),
          tag_id: selectedTagId,
          image_uri: imageUri || fruit.image_uri,
        });
      } else {
        await FruitService.createFruit({
          flower_id: flowerId,
          tree_id: flowerData?.tree_id,
          user_id: flowerData?.user_id, // Make sure this is passed
          tag_id: selectedTagId,
          quantity: parseInt(quantity),
          bagged_at: new Date(flowerDate || Date.now()),
          image_uri: imageUri,
        });
      }

      Toast.show({
        type: "success",
        text1: "Saved",
        text2: "Fruit report saved successfully",
      });

      router.back();
    } catch (error) {
      console.error("Submit error:", error);
      Toast.show({
        type: "error",
        text1: "Failed",
        text2: "Could not save report",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleHarvest = () => {
    if (!fruit) {
      Toast.show({
        type: "error",
        text1: "No Report",
        text2: "Please submit a fruit report before harvesting",
      });
      return;
    }

    router.push({
      pathname: "/harvest",
      params: {
        fruitData: JSON.stringify(fruit),
      },
    });
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
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white pt-12 pb-4 px-4 shadow-sm border-b border-gray-200">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="mr-3 p-2"
            >
              <ArrowLeft size={24} color="#4b5563" />
            </TouchableOpacity>
            <View>
              <Text className="text-2xl font-bold text-gray-800">
                Fruit Report
              </Text>
              <Text className="text-gray-500 text-sm mt-1">30-Day Check</Text>
            </View>
          </View>

          <View className="flex-row items-center space-x-2">
            {autoSyncInProgress && (
              <View className="mr-2">
                <ActivityIndicator size="small" color="#059669" />
              </View>
            )}
            <TouchableOpacity
              onPress={onRefresh}
              disabled={refreshing || autoSyncInProgress}
              className="bg-gray-100 p-2 rounded-full mr-2"
            >
              <RefreshCw
                size={20}
                color={refreshing || autoSyncInProgress ? "#9ca3af" : "#059669"}
              />
            </TouchableOpacity>
            <View className="flex-row items-center bg-gray-100 px-3 py-1 rounded-full">
              {isOnline ? (
                <>
                  <Wifi size={16} color="#059669" />
                  <Text className="text-green-600 text-xs ml-1">Online</Text>
                </>
              ) : (
                <>
                  <WifiOff size={16} color="#6b7280" />
                  <Text className="text-gray-500 text-xs ml-1">Offline</Text>
                </>
              )}
            </View>
          </View>
        </View>
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
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
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={100}
        showsVerticalScrollIndicator={true}
      >
        <View className="bg-white rounded-xl p-6 shadow-sm">
          {/* Tree Description */}
          <View className="mb-4">
            <Text className="text-gray-700 font-medium mb-2">
              Tree Description
            </Text>
            <View className="flex-row items-center border border-gray-300 rounded-xl px-4 py-3 bg-gray-100">
              <TreePine size={18} color="#6b7280" />
              <Text className="text-gray-800 flex-1 ml-2">
                {tree?.description || "No tree description"}
              </Text>
            </View>
          </View>

          {/* Flower ID */}
          <View className="mb-6">
            <Text className="text-gray-700 font-medium mb-2">Flower ID</Text>
            <View className="flex-row items-center border border-gray-300 rounded-xl px-4 py-3 bg-gray-100">
              <Text className="text-gray-800 font-mono flex-1">
                FLOWER-
                {flowerData
                  ? getFlowerShortId(flowerData.id)
                  : getFlowerShortId(flowerId)}
              </Text>
            </View>
          </View>

          {/* Actual Flower Quantity */}
          <View className="mb-6">
            <Text className="text-gray-700 font-medium mb-2">
              Actual Flower Quantity
            </Text>
            <View className="flex-row items-center border border-gray-300 rounded-xl px-4 py-3 bg-gray-100">
              <Package size={18} color="#6b7280" />
              <Text className="text-gray-800 flex-1 ml-2">
                {flowerData?.quantity || 0} flower
                {flowerData?.quantity !== 1 ? "s" : ""}
              </Text>
            </View>
            <Text className="text-xs text-gray-500 mt-1">
              Number of flowers that were originally bagged
            </Text>
          </View>

          {/* Batch Number Dropdown */}
          <View className="mb-6">
            <Text className="text-gray-700 font-medium mb-2">
              Batch Number <Text className="text-red-500">*</Text>
            </Text>
            <TouchableOpacity
              onPress={() => setShowTagDropdown(!showTagDropdown)}
              className="flex-row items-center justify-between border border-gray-300 rounded-xl px-4 py-3 bg-white"
            >
              <View className="flex-row items-center">
                <Tag size={18} color="#6b7280" />
                <View
                  className={`ml-2 px-3 py-1 rounded-full ${getTagColor(selectedTagId)}`}
                >
                  <Text
                    className={`text-sm font-medium ${getTagTextColor(selectedTagId)}`}
                  >
                    {getTagLabel(selectedTagId)}
                  </Text>
                </View>
              </View>
              <ChevronDown size={18} color="#6b7280" />
            </TouchableOpacity>

            {showTagDropdown && (
              <View className="mt-1 border border-gray-200 rounded-xl bg-white overflow-hidden shadow-sm">
                {tagOptions.map((tag) => (
                  <TouchableOpacity
                    key={tag.id}
                    onPress={() => {
                      setSelectedTagId(tag.id);
                      setShowTagDropdown(false);
                    }}
                    className={`flex-row items-center px-4 py-3 ${selectedTagId === tag.id ? "bg-orange-50" : "bg-white"}`}
                  >
                    <View className={`px-3 py-1 rounded-full ${tag.color}`}>
                      <Text className={`text-sm font-medium ${tag.textColor}`}>
                        {tag.label}
                      </Text>
                    </View>
                    {selectedTagId === tag.id && (
                      <Text className="ml-auto text-orange-500 text-sm">✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Text className="text-xs text-gray-500 mt-1">
              Select which batch this fruit belongs to
            </Text>
          </View>

          {/* Photo Section */}
          <View className="mb-6">
            <Text className="text-gray-700 font-medium mb-2">Fruit Photo</Text>
            {imageUri ? (
              <View className="relative">
                <Image
                  source={{ uri: imageUri }}
                  className="w-full h-48 rounded-xl"
                  resizeMode="cover"
                />
                <TouchableOpacity
                  className="absolute top-2 right-2 bg-black/50 rounded-full p-2"
                  onPress={() => setImageUri("")}
                >
                  <X size={20} color="white" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                className="border-2 border-dashed border-gray-300 rounded-xl h-32 items-center justify-center bg-gray-50"
                onPress={handleTakePhoto}
              >
                <Camera size={32} color="#9ca3af" />
                <Text className="text-gray-500 mt-2">Take Fruit Photo</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Bagged Date */}
          <View className="mb-6">
            <Text className="text-gray-700 font-medium mb-2">Bagged Date</Text>
            <View className="border border-gray-300 rounded-xl px-4 py-3 bg-gray-50">
              <TextInput
                value={
                  fruit
                    ? new Date(fruit.bagged_at).toISOString().split("T")[0]
                    : new Date().toISOString().split("T")[0]
                }
                editable={false}
                className="text-gray-800"
              />
            </View>
          </View>

          {/* If may fruit na */}
          {fruit ? (
            <View>
              <View className="flex-row justify-between items-center mb-4">
                <View
                  className={`px-3 py-1 rounded-full flex-row items-center ${
                    fruit.is_synced ? "bg-green-100" : "bg-yellow-100"
                  }`}
                >
                  <View
                    className={`w-2 h-2 rounded-full mr-2 ${
                      fruit.is_synced ? "bg-green-500" : "bg-yellow-500"
                    }`}
                  />
                  <Text
                    className={`text-xs ${
                      fruit.is_synced ? "text-green-700" : "text-yellow-700"
                    }`}
                  >
                    {fruit.is_synced ? "Synced" : "Pending Sync"}
                  </Text>
                </View>

                {fruit.updated_at && (
                  <Text className="text-xs text-gray-400">
                    Updated: {new Date(fruit.updated_at).toLocaleDateString()}
                  </Text>
                )}
              </View>

              <View className="items-center mb-6">
                <View className="w-20 h-20 bg-green-100 rounded-full items-center justify-center mb-3">
                  <Package size={32} color="#059669" />
                </View>
                <Text className="text-xl font-bold text-gray-800">
                  {fruit.quantity} Fruit{fruit.quantity !== 1 ? "s" : ""}
                </Text>
                <View
                  className={`mt-2 px-3 py-1 rounded-full ${getTagColor(fruit.tag_id || 1)}`}
                >
                  <Text
                    className={`text-sm font-medium ${getTagTextColor(fruit.tag_id || 1)}`}
                  >
                    {getTagLabel(fruit.tag_id || 1)}
                  </Text>
                </View>
                <Text className="text-gray-500 text-sm mt-1">
                  Bagged: {new Date(fruit.bagged_at).toLocaleDateString()}
                </Text>
              </View>

              {/* Edit Quantity */}
              <View className="mb-6">
                <Text className="text-gray-700 font-medium mb-2">
                  Update Fruit Count
                </Text>
                <TextInput
                  className="border border-gray-300 rounded-xl px-4 py-3 bg-gray-50"
                  placeholder="Enter number of fruits"
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                />
              </View>

              {/* Update Button */}
              <TouchableOpacity
                className="bg-purple-600 py-4 rounded-xl mb-3"
                onPress={submitReport}
                disabled={submitting}
              >
                {submitting ? (
                  <View className="flex-row items-center justify-center">
                    <ActivityIndicator size="small" color="white" />
                    <Text className="text-white font-semibold ml-2">
                      Updating...
                    </Text>
                  </View>
                ) : (
                  <Text className="text-center font-semibold text-white">
                    Update Report
                  </Text>
                )}
              </TouchableOpacity>

              {/* Delete Button */}
              <TouchableOpacity
                className="bg-red-500 py-4 rounded-xl mb-3"
                onPress={() => {
                  Alert.alert(
                    "Delete Report",
                    "Are you sure you want to delete this fruit report?",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: async () => {
                          try {
                            setDeleting(true);
                            await FruitService.deleteFruit(fruit.id);
                            Toast.show({
                              type: "success",
                              text1: "Deleted",
                              text2: "Fruit report deleted successfully",
                            });
                            router.back();
                          } catch (error) {
                            Toast.show({
                              type: "error",
                              text1: "Failed",
                              text2: "Could not delete report",
                            });
                          } finally {
                            setDeleting(false);
                          }
                        },
                      },
                    ],
                  );
                }}
                disabled={deleting}
              >
                {deleting ? (
                  <View className="flex-row items-center justify-center">
                    <ActivityIndicator size="small" color="white" />
                    <Text className="text-white font-semibold ml-2">
                      Deleting...
                    </Text>
                  </View>
                ) : (
                  <Text className="text-center font-semibold text-white">
                    Delete Report
                  </Text>
                )}
              </TouchableOpacity>

              {/* Harvest Button */}
              {fruit && isFruitReadyForHarvest(fruit.bagged_at) ? (
                <TouchableOpacity
                  className="bg-green-600 py-4 rounded-xl"
                  onPress={handleHarvest}
                >
                  <Text className="text-center font-semibold text-white text-lg">
                    ✓ Harvest
                  </Text>
                </TouchableOpacity>
              ) : fruit && !isFruitReadyForHarvest(fruit.bagged_at) ? (
                <View className="bg-gray-300 py-4 rounded-xl">
                  <Text className="text-center font-semibold text-gray-500">
                    Not Yet Ready for Harvest
                  </Text>
                  <Text className="text-center text-xs text-gray-400 mt-1">
                    Fruits are ready after 115 days
                  </Text>
                </View>
              ) : null}
            </View>
          ) : (
            /* Wala pang fruit - form for new report */
            <View>
              <Text className="text-lg font-semibold text-gray-800 mb-2">
                New Fruit Report
              </Text>

              {/* Fruit Count */}
              <Text className="text-gray-700 font-medium mb-2">
                Number of Fruits
              </Text>
              <TextInput
                className="border border-gray-300 rounded-xl px-4 py-3 mb-6"
                placeholder="Enter fruit count"
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
              />

              {/* Submit Button */}
              <TouchableOpacity
                className="bg-purple-600 py-4 rounded-xl"
                onPress={submitReport}
                disabled={submitting}
              >
                {submitting ? (
                  <View className="flex-row items-center justify-center">
                    <ActivityIndicator size="small" color="white" />
                    <Text className="text-white font-semibold ml-2">
                      Saving...
                    </Text>
                  </View>
                ) : (
                  <Text className="text-center font-semibold text-white">
                    Submit Report
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAwareScrollView>

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

      <Toast />
    </View>
  );
}
