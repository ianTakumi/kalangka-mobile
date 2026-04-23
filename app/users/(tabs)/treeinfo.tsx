import TreeService from "@/services/treeService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraType, CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { GoogleMaps } from "expo-maps";
import * as MediaLibrary from "expo-media-library";
import {
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import {
  AlertCircle,
  ArrowLeft,
  Camera as CameraIcon,
  Clock,
  Leaf,
  Locate,
  MapPin,
  Navigation,
  QrCode,
  Tag,
  UploadCloud,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { captureRef } from "react-native-view-shot";

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

export default function TreeInfoScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const navigation = useNavigation();

  // Tree data states
  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

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

  // Missing image state
  const [isMissingImage, setIsMissingImage] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  // Map position
  const [initialPosition, setInitialPosition] = useState({
    coordinates: {
      latitude: 14.5995,
      longitude: 120.9842,
    },
    zoom: 18,
  });

  // Save tree data to AsyncStorage
  const saveTreeToStorage = async (tree: TreeData) => {
    try {
      await AsyncStorage.setItem("currentTree", JSON.stringify(tree));
      console.log("✅ Tree saved to AsyncStorage:", tree.id || tree._id);
    } catch (error) {
      console.error("❌ Failed to save tree to AsyncStorage:", error);
    }
  };

  // Load tree data
  useEffect(() => {
    const loadTreeData = async () => {
      if (!treeId) {
        if (params.treeData && typeof params.treeData === "string") {
          try {
            const parsed = JSON.parse(params.treeData);
            setTreeData(parsed);
            checkForMissingImage(parsed);
            // Save to AsyncStorage
            await saveTreeToStorage(parsed);
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
          checkForMissingImage(tree);
          // Save to AsyncStorage
          await saveTreeToStorage(tree);
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

  // Also save to AsyncStorage when treeData changes
  useEffect(() => {
    if (treeData) {
      saveTreeToStorage(treeData);
    }
  }, [treeData]);

  useFocusEffect(
    useCallback(() => {
      if (isMissingImage) {
        navigation.setOptions({ tabBarStyle: { display: "none" } });
      } else {
        navigation.setOptions({
          tabBarStyle: {
            height: 60,
            borderTopWidth: 0.3,
            borderTopColor: "#E5E7EB",
            backgroundColor: "#fff",
            paddingBottom: 5,
            display: "flex",
          },
        });
      }

      return () => {
        navigation.setOptions({
          tabBarStyle: {
            height: 60,
            borderTopWidth: 0.3,
            borderTopColor: "#E5E7EB",
            backgroundColor: "#fff",
            paddingBottom: 5,
            display: "flex",
          },
        });
      };
    }, [isMissingImage]),
  );

  // Check if tree is missing image
  const checkForMissingImage = (tree: TreeData) => {
    const missingImage = !tree.image_path || tree.image_path === "";
    setIsMissingImage(missingImage);
  };

  // Update tree with new image and location
  const updateTreeAndRedirect = async () => {
    if (!capturedImage || !treeData?.id) {
      Toast.show({
        type: "error",
        text1: "Missing Data",
        text2: "Please take a photo first",
      });
      return;
    }

    try {
      setIsUpdating(true);

      const treeId = treeData.id || treeData._id;
      if (!treeId) return;

      let latitude: number | undefined;
      let longitude: number | undefined;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Toast.show({
            type: "error",
            text1: "Permission Denied",
            text2: "Location permission is required to save tree",
          });
          setIsUpdating(false);
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        latitude = currentLocation.coords.latitude;
        longitude = currentLocation.coords.longitude;
      } catch (locationError) {
        console.error("Failed to get location:", locationError);
        Toast.show({
          type: "error",
          text1: "Location Error",
          text2: "Could not get current location. Please try again.",
        });
        setIsUpdating(false);
        return;
      }

      const updateData: Partial<TreeData> = {
        image_path: capturedImage,
        latitude: latitude,
        longitude: longitude,
      };

      await TreeService.updateTree(treeId, updateData);

      // Update local tree data
      const updatedTree = { ...treeData, ...updateData };
      setTreeData(updatedTree);

      // Save updated tree to AsyncStorage
      await saveTreeToStorage(updatedTree);

      setIsMissingImage(false);

      Toast.show({
        type: "success",
        text1: "Tree Updated",
        text2: "Image and location saved successfully",
      });

      try {
        await TreeService.syncAll();
      } catch (syncError) {
        console.log("Will sync when online");
      }

      // Stay on the same screen instead of redirecting
      // The tabs will reappear because isMissingImage is now false
    } catch (error) {
      console.error("Error updating tree:", error);
      Toast.show({
        type: "error",
        text1: "Update Failed",
        text2: "Failed to save tree data",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Capture photo for missing image
  const captureMissingImagePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await (cameraRef.current as any).takePictureAsync({
          quality: 0.8,
          skipProcessing: false,
        });
        setCapturedImage(photo.uri);
        setShowCamera(false);
      } catch (error) {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Failed to take photo",
        });
      }
    }
  };

  // Retake photo
  const retakePhoto = () => {
    setCapturedImage(null);
    setShowCamera(true);
  };

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

  // Request location permission
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

  // Request camera permission if missing image
  useEffect(() => {
    if (!permission?.granted && isMissingImage) {
      requestPermission();
    }
  }, [permission, isMissingImage]);

  // Helper functions
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
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

  const toggleCameraFacing = () => {
    setFacing((current) => (current === "back" ? "front" : "back"));
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
  if (loading || isUpdating) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 justify-center items-center">
        <ActivityIndicator size="large" color="#059669" />
        <Text className="mt-4 text-gray-600">
          {isUpdating ? "Updating tree data..." : "Loading tree details..."}
        </Text>
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

  // MISSING IMAGE SCREEN
  if (isMissingImage) {
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
          <View className="absolute top-0 left-0 right-0 bottom-0 z-50 bg-black">
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
                    Take Tree Photo
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
                    onPress={captureMissingImagePhoto}
                    className="w-20 h-20 bg-white rounded-full justify-center items-center border-4 border-white/30"
                  >
                    <View className="w-16 h-16 bg-white rounded-full" />
                  </TouchableOpacity>
                </View>
              </View>
            </CameraView>
          </View>
        )}

        {/* Main Content - Photo Form */}
        <View className="flex-1 p-6">
          <View className="bg-white rounded-2xl shadow-lg p-6">
            <View className="items-center mb-6">
              <View className="bg-emerald-50 p-4 rounded-full mb-4">
                <Leaf size={48} color="#059669" />
              </View>
              <Text className="text-2xl font-bold text-gray-900 text-center">
                Add Tree Photo
              </Text>
              <Text className="text-gray-500 text-center mt-2">
                Take a photo of the tree to complete its profile
              </Text>
            </View>

            {/* Tree Info Summary */}
            <View className="bg-gray-50 rounded-lg p-4 mb-6">
              <Text className="font-semibold text-gray-800 mb-2">
                {treeData.description || "Unnamed Tree"}
              </Text>
              <Text className="text-gray-600 text-sm">
                Type: {treeData.type || "Unknown"}
              </Text>
              {treeData.created_at && (
                <Text className="text-gray-600 text-sm">
                  Added: {formatDate(treeData.created_at)}
                </Text>
              )}
            </View>

            {/* Captured Image Preview */}
            {capturedImage ? (
              <View className="mb-6">
                <Text className="text-sm font-medium text-gray-700 mb-2">
                  Captured Photo
                </Text>
                <Image
                  source={{ uri: capturedImage }}
                  className="w-full h-64 rounded-lg"
                  resizeMode="cover"
                />
                <TouchableOpacity
                  onPress={retakePhoto}
                  className="mt-3 bg-gray-100 py-3 rounded-lg items-center"
                >
                  <Text className="text-gray-700 font-medium">
                    Retake Photo
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowCamera(true)}
                className="bg-emerald-50 border-2 border-dashed border-emerald-300 rounded-xl p-8 items-center mb-6"
              >
                <CameraIcon size={48} color="#059669" />
                <Text className="text-emerald-700 font-medium mt-3">
                  Tap to Take Photo
                </Text>
                <Text className="text-emerald-600 text-sm mt-1">
                  Camera will open
                </Text>
              </TouchableOpacity>
            )}

            {/* Action Buttons */}
            <TouchableOpacity
              onPress={updateTreeAndRedirect}
              disabled={!capturedImage}
              className={`py-3 rounded-lg items-center ${
                capturedImage ? "bg-emerald-500" : "bg-gray-300"
              }`}
            >
              <Text className="text-white font-medium">Save & Continue</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Toast />
      </SafeAreaView>
    );
  }

  // Main UI (tree has image)
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
