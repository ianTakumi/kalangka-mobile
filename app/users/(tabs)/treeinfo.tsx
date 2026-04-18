import FlowerService from "@/services/FlowerService";
import treeService from "@/services/treeService";
import { Flower as FlowerType } from "@/types/index";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraType, CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { GoogleMaps } from "expo-maps";
import * as MediaLibrary from "expo-media-library";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  Camera as CameraIcon,
  Clock,
  Leaf,
  Locate,
  MapPin,
  Navigation,
  Tag,
  UploadCloud,
  X,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { captureRef } from "react-native-view-shot";

export default function TreeInfoScreen() {
  const params = useLocalSearchParams();
  const treeData = params.treeData
    ? JSON.parse(params.treeData as string)
    : null;

  const qrCodeRef = useRef(null);
  const mapRef = useRef<any>(null);
  const [showFlowerForm, setShowFlowerForm] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [flower, setFlower] = useState<FlowerType | null>(null);
  const [isEditingFlower, setIsEditingFlower] = useState(false);
  const [flowerForm, setFlowerForm] = useState({
    quantity: "1",
    wrapped_at: new Date(),
    image_url: "",
  });
  const [flowerCount, setFlowerCount] = useState(0);
  const router = useRouter();
  const [distance, setDistance] = useState<string | null>(null);
  const [dateInput, setDateInput] = useState("");
  const [timeInput, setTimeInput] = useState("");

  // Location states
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Camera states
  const [facing, setFacing] = useState<CameraType>("back");
  const [showCamera, setShowCamera] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  // Initial map position centered on the tree
  const [initialPosition, setInitialPosition] = useState({
    coordinates: {
      latitude: treeData?.latitude || 14.5995,
      longitude: treeData?.longitude || 120.9842,
    },
    zoom: 18,
  });

  // Create marker for the current tree only
  const treeMarker = treeData
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

  // User location for the map
  const userLocation = location
    ? {
        coordinates: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
      }
    : undefined;

  // Create a string from the tree data for the QR code
  const qrCodeData = treeData
    ? JSON.stringify({
        id: treeData.id || treeData._id,
        description: treeData.description,
        image_path: treeData.image_path,
        is_synced: treeData.is_synced,
        latitude: treeData.latitude,
        longitude: treeData.longitude,
        type: treeData.type,
        status: treeData.status,
        timestamp: treeData.created_at || new Date().toISOString(),
      })
    : "No tree data available";

  // Format date if available
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (date: Date) => {
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
  const formatDateForInput = (date: Date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Format time for input (HH:MM)
  const formatTimeForInput = (date: Date) => {
    const d = new Date(date);
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const saveTreeToStorage = async (tree: any) => {
    await AsyncStorage.setItem("currentTree", JSON.stringify(tree));
  };

  const calculateDistance = async () => {
    const distanceText = await treeService.getTreeDistance(
      treeData?.latitude,
      treeData?.longitude,
    );
    setDistance(distanceText);
  };

  // Request location permission and get user location
  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === "granted");

      if (status === "granted") {
        getUserLocation();
      }
    } catch (error) {
      console.error("Location permission error:", error);
    }
  };

  const getUserLocation = async () => {
    try {
      setGettingLocation(true);
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLocation(currentLocation);
      console.log("User location:", currentLocation.coords);
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

  // Center map on tree location
  const centerOnTree = () => {
    if (mapRef.current && treeData) {
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

  // Center map on user location
  const centerOnUser = () => {
    if (location) {
      if (mapRef.current) {
        mapRef.current.setCameraPosition({
          coordinates: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
          zoom: 16,
        });
      }
    } else {
      getUserLocation();
    }
  };

  // Initialize date inputs
  useEffect(() => {
    if (showDateModal) {
      setDateInput(formatDateForInput(flowerForm.wrapped_at));
      setTimeInput(formatTimeForInput(flowerForm.wrapped_at));
    }
  }, [showDateModal]);

  useEffect(() => {
    if (treeData) {
      saveTreeToStorage(treeData);
    }
  }, [treeData]);

  useEffect(() => {
    if (treeData?.latitude && treeData?.longitude) {
      calculateDistance();
    }
  }, [treeData]);

  // Request location permission on mount
  useEffect(() => {
    requestLocationPermission();
  }, []);

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
        });
        return;
      }

      Toast.show({
        type: "info",
        text1: "Saving QR Code",
        text2: "Please wait...",
      });

      const uri = await captureRef(qrCodeRef, {
        format: "png",
        quality: 1.0,
      });

      await MediaLibrary.saveToLibraryAsync(uri);

      Toast.show({
        type: "success",
        text1: "QR Code Saved!",
        text2: "QR code has been saved to your gallery",
        position: "top",
      });
    } catch (error: any) {
      console.error("Error saving QR code:", error);
      Toast.show({
        type: "error",
        text1: "Save Failed",
        text2: error.message || "Failed to save QR code. Please try again.",
        position: "top",
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
          position: "top",
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
          position: "top",
        });
      } catch (error) {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Failed to take photo",
          position: "top",
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
        position: "top",
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
        position: "top",
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Invalid date/time",
        text2: "Please enter a valid date and time",
        position: "top",
      });
    }
  };

  useEffect(() => {
    const loadFlowerForTree = async () => {
      if (treeData?.id || treeData?._id) {
        try {
          await FlowerService.init();
          const treeId = treeData.id || treeData._id;
          const flowers = await FlowerService.getFlowersByTreeId(treeId);
          setFlowerCount(flowers.length);
          console.log(`Loaded flowers for tree ${treeId}:`, flowers);
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

  if (Platform.OS === "android") {
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
                  <TouchableOpacity
                    onPress={toggleCameraFacing}
                    className="p-2"
                  >
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

            <View className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-gray-50 to-transparent" />
          </View>

          {/* Main Content Card */}
          <View className="px-4 -mt-8">
            {/* Tree Details section */}
            <View className="bg-white rounded-2xl shadow-lg p-6 mb-6">
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

                <View
                  className={`px-3 py-1 rounded-full ${
                    treeData?.status === "active"
                      ? "bg-green-100"
                      : "bg-red-100"
                  }`}
                >
                  <Text
                    className={`font-semibold ${
                      treeData?.status === "active"
                        ? "text-green-800"
                        : "text-red-800"
                    }`}
                  >
                    {treeData?.status
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

            {/* Map Section - Shows only current tree location */}
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

                {/* Map Controls */}
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

              {/* Map Container */}
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
                    style={{ flex: 1, width: "100%", height: "100%" }}
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
                    onMapReady={() => {
                      console.log("✅ MAP READY!");
                      setMapReady(true);
                      setMapError(null);
                    }}
                    onMapLoaded={() => console.log("✅ MAP LOADED!")}
                    onMapLoadError={(error) => {
                      console.log("❌ MAP ERROR:", error);
                      setMapError(error?.toString() || "Failed to load map");
                    }}
                  />
                )}
              </View>

              {/* Location Info */}
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

          <View className="h-20" />
        </ScrollView>

        <Toast />
      </SafeAreaView>
    );
  }

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
      <View className="flex-1 justify-center items-center p-4">
        <Text className="text-gray-600 text-center">
          Google Maps is only available on Android devices
        </Text>
      </View>
    </SafeAreaView>
  );
}
