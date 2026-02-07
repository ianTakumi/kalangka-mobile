import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import Toast from "react-native-toast-message";
import {
  Leaf,
  MapPin,
  Clock,
  Tag,
  UploadCloud,
  QrCode,
  Plus,
  Edit2,
  Trash2,
  Flower,
  Camera as CameraIcon,
  Calendar,
  Package,
  X,
} from "lucide-react-native";
import { Flower as FlowerType } from "@/types/index";
import FlowerService from "@/services/FlowerService";
import * as MediaLibrary from "expo-media-library";
import { captureRef } from "react-native-view-shot";
import * as FileSystem from "expo-file-system/legacy";

export default function TreeInfoScreen() {
  const params = useLocalSearchParams();
  const treeData = params.treeData
    ? JSON.parse(params.treeData as string)
    : null;
  const qrCodeRef = useRef(null);
  const [showFlowerForm, setShowFlowerForm] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [flower, setFlower] = useState<FlowerType | null>(null);
  const [isEditingFlower, setIsEditingFlower] = useState(false);
  const [flowerForm, setFlowerForm] = useState({
    quantity: "1",
    wrapped_at: new Date(),
    image_url: "",
  });

  // Date input states
  const [dateInput, setDateInput] = useState("");
  const [timeInput, setTimeInput] = useState("");

  // Camera states
  const [facing, setFacing] = useState<CameraType>("back");
  const [showCamera, setShowCamera] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  // Create a string from the tree data for the QR code
  const qrCodeData = treeData
    ? JSON.stringify({
        id: treeData.id || treeData._id,
        description: treeData.description,
        image_path: treeData.image_path,
        is_synced: treeData.is_synced,
        coordinates: {
          latitude: treeData.latitude,
          longitude: treeData.longitude,
        },
        type: treeData.type,
        status: treeData.status,
        timestamp: treeData.created_at || new Date().toISOString(),
      })
    : "No tree data available";

  // Format date if available
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Format date for input (YYYY-MM-DD)
  const formatDateForInput = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Format time for input (HH:MM)
  const formatTimeForInput = (date) => {
    const d = new Date(date);
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  // Initialize date inputs
  useEffect(() => {
    if (showDateModal) {
      setDateInput(formatDateForInput(flowerForm.wrapped_at));
      setTimeInput(formatTimeForInput(flowerForm.wrapped_at));
    }
  }, [showDateModal]);

  // Request camera permissions
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const saveQRCodeToGallery = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();

      if (status !== "granted") {
        Toast.show({
          type: "error",
          text1: "Permission Denied",
          text2: "Storage permission is required to save QR code",
          position: "bottom",
        });
        return;
      }

      // Show loading toast
      Toast.show({
        type: "info",
        text1: "Saving QR Code",
        text2: "Please wait...",
        position: "bottom",
      });

      // Capture QR code as image
      const uri = await captureRef(qrCodeRef, {
        format: "png",
        quality: 1.0,
      });

      // Save directly to gallery - SIMPLIFIED VERSION
      await MediaLibrary.saveToLibraryAsync(uri);

      // Show success message
      Toast.show({
        type: "success",
        text1: "QR Code Saved!",
        text2: "QR code has been saved to your gallery",
        position: "bottom",
      });
    } catch (error) {
      console.error("Error saving QR code:", error);
      Toast.show({
        type: "error",
        text1: "Save Failed",
        text2: error.message || "Failed to save QR code. Please try again.",
        position: "bottom",
      });
    }
  };

  // Handle taking a picture with camera
  const takePicture = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Toast.show({
          type: "error",
          text1: "Camera permission required",
          text2: "Please enable camera access in settings",
          position: "bottom",
        });
        return;
      }
    }
    setShowCamera(true);
  };

  // Capture photo
  const capturePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          skipProcessing: false,
        });

        setFlowerForm({ ...flowerForm, image_url: photo.uri });
        setShowCamera(false);

        Toast.show({
          type: "success",
          text1: "Photo captured",
          text2: "Flower photo taken successfully",
          position: "bottom",
        });
      } catch (error) {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Failed to take photo",
          position: "bottom",
        });
      }
    }
  };

  // Save date from modal
  const saveDate = () => {
    if (!dateInput || !timeInput) {
      Toast.show({
        type: "error",
        text1: "Invalid date/time",
        text2: "Please enter both date and time",
        position: "bottom",
      });
      return;
    }

    try {
      const [year, month, day] = dateInput.split("-").map(Number);
      const [hours, minutes] = timeInput.split(":").map(Number);

      const newDate = new Date(year, month - 1, day, hours, minutes);

      if (isNaN(newDate.getTime())) {
        throw new Error("Invalid date");
      }

      setFlowerForm({ ...flowerForm, wrapped_at: newDate });
      setShowDateModal(false);

      Toast.show({
        type: "success",
        text1: "Date updated",
        text2: "Wrapped date/time saved successfully",
        position: "bottom",
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Invalid date/time",
        text2: "Please enter a valid date and time",
        position: "bottom",
      });
    }
  };

  const handleSaveFlower = async () => {
    if (!flowerForm.quantity || parseInt(flowerForm.quantity) <= 0) {
      Toast.show({
        type: "error",
        text1: "Invalid quantity",
        text2: "Please enter a valid quantity (greater than 0)",
        position: "bottom",
      });
      return;
    }

    try {
      // Ensure FlowerService is initialized
      await FlowerService.init();

      const newFlowerData: Omit<
        Flower,
        "id" | "created_at" | "updated_at" | "deleted_at"
      > = {
        tree_id: treeData?.id || treeData?._id || "",
        quantity: parseInt(flowerForm.quantity),
        wrapped_at: flowerForm.wrapped_at,
        image_url: flowerForm.image_url,
      };

      if (flower) {
        // Update existing flower
        await FlowerService.updateFlower(flower.id, newFlowerData);

        // Refresh flower data
        const updatedFlower = await FlowerService.getFlower(flower.id);
        setFlower(updatedFlower);

        Toast.show({
          type: "success",
          text1: "Flower updated",
          text2: "Flower information updated successfully",
          position: "bottom",
        });
      } else {
        // Create new flower
        const flowerId = await FlowerService.createFlower(newFlowerData);

        // Get the newly created flower
        const newFlower = await FlowerService.getFlower(flowerId);
        setFlower(newFlower);

        Toast.show({
          type: "success",
          text1: "Flower added",
          text2: "Flower information added successfully",
          position: "bottom",
        });
      }

      setIsEditingFlower(false);
      setShowFlowerForm(false);
    } catch (error) {
      console.error("Error saving flower:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to save flower. Please try again.",
        position: "bottom",
      });
    }
  };

  // Update the handleDeleteFlower function:
  const handleDeleteFlower = async () => {
    Alert.alert(
      "Delete Flower",
      "Are you sure you want to delete flower information?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              if (flower) {
                await FlowerService.deleteFlower(flower.id);
              }
              setFlower(null);
              Toast.show({
                type: "success",
                text1: "Flower deleted",
                text2: "Flower information removed successfully",
                position: "bottom",
              });
            } catch (error) {
              console.error("Error deleting flower:", error);
              Toast.show({
                type: "error",
                text1: "Error",
                text2: "Failed to delete flower. Please try again.",
                position: "bottom",
              });
            }
          },
        },
      ],
    );
  };

  useEffect(() => {
    const loadFlowerForTree = async () => {
      if (treeData?.id || treeData?._id) {
        try {
          await FlowerService.init();
          const treeId = treeData.id || treeData._id;
          const flowers = await FlowerService.getFlowersByTreeId(treeId);
          console.log(`Loaded flowers for tree ${treeId}:`, flowers);
          // Get the first flower (assuming one flower per tree)
          if (flowers.length > 0) {
            setFlower(flowers[0]);
          } else {
            setFlower(null);
          }
        } catch (error) {
          console.error("Error loading flower:", error);
        }
      }
    };

    loadFlowerForTree();
  }, [treeData?.id, treeData?._id]);

  // Reset form when editing starts
  useEffect(() => {
    if (flower && isEditingFlower) {
      setFlowerForm({
        quantity: flower.quantity.toString(),
        wrapped_at: new Date(flower.wrapped_at),
        image_url: flower.image_url,
      });
    } else if (!flower && showFlowerForm) {
      setFlowerForm({
        quantity: "1",
        wrapped_at: new Date(),
        image_url: "",
      });
    }
  }, [flower, isEditingFlower, showFlowerForm]);

  // Toggle camera facing
  const toggleCameraFacing = () => {
    setFacing((current) => (current === "back" ? "front" : "back"));
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <Stack.Screen
        options={{
          title: treeData?.description || "Tree Details",
          headerStyle: {
            backgroundColor: "#059669",
          },
          headerTintColor: "#fff",
        }}
      />

      {/* Camera View */}
      {showCamera && permission?.granted && (
        <View className="flex-1 absolute top-0 left-0 right-0 bottom-0 z-50">
          <CameraView
            ref={cameraRef}
            style={{ flex: 1 }}
            facing={facing}
            mode="picture"
          >
            <View className="flex-1 bg-transparent">
              {/* Camera Header */}
              <View className="flex-row justify-between items-center p-6 pt-12 bg-black/30">
                <TouchableOpacity
                  onPress={() => setShowCamera(false)}
                  className="p-2"
                >
                  <X size={24} color="#fff" />
                </TouchableOpacity>
                <Text className="text-white text-lg font-semibold">
                  Take Flower Photo
                </Text>
                <TouchableOpacity onPress={toggleCameraFacing} className="p-2">
                  <CameraIcon size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Camera Body */}
              <View className="flex-1 justify-center items-center">
                <View className="w-72 h-72 border-2 border-white/50 rounded-lg" />
              </View>

              {/* Camera Footer */}
              <View className="p-8 bg-black/30 justify-center items-center">
                <TouchableOpacity
                  onPress={capturePhoto}
                  className="w-20 h-20 bg-white rounded-full justify-center items-center border-4 border-white/30"
                >
                  <View className="w-16 h-16 bg-white rounded-full" />
                </TouchableOpacity>
              </View>
            </View>
          </CameraView>
        </View>
      )}

      {/* Date/Time Modal */}
      <Modal
        visible={showDateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDateModal(false)}
      >
        <View className="flex-1 justify-center bg-black/50 p-4">
          <View className="bg-white rounded-2xl p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-gray-900">
                Select Date & Time
              </Text>
              <TouchableOpacity onPress={() => setShowDateModal(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Date Input */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-1">
                Date (YYYY-MM-DD)
              </Text>
              <TextInput
                className="bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                value={dateInput}
                onChangeText={setDateInput}
                placeholder="2024-01-15"
                keyboardType="numbers-and-punctuation"
              />
              <Text className="text-xs text-gray-500 mt-1">
                Format: Year-Month-Day (e.g., 2024-01-15)
              </Text>
            </View>

            {/* Time Input */}
            <View className="mb-6">
              <Text className="text-sm font-medium text-gray-700 mb-1">
                Time (HH:MM)
              </Text>
              <TextInput
                className="bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                value={timeInput}
                onChangeText={setTimeInput}
                placeholder="14:30"
                keyboardType="numbers-and-punctuation"
              />
              <Text className="text-xs text-gray-500 mt-1">
                Format: 24-hour format (e.g., 14:30 for 2:30 PM)
              </Text>
            </View>

            {/* Current Date Preview */}
            <View className="mb-6 p-3 bg-gray-50 rounded-lg">
              <Text className="text-sm text-gray-600">
                Selected:{" "}
                {formatDateTime(new Date(`${dateInput}T${timeInput}`))}
              </Text>
            </View>

            {/* Modal Actions */}
            <View className="flex-row space-x-3">
              <TouchableOpacity
                onPress={() => setShowDateModal(false)}
                className="flex-1 bg-gray-100 py-3 rounded-lg items-center"
              >
                <Text className="text-gray-700 font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveDate}
                className="flex-1 bg-emerald-500 py-3 rounded-lg items-center"
              >
                <Text className="text-white font-medium">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Hero Section with Tree Image */}
        <View className="relative">
          {treeData?.image_path ? (
            <Image
              source={{ uri: treeData.image_path }}
              className="w-full h-72"
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-72 bg-gradient-to-b from-emerald-100 to-green-50 justify-center items-center">
              <Leaf size={80} color="#059669" />
              <Text className="text-gray-500 mt-4">No photo available</Text>
            </View>
          )}

          {/* Gradient overlay */}
          <View className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-gray-50 to-transparent" />
        </View>

        {/* Main Content Card */}
        <View className="px-4 -mt-8">
          <View className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            {/* Tree Title with Badge */}
            <View className="flex-row justify-between items-start mb-4">
              <View className="flex-1">
                <Text className="text-3xl font-bold text-gray-900">
                  {treeData?.description || "Unnamed Tree"}
                </Text>
                <View className="flex-row items-center mt-1">
                  <Tag size={16} color="#6b7280" />
                  <Text className="text-gray-600 ml-2">
                    {treeData?.type || "Unknown Type"}
                  </Text>
                </View>
              </View>

              {/* Status Badge */}
              <View
                className={`px-3 py-1 rounded-full ${treeData?.status === "Healthy" ? "bg-green-100" : "bg-amber-100"}`}
              >
                <Text
                  className={`font-semibold ${treeData?.status === "Healthy" ? "text-green-800" : "text-amber-800"}`}
                >
                  {treeData?.status || "Unknown"}
                </Text>
              </View>
            </View>

            {/* Divider */}
            <View className="h-px bg-gray-200 my-4" />

            {/* Info Grid */}
            <View className="gap-4">
              {/* Coordinates */}
              <View className="flex-row items-start">
                <View className="bg-emerald-50 p-2 rounded-lg mr-3">
                  <MapPin size={20} color="#059669" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm text-gray-500 mb-1">Location</Text>
                  <Text className="text-gray-900 font-medium">
                    {treeData?.coordinates?.latitude.toFixed(6)},{" "}
                    {treeData?.coordinates?.longitude.toFixed(6)}
                  </Text>
                  <Text className="text-xs text-gray-400 mt-1">
                    GPS Coordinates
                  </Text>
                </View>
              </View>

              {/* Sync Status */}
              <View className="flex-row items-start">
                <View
                  className={`p-2 rounded-lg mr-3 ${treeData?.is_synced ? "bg-green-50" : "bg-amber-50"}`}
                >
                  {treeData?.is_synced ? (
                    <UploadCloud size={20} color="#059669" />
                  ) : (
                    <Clock size={20} color="#d97706" />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-sm text-gray-500 mb-1">
                    Sync Status
                  </Text>
                  <Text
                    className={`font-medium ${treeData?.is_synced ? "text-green-700" : "text-amber-700"}`}
                  >
                    {treeData?.is_synced ? "Synced to Cloud" : "Pending Sync"}
                  </Text>
                  <Text className="text-xs text-gray-400 mt-1">
                    {treeData?.is_synced
                      ? "Data uploaded successfully"
                      : "Local data only"}
                  </Text>
                </View>
              </View>

              {/* Date Added */}
              {treeData?.created_at && (
                <View className="flex-row items-start">
                  <View className="bg-purple-50 p-2 rounded-lg mr-3">
                    <Clock size={20} color="#8b5cf6" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm text-gray-500 mb-1">
                      Date Added
                    </Text>
                    <Text className="text-gray-900 font-medium">
                      {formatDate(treeData.created_at)}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Flower Section */}
          <View className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-row items-center">
                <View className="bg-pink-50 p-2 rounded-lg mr-3">
                  <Flower size={24} color="#db2777" />
                </View>
                <View>
                  <Text className="text-xl font-bold text-gray-900">
                    Flower Information
                  </Text>
                  <Text className="text-gray-500">
                    {flower ? "Flower details" : "No flower added yet"}
                  </Text>
                </View>
              </View>

              {flower ? (
                <TouchableOpacity
                  onPress={() => setIsEditingFlower(true)}
                  className="flex-row items-center bg-emerald-50 px-3 py-2 rounded-lg"
                >
                  <Edit2 size={16} color="#059669" />
                  <Text className="text-emerald-700 font-medium ml-2">
                    Edit
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => setShowFlowerForm(true)}
                  className="flex-row items-center bg-emerald-500 px-3 py-2 rounded-lg"
                >
                  <Plus size={16} color="#fff" />
                  <Text className="text-white font-medium ml-2">
                    Add Flower
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {flower ? (
              <View>
                {!isEditingFlower ? (
                  <View className="bg-gray-50 rounded-xl p-4">
                    <View className="flex-row items-center mb-3">
                      <Package size={20} color="#6b7280" />
                      <Text className="text-gray-900 font-medium ml-2">
                        Quantity: {flower.quantity}
                      </Text>
                    </View>

                    <View className="flex-row items-center mb-3">
                      <Calendar size={20} color="#6b7280" />
                      <Text className="text-gray-900 font-medium ml-2">
                        Wrapped: {formatDateTime(flower.wrapped_at)}
                      </Text>
                    </View>

                    {flower.image_url ? (
                      <View className="mt-4">
                        <Text className="text-sm font-medium text-gray-700 mb-2">
                          Flower Image
                        </Text>
                        <Image
                          source={{ uri: flower.image_url }}
                          className="w-full h-48 rounded-lg"
                          resizeMode="cover"
                        />
                      </View>
                    ) : (
                      <View className="mt-4 p-4 bg-gray-100 rounded-lg items-center">
                        <CameraIcon size={32} color="#9ca3af" />
                        <Text className="text-gray-500 mt-2">
                          No image available
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity
                      onPress={handleDeleteFlower}
                      className="flex-row items-center justify-center mt-6 py-3 bg-red-50 rounded-lg"
                    >
                      <Trash2 size={18} color="#dc2626" />
                      <Text className="text-red-600 font-medium ml-2">
                        Delete Flower
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View className="bg-gray-50 rounded-xl p-4">
                    {/* Flower Form */}
                    <Text className="text-lg font-bold text-gray-900 mb-4">
                      Edit Flower Information
                    </Text>

                    {/* Quantity Input */}
                    <View className="mb-4">
                      <Text className="text-sm font-medium text-gray-700 mb-1">
                        Quantity
                      </Text>
                      <TextInput
                        className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                        value={flowerForm.quantity}
                        onChangeText={(text) =>
                          setFlowerForm({ ...flowerForm, quantity: text })
                        }
                        placeholder="Enter quantity"
                        keyboardType="numeric"
                      />
                    </View>

                    {/* Date Picker */}
                    <View className="mb-4">
                      <Text className="text-sm font-medium text-gray-700 mb-1">
                        Wrapped Date & Time
                      </Text>
                      <TouchableOpacity
                        onPress={() => setShowDateModal(true)}
                        className="bg-white border border-gray-300 rounded-lg px-4 py-3 flex-row items-center"
                      >
                        <Calendar size={20} color="#6b7280" />
                        <Text className="text-gray-900 ml-2">
                          {formatDateTime(flowerForm.wrapped_at)}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Take Photo Button */}
                    <View className="mb-6">
                      <Text className="text-sm font-medium text-gray-700 mb-1">
                        Flower Image
                      </Text>
                      {flowerForm.image_url ? (
                        <>
                          <Image
                            source={{ uri: flowerForm.image_url }}
                            className="w-full h-48 rounded-lg mb-3"
                            resizeMode="cover"
                          />
                          <TouchableOpacity
                            onPress={takePicture}
                            className="bg-emerald-50 py-3 rounded-lg items-center"
                          >
                            <Text className="text-emerald-700 font-medium">
                              Take New Photo
                            </Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <TouchableOpacity
                          onPress={takePicture}
                          className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 items-center"
                        >
                          <CameraIcon size={32} color="#9ca3af" />
                          <Text className="text-gray-500 mt-2">
                            Tap to take photo
                          </Text>
                          <Text className="text-gray-400 text-sm mt-1">
                            Recommended: 4:3 ratio
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Form Actions */}
                    <View className="flex-row space-x-3">
                      <TouchableOpacity
                        onPress={() => {
                          setIsEditingFlower(false);
                          Toast.show({
                            type: "info",
                            text1: "Cancelled",
                            text2: "Changes discarded",
                          });
                        }}
                        className="flex-1 bg-gray-100 py-3 rounded-lg items-center"
                      >
                        <Text className="text-gray-700 font-medium">
                          Cancel
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleSaveFlower}
                        className="flex-1 bg-emerald-500 py-3 rounded-lg items-center"
                      >
                        <Text className="text-white font-medium">Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            ) : showFlowerForm ? (
              <View className="bg-gray-50 rounded-xl p-4">
                {/* Add Flower Form */}
                <Text className="text-lg font-bold text-gray-900 mb-4">
                  Add Flower Information
                </Text>

                {/* Quantity Input */}
                <View className="mb-4">
                  <Text className="text-sm font-medium text-gray-700 mb-1">
                    Quantity
                  </Text>
                  <TextInput
                    className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                    value={flowerForm.quantity}
                    onChangeText={(text) =>
                      setFlowerForm({ ...flowerForm, quantity: text })
                    }
                    placeholder="Enter quantity"
                    keyboardType="numeric"
                  />
                </View>

                {/* Date Picker */}
                <View className="mb-4">
                  <Text className="text-sm font-medium text-gray-700 mb-1">
                    Wrapped Date & Time
                  </Text>
                  {/* <TouchableOpacity
                    onPress={() => setShowDateModal(true)}
                    className="bg-white border border-gray-300 rounded-lg px-4 py-3 flex-row items-center"
                  > */}
                  <View className="bg-white border border-gray-300 rounded-lg px-4 py-3 flex-row items-center">
                    <Calendar size={20} color="#6b7280" />
                    <Text className="text-gray-900 ml-2">
                      {formatDateTime(flowerForm.wrapped_at)}
                    </Text>
                  </View>

                  {/* </TouchableOpacity> */}
                </View>

                {/* Take Photo Button */}
                <View className="mb-6">
                  <Text className="text-sm font-medium text-gray-700 mb-1">
                    Flower Image
                  </Text>
                  {flowerForm.image_url ? (
                    <>
                      <Image
                        source={{ uri: flowerForm.image_url }}
                        className="w-full h-48 rounded-lg mb-3"
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        onPress={takePicture}
                        className="bg-emerald-50 py-3 rounded-lg items-center"
                      >
                        <Text className="text-emerald-700 font-medium">
                          Take New Photo
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      onPress={takePicture}
                      className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 items-center"
                    >
                      <CameraIcon size={32} color="#9ca3af" />
                      <Text className="text-gray-500 mt-2">
                        Tap to take photo
                      </Text>
                      <Text className="text-gray-400 text-sm mt-1">
                        Recommended: 4:3 ratio
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Form Actions */}
                <View className="flex-row space-x-3">
                  <TouchableOpacity
                    onPress={() => {
                      setShowFlowerForm(false);
                      Toast.show({
                        type: "info",
                        text1: "Cancelled",
                        text2: "Flower addition cancelled",
                        position: "bottom",
                      });
                    }}
                    className="flex-1 bg-gray-100 py-3 rounded-lg items-center"
                  >
                    <Text className="text-gray-700 font-medium">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSaveFlower}
                    className="flex-1 bg-emerald-500 py-3 rounded-lg items-center"
                  >
                    <Text className="text-white font-medium">Add Flower</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowFlowerForm(true)}
                className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-8 items-center"
              >
                <Plus size={48} color="#9ca3af" />
                <Text className="text-gray-500 mt-4 text-lg font-medium">
                  Add Flower Information
                </Text>
                <Text className="text-gray-400 text-center mt-2">
                  Record the flower quantity, wrapping date, and take a photo
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* QR Code Card */}
          {treeData && (
            <View className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <View className="flex-row items-center mb-4">
                <View className="bg-emerald-50 p-2 rounded-lg mr-3">
                  <QrCode size={24} color="#059669" />
                </View>
                <View>
                  <Text className="text-xl font-bold text-gray-900">
                    Tree QR Code
                  </Text>
                  <Text className="text-gray-500">
                    Scan to view tree information
                  </Text>
                </View>
              </View>

              <View className="items-center p-4 bg-gray-50 rounded-xl">
                <View
                  ref={qrCodeRef}
                  className="bg-white p-4 rounded-lg shadow-sm"
                >
                  <QRCode
                    value={qrCodeData}
                    size={180}
                    color="#059669"
                    backgroundColor="white"
                    quietZone={8}
                    ecl="H"
                  />
                  <Text className="mt-2 text-gray-800 font-medium text-center">
                    {treeData.description}
                  </Text>
                </View>

                <Text className="text-center text-gray-600 mt-4 px-4">
                  Use this QR code for quick identification
                </Text>

                {/* Quick Actions */}
                <View className="flex-row mt-6 space-x-3">
                  <TouchableOpacity
                    className="flex-1 bg-emerald-50 py-3 rounded-lg items-center"
                    onPress={saveQRCodeToGallery}
                  >
                    <Text className="text-emerald-700 font-semibold">
                      Save QR
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Debug Section - Collapsible */}
          {__DEV__ && treeData && (
            <View className="bg-gray-50 rounded-2xl p-4 mb-6 border border-gray-200">
              <Text className="text-sm font-medium text-gray-500 mb-2">
                Debug Information
              </Text>
              <ScrollView horizontal className="bg-white rounded-lg p-3">
                <Text className="text-xs font-mono text-gray-600">
                  {JSON.stringify(treeData, null, 2)}
                </Text>
              </ScrollView>
            </View>
          )}
        </View>

        {/* Bottom Padding */}
        <View className="h-20" />
      </ScrollView>

      {/* Toast Component */}
      <Toast />
    </SafeAreaView>
  );
}
