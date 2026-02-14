// app/admin/fruit-report.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  TextInput,
  Modal,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import FruitService from "@/services/FruitService";
import TreeService from "@/services/treeService";
import Toast from "react-native-toast-message";
import { Fruit, Tree } from "@/types/index";
import {
  ArrowLeft,
  Calendar,
  Package,
  TreePine,
  Camera,
  X,
  Wifi,
  WifiOff,
} from "lucide-react-native";
import FruitCamera from "@/components/FruitCamera";
import * as FileSystem from "expo-file-system/legacy";
import NetInfo from "@react-native-community/netinfo";

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

  const [fruit, setFruit] = useState<Fruit | null>(null);
  const [tree, setTree] = useState<Tree | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [imageUri, setImageUri] = useState<string>("");
  const [cameraVisible, setCameraVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    ensureImagesDirExists();
    loadData();
  }, [flowerId]);

  // Add this useEffect to sync all fruits when online
  useEffect(() => {
    const syncAllFruitsWhenOnline = async () => {
      if (isOnline) {
        console.log("📱 Device is online, syncing all fruits...");
        try {
          // Check if there are any unsynced fruits
          const unsyncedFruits = await FruitService.getUnsyncedFruits();

          if (unsyncedFruits.length > 0) {
            Toast.show({
              type: "info",
              text1: "Syncing",
              text2: `Syncing ${unsyncedFruits.length} fruit(s) to server...`,
            });

            await FruitService.syncAll();

            // Reload the current fruit if it exists to update sync status
            if (fruit) {
              const updatedFruits = await FruitService.getFruitsByFlowerId(
                flowerId,
                false,
              );
              if (updatedFruits && updatedFruits.length > 0) {
                setFruit(updatedFruits[0]);
                setQuantity(updatedFruits[0].quantity.toString());
                setImageUri(updatedFruits[0].image_uri || "");
              }
            }

            Toast.show({
              type: "success",
              text1: "Sync Complete",
              text2: `${unsyncedFruits.length} fruit(s) synchronized successfully`,
            });
          } else {
            console.log("✅ All fruits are already synced");
          }
        } catch (error) {
          console.error("Error syncing fruits when online:", error);
          Toast.show({
            type: "error",
            text1: "Sync Failed",
            text2: "Could not sync fruits to server",
          });
        }
      }
    };

    syncAllFruitsWhenOnline();
  }, [isOnline]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Fetch tree details using tree_id from flowerData
      if (flowerData?.tree_id) {
        const treeData = await TreeService.getTree(flowerData.tree_id);
        setTree(treeData);
      }

      // Fetch fruit if exists
      const fruits = await FruitService.getFruitsByFlowerId(flowerId, false);
      if (fruits && fruits.length > 0) {
        setFruit(fruits[0]);
        setQuantity(fruits[0].quantity.toString());
        setImageUri(fruits[0].image_uri || "");
      }
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

  const getFlowerShortId = (id: string) => {
    return id.substring(0, 6).toUpperCase();
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
        // Update existing fruit quantity and image
        await FruitService.updateFruit(fruit.id, {
          ...fruit,
          quantity: parseInt(quantity),
          image_uri: imageUri || fruit.image_uri,
        });
      } else {
        // Create new fruit with image
        await FruitService.createFruit({
          flower_id: flowerId,
          tree_id: flowerData?.tree_id,
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
    Alert.alert("Harvest", "Have you harvested these fruits?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes",
        onPress: async () => {
          Toast.show({
            type: "success",
            text1: "Harvested!",
            text2: "Fruits marked as harvested",
          });
          router.back();
        },
      },
    ]);
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

          {/* Online/Offline Status */}
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

      <ScrollView className="flex-1 p-4">
        <View className="bg-white rounded-xl p-6 shadow-sm">
          {/* Readonly Tree Description Input */}
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

          {/* Readonly Flower ID Input */}
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
              <View className="flex-row justify-end mb-2">
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
              </View>

              <View className="items-center mb-6">
                <View className="w-20 h-20 bg-green-100 rounded-full items-center justify-center mb-3">
                  <Package size={32} color="#059669" />
                </View>
                <Text className="text-xl font-bold text-gray-800">
                  {fruit.quantity} Fruit{fruit.quantity !== 1 ? "s" : ""}
                </Text>
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
              <TouchableOpacity
                className="bg-green-600 py-4 rounded-xl"
                onPress={handleHarvest}
              >
                <Text className="text-center font-semibold text-white text-lg">
                  ✓ Harvest
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Wala pang fruit - form for new report */
            <View>
              <Text className="text-lg font-semibold text-gray-800 mb-2">
                New Fruit Report
              </Text>
              <Text className="text-sm text-gray-500 mb-6">
                It's been 30 days. How many fruits developed?
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
      </ScrollView>

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
