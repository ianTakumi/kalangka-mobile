import TreeService from "@/services/treeService";
import { Flower as FlowerType } from "@/types/index";
import { CameraType, CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { GoogleMaps } from "expo-maps";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertCircle,
  ArrowLeft,
  Camera as CameraIcon,
  Clock,
  Flower,
  Leaf,
  Locate,
  MapPin,
  Navigation,
  Plus,
  QrCode,
  Tag,
  UploadCloud,
  X,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { captureRef } from "react-native-view-shot";

// Constants
const DAYS_UNTIL_REVIEW = 120;

// Types
interface TreeData {
  id?: string;
  _id?: string;
  description?: string;
  type?: string;
  status?: string;
  image_path?: string;
  latitude?: number;
  longitude?: number;
  created_at?: string;
  is_synced?: boolean;
}

interface FlowerFormData {
  quantity: string;
  wrapped_at: Date;
  image_url: string;
}

export default function TreeInfoScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();

  // Tree data states
  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get tree ID from params
  const treeId =
    (params.treeData?.startsWith?.("{")
      ? JSON.parse(params.treeData as string).id
      : params.treeData) ||
    params.treeId ||
    params.id;

  // Refs
  const qrCodeRef = useRef(null);
  const mapRef = useRef<any>(null);
  const cameraRef = useRef(null);

  // Flower states
  const [flower, setFlower] = useState<FlowerType | null>(null);
  const [flowerCount, setFlowerCount] = useState(0);
  const [showFlowerForm, setShowFlowerForm] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [isEditingFlower, setIsEditingFlower] = useState(false);
  const [flowerForm, setFlowerForm] = useState<FlowerFormData>({
    quantity: "1",
    wrapped_at: new Date(),
    image_url: "",
  });

  // Date input states
  const [dateInput, setDateInput] = useState("");
  const [timeInput, setTimeInput] = useState("");

  // Location states
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [distance, setDistance] = useState<string | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Camera states
  const [facing, setFacing] = useState<CameraType>("back");
  const [showCamera, setShowCamera] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  // Map position
  const [initialPosition, setInitialPosition] = useState({
    coordinates: {
      latitude: 14.5995,
      longitude: 120.9842,
    },
    zoom: 18,
  });

  // Load tree data
  useEffect(() => {
    const loadTreeData = async () => {
      if (!treeId) {
        if (params.treeData && typeof params.treeData === "string") {
          try {
            const parsed = JSON.parse(params.treeData);
            setTreeData(parsed);
            setLoading(false);
            return;
          } catch (e) {
            console.error("Failed to parse treeData:", e);
          }
        }
        setError("No tree ID provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        await TreeService.init();
        const tree = await TreeService.getTreeById(treeId as string);

        if (tree) {
          setTreeData(tree);
          if (tree.latitude && tree.longitude) {
            setInitialPosition({
              coordinates: {
                latitude: tree.latitude,
                longitude: tree.longitude,
              },
              zoom: 18,
            });
          }
        } else {
          setError("Tree not found in local database");
        }
      } catch (err: any) {
        console.error("Error loading tree:", err);
        setError(err.message || "Failed to load tree details");
      } finally {
        setLoading(false);
      }
    };

    loadTreeData();
  }, [treeId]);

  // Load flower data
  useEffect(() => {
    const loadFlowerForTree = async () => {
      const treeIdToUse = treeData?.id || treeData?._id;
      if (!treeIdToUse) return;

      try {
        const FlowerService = (await import("@/services/FlowerService"))
          .default;
        await FlowerService.init();
        const flowers = await FlowerService.getFlowersByTreeId(treeIdToUse);
        setFlowerCount(flowers.length);
        setFlower(flowers[0] || null);
      } catch (error) {
        console.error("Error loading flower:", error);
      }
    };

    if (treeData) loadFlowerForTree();
  }, [treeData]);

  // Calculate distance
  useEffect(() => {
    const calculateDistance = async () => {
      if (!treeData?.latitude || !treeData?.longitude) return;
      const distanceText = await TreeService.getTreeDistance(
        treeData.latitude,
        treeData.longitude,
      );
      setDistance(distanceText);
    };

    if (treeData?.latitude && treeData?.longitude) calculateDistance();
  }, [treeData]);

  // Request permissions
  useEffect(() => {
    const requestLocationPermission = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setLocation(currentLocation);
        }
      } catch (error) {
        console.error("Location permission error:", error);
      }
    };

    requestLocationPermission();
  }, []);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission]);

  // Initialize date inputs
  useEffect(() => {
    if (showDateModal) {
      setDateInput(formatDateForInput(flowerForm.wrapped_at));
      setTimeInput(formatTimeForInput(flowerForm.wrapped_at));
    }
  }, [showDateModal]);

  // Reset form when editing
  useEffect(() => {
    if (flower && isEditingFlower) {
      setFlowerForm({
        quantity: flower.quantity.toString(),
        wrapped_at: new Date(flower.wrapped_at),
        image_url: flower.image_url || "",
      });
    } else if (!flower && showFlowerForm) {
      setFlowerForm({
        quantity: "1",
        wrapped_at: new Date(),
        image_url: "",
      });
    }
  }, [flower, isEditingFlower, showFlowerForm]);

  // Helper functions
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (date: Date | string) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateForInput = (date: Date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const formatTimeForInput = (date: Date) => {
    const d = new Date(date);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const getUserLocation = async () => {
    try {
      setGettingLocation(true);
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation(currentLocation);
    } catch (error) {
      console.error("Error getting location:", error);
      Toast.show({
        type: "error",
        text1: "Location Error",
        text2: "Failed to get your current location",
      });
    } finally {
      setGettingLocation(false);
    }
  };

  const centerOnTree = () => {
    if (mapRef.current && treeData?.latitude && treeData?.longitude) {
      mapRef.current.setCameraPosition({
        coordinates: {
          latitude: treeData.latitude,
          longitude: treeData.longitude,
        },
        zoom: 18,
      });
      Toast.show({
        type: "success",
        text1: "Centered on Tree",
        text2: "Map centered on tree location",
      });
    }
  };

  const centerOnUser = () => {
    if (location && mapRef.current) {
      mapRef.current.setCameraPosition({
        coordinates: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
        zoom: 16,
      });
    } else {
      getUserLocation();
    }
  };

  const saveQRCodeToGallery = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Toast.show({
          type: "error",
          text1: "Permission Denied",
          text2: "Storage permission is required to save QR code",
        });
        return;
      }

      Toast.show({
        type: "info",
        text1: "Saving QR Code",
        text2: "Please wait...",
      });

      const uri = await captureRef(qrCodeRef, { format: "png", quality: 1.0 });
      await MediaLibrary.saveToLibraryAsync(uri);

      Toast.show({
        type: "success",
        text1: "QR Code Saved!",
        text2: "QR code has been saved to your gallery",
      });
    } catch (error: any) {
      console.error("Error saving QR code:", error);
      Toast.show({
        type: "error",
        text1: "Save Failed",
        text2: error.message || "Failed to save QR code",
      });
    }
  };

  const capturePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await (cameraRef.current as any).takePictureAsync({
          quality: 0.8,
          skipProcessing: false,
        });
        setFlowerForm({ ...flowerForm, image_url: photo.uri });
        setShowCamera(false);
        Toast.show({
          type: "success",
          text1: "Photo captured",
          text2: "Flower photo taken successfully",
        });
      } catch (error) {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Failed to take photo",
        });
      }
    }
  };

  const saveDate = () => {
    if (!dateInput || !timeInput) {
      Toast.show({
        type: "error",
        text1: "Invalid date/time",
        text2: "Please enter both date and time",
      });
      return;
    }

    try {
      const [year, month, day] = dateInput.split("-").map(Number);
      const [hours, minutes] = timeInput.split(":").map(Number);
      const newDate = new Date(year, month - 1, day, hours, minutes);

      if (isNaN(newDate.getTime())) throw new Error("Invalid date");

      setFlowerForm({ ...flowerForm, wrapped_at: newDate });
      setShowDateModal(false);
      Toast.show({
        type: "success",
        text1: "Date updated",
        text2: "Wrapped date/time saved successfully",
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Invalid date/time",
        text2: "Please enter a valid date and time",
      });
    }
  };

  const toggleCameraFacing = () => {
    setFacing((current) => (current === "back" ? "front" : "back"));
  };

  const calculateDaysRemaining = (wrappedDate: Date) => {
    if (!wrappedDate) return 0;
    const dueDate = new Date(wrappedDate);
    dueDate.setDate(dueDate.getDate() + DAYS_UNTIL_REVIEW);
    const diffDays = Math.ceil(
      (dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
    );
    return diffDays;
  };

  const renderDaysRemaining = (wrappedDate: Date) => {
    const daysRemaining = calculateDaysRemaining(wrappedDate);
    let bgColor = "bg-emerald-50";
    let textColor = "text-emerald-700";
    let borderColor = "border-emerald-200";
    let statusText = "On Track";

    if (daysRemaining <= 30) {
      bgColor = "bg-amber-50";
      textColor = "text-amber-700";
      borderColor = "border-amber-200";
      statusText = "Approaching Review";
    }
    if (daysRemaining <= 7) {
      bgColor = "bg-red-50";
      textColor = "text-red-700";
      borderColor = "border-red-200";
      statusText = "Review Soon";
    }
    if (daysRemaining <= 0) {
      bgColor = "bg-red-100";
      textColor = "text-red-800";
      borderColor = "border-red-300";
      statusText = "Overdue for Review";
    }

    return (
      <View className={`${bgColor} border ${borderColor} rounded-lg p-3`}>
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center">
            <Clock
              size={16}
              color={
                textColor.includes("red")
                  ? "#dc2626"
                  : textColor.includes("amber")
                    ? "#f59e0b"
                    : "#059669"
              }
            />
            <Text className={`${textColor} font-medium ml-2`}>
              {statusText}
            </Text>
          </View>
          <Text className={`${textColor} font-bold`}>
            {daysRemaining <= 0 ? "OVERDUE" : `${daysRemaining} days remaining`}
          </Text>
        </View>
        <Text className={`${textColor} text-sm mt-1`}>
          {daysRemaining > 0
            ? `Review due in ${daysRemaining} days`
            : "Please review with farmers immediately"}
        </Text>
      </View>
    );
  };

  // Map marker
  const treeMarker =
    treeData?.latitude && treeData?.longitude
      ? [
          {
            id: treeData.id || treeData._id || "tree-marker",
            coordinates: {
              latitude: treeData.latitude,
              longitude: treeData.longitude,
            },
            title: treeData.description || "Tree",
            snippet: `Type: ${treeData.type || "Unknown"}`,
            color: "green",
            icon: {
              url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
            },
          },
        ]
      : [];

  const userLocation = location
    ? {
        coordinates: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
      }
    : undefined;

  const qrCodeData = treeData?.id || treeData?._id || "";

  // Loading state
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 justify-center items-center">
        <ActivityIndicator size="large" color="#059669" />
        <Text className="mt-4 text-gray-600">Loading tree details...</Text>
      </SafeAreaView>
    );
  }

  // Error state
  if (error || !treeData) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 justify-center items-center p-4">
        <View className="bg-red-50 rounded-2xl p-6 items-center max-w-sm">
          <AlertCircle size={48} color="#dc2626" />
          <Text className="text-red-600 text-lg font-semibold mt-4 text-center">
            {error || "Tree not found"}
          </Text>
          <Text className="text-gray-500 text-center mt-2">
            The tree you're looking for might not have been synced yet.
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="mt-6 bg-emerald-500 px-6 py-3 rounded-xl"
          >
            <Text className="text-white font-medium">Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Main Android UI
  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white pt-4 pb-2 px-4 flex-row items-center border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full items-center justify-center bg-gray-100"
        >
          <ArrowLeft size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-xl font-semibold text-gray-800 mr-10">
          Tree Details
        </Text>
      </View>

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
              <View className="flex-1 justify-center items-center">
                <View className="w-72 h-72 border-2 border-white/50 rounded-lg" />
              </View>
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
        transparent
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

            <View className="mb-6 p-3 bg-gray-50 rounded-lg">
              <Text className="text-sm text-gray-600">
                Selected:{" "}
                {formatDateTime(new Date(`${dateInput}T${timeInput}`))}
              </Text>
            </View>

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

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View className="relative">
          {treeData.image_path ? (
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
          <View className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-gray-50 to-transparent" />
        </View>

        <View className="px-4 -mt-8">
          {/* Tree Details */}
          <View className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <View className="flex-row justify-between items-start mb-4">
              <View className="flex-1">
                <Text className="text-3xl font-bold text-gray-900">
                  {treeData.description || "Unnamed Tree"}
                </Text>
                <View className="flex-row items-center mt-1">
                  <Tag size={16} color="#6b7280" />
                  <Text className="text-gray-600 ml-2">
                    {treeData.type || "Unknown Type"}
                  </Text>
                </View>
              </View>
              <View
                className={`px-3 py-1 rounded-full ${treeData.status === "active" ? "bg-green-100" : "bg-red-100"}`}
              >
                <Text
                  className={`font-semibold ${treeData.status === "active" ? "text-green-800" : "text-red-800"}`}
                >
                  {treeData.status
                    ? treeData.status.charAt(0).toUpperCase() +
                      treeData.status.slice(1).toLowerCase()
                    : "Unknown"}
                </Text>
              </View>
            </View>

            <View className="h-px bg-gray-200 my-4" />

            <View className="gap-4">
              <View className="flex-row items-start">
                <View className="bg-emerald-50 p-2 rounded-lg mr-3">
                  <MapPin size={20} color="#059669" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm text-gray-500 mb-1">Location</Text>
                  {distance ? (
                    <>
                      <Text className="text-gray-900 font-medium text-lg">
                        {distance}
                      </Text>
                      <Text className="text-xs text-gray-400 mt-1">
                        from your current location
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text className="text-gray-900 font-medium">
                        Location available
                      </Text>
                      <Text className="text-xs text-gray-400 mt-1">
                        Enable location to see distance
                      </Text>
                    </>
                  )}
                </View>
              </View>

              <View className="flex-row items-start">
                <View
                  className={`p-2 rounded-lg mr-3 ${treeData.is_synced ? "bg-green-50" : "bg-amber-50"}`}
                >
                  {treeData.is_synced ? (
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
                    className={`font-medium ${treeData.is_synced ? "text-green-700" : "text-amber-700"}`}
                  >
                    {treeData.is_synced ? "Synced to Cloud" : "Pending Sync"}
                  </Text>
                  <Text className="text-xs text-gray-400 mt-1">
                    {treeData.is_synced
                      ? "Data uploaded successfully"
                      : "Local data only"}
                  </Text>
                </View>
              </View>

              {treeData.created_at && (
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

          {/* Map Section */}
          <View className="bg-white rounded-2xl shadow-lg p-6 mb-6 overflow-hidden">
            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-row items-center">
                <View className="bg-emerald-50 p-2 rounded-lg mr-3">
                  <MapPin size={24} color="#059669" />
                </View>
                <View>
                  <Text className="text-xl font-bold text-gray-900">
                    Tree Location
                  </Text>
                  <Text className="text-gray-500">{distance}</Text>
                </View>
              </View>
              <View className="flex-row">
                <TouchableOpacity
                  onPress={centerOnTree}
                  className="bg-emerald-50 p-2 rounded-lg mr-2"
                >
                  <Navigation size={20} color="#059669" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={centerOnUser}
                  className="bg-blue-50 p-2 rounded-lg"
                  disabled={gettingLocation}
                >
                  {gettingLocation ? (
                    <ActivityIndicator size="small" color="#3b82f6" />
                  ) : (
                    <Locate
                      size={20}
                      color={location ? "#3b82f6" : "#9ca3af"}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View className="h-64 rounded-xl overflow-hidden border border-gray-200">
              {mapError ? (
                <View className="flex-1 justify-center items-center bg-gray-100">
                  <Text className="text-red-500 text-center px-4">
                    {mapError}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setMapError(null)}
                    className="mt-2 bg-emerald-500 px-4 py-2 rounded-lg"
                  >
                    <Text className="text-white">Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <GoogleMaps.View
                  ref={mapRef}
                  style={{ flex: 1 }}
                  cameraPosition={initialPosition}
                  markers={treeMarker}
                  userLocation={userLocation}
                  properties={{
                    isMyLocationEnabled: true,
                    compassEnabled: true,
                    zoomControlsEnabled: true,
                    indoorLevelPickerEnabled: false,
                    mapToolbarEnabled: false,
                  }}
                  onMapReady={() => setMapError(null)}
                  onMapLoadError={(error) =>
                    setMapError(error?.toString() || "Failed to load map")
                  }
                />
              )}
            </View>

            <View className="mt-4 flex-row justify-between items-center">
              <View className="flex-row items-center">
                <View className="w-3 h-3 rounded-full bg-green-600 mr-2" />
                <Text className="text-sm text-gray-600">Tree Location</Text>
              </View>
              {location && (
                <View className="flex-row items-center">
                  <View className="w-3 h-3 rounded-full bg-blue-600 mr-2" />
                  <Text className="text-sm text-gray-600">Your Location</Text>
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
                    Flowers ({flowerCount})
                  </Text>
                  <Text className="text-gray-500">
                    Track flower wrapping and reviews
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/admin/flowers",
                  params: { treeId: treeData.id || treeData._id },
                })
              }
              className={
                flowerCount > 0
                  ? "bg-emerald-50 rounded-xl p-4"
                  : "bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-8 items-center"
              }
            >
              {flowerCount > 0 ? (
                <View>
                  <Text className="font-semibold text-gray-800">
                    View All Flowers
                  </Text>
                  <Text className="text-gray-600 mt-1">
                    {flowerCount} flower{flowerCount !== 1 ? "s" : ""} recorded
                  </Text>
                </View>
              ) : (
                <>
                  <Plus size={48} color="#9ca3af" />
                  <Text className="text-gray-500 mt-4 text-lg font-medium">
                    Add First Flower
                  </Text>
                  <Text className="text-gray-400 text-center mt-2">
                    Start tracking flower wrapping and reviews
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* QR Code */}
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
                Scan this QR code to view tree details on any device
              </Text>
              <TouchableOpacity
                className="mt-6 bg-emerald-50 py-3 rounded-lg items-center w-full"
                onPress={saveQRCodeToGallery}
              >
                <Text className="text-emerald-700 font-semibold">
                  Save QR Code
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Debug Section */}
          {__DEV__ && (
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
        <View className="h-20" />
      </ScrollView>

      <Toast />
    </SafeAreaView>
  );
}
