import TreeService from "@/services/treeService";
import { Tree } from "@/types/index";
import * as Location from "expo-location";
import { GoogleMaps } from "expo-maps";
import * as NavigationBar from "expo-navigation-bar";
import { useRouter } from "expo-router";
import { ArrowLeft, TreePine, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

// Helper function to find the area with highest tree density
const findDensityCenter = (trees) => {
  if (!trees || trees.length < 2) return null;

  const gridSize = 0.01;
  const grid = {};

  trees.forEach((tree) => {
    const gridLat = Math.round(tree.latitude / gridSize) * gridSize;
    const gridLng = Math.round(tree.longitude / gridSize) * gridSize;
    const key = `${gridLat},${gridLng}`;

    if (!grid[key]) {
      grid[key] = { lat: gridLat, lng: gridLng, count: 0 };
    }
    grid[key].count++;
  });

  let maxCount = 0;
  let densestCell = null;

  Object.values(grid).forEach((cell) => {
    if (cell.count > maxCount) {
      maxCount = cell.count;
      densestCell = cell;
    }
  });

  if (densestCell) {
    return {
      latitude: densestCell.lat,
      longitude: densestCell.lng,
    };
  }

  return null;
};

export default function App() {
  const insets = useSafeAreaInsets();

  const [trees, setTrees] = useState<Tree[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [selectedTree, setSelectedTree] = useState<Tree | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [locationPermission, setLocationPermission] = useState<boolean>(false);

  const mapRef = useRef<any>(null);
  const router = useRouter();

  const [initialPosition, setInitialPosition] = useState({
    coordinates: {
      latitude: 14.5995,
      longitude: 120.9842,
    },
    zoom: 13,
  });

  useEffect(() => {
    // Hide Android navigation bar
    if (Platform.OS === "android") {
      NavigationBar.setVisibilityAsync("hidden");
      NavigationBar.setBehaviorAsync("inset-touch");
      NavigationBar.setPositionAsync("absolute");
    }

    requestLocationPermission();
    loadTrees();

    // Cleanup - show navigation bar when component unmounts
    return () => {
      if (Platform.OS === "android") {
        NavigationBar.setVisibilityAsync("visible");
      }
    };
  }, []);

  useEffect(() => {
    if (trees.length > 0 && !loading) {
      // Center map on trees by default
      const densityCenter = findDensityCenter(trees);

      if (densityCenter) {
        setInitialPosition({
          coordinates: {
            latitude: densityCenter.latitude,
            longitude: densityCenter.longitude,
          },
          zoom: 13,
        });
      } else if (trees.length === 1) {
        setInitialPosition({
          coordinates: {
            latitude: trees[0].latitude,
            longitude: trees[0].longitude,
          },
          zoom: 15,
        });
      }
    }
  }, [trees, loading]);

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
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation(currentLocation);
    } catch (error) {
      console.error("Error getting location:", error);
    }
  };

  const loadTrees = async () => {
    try {
      setLoading(true);
      const allTrees = await TreeService.getTrees(true);
      setTrees(allTrees);
    } catch (error) {
      console.error("Error loading trees:", error);
      setMapError("Failed to load trees");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkerPress = (tree: Tree) => {
    setSelectedTree(tree);
  };

  const handleBackPress = () => {
    console.log("Back button pressed");
    router.back();
  };

  const centerMapOnTrees = () => {
    const densityCenter = findDensityCenter(trees);
    if (densityCenter && mapRef.current) {
      mapRef.current.setCameraPosition({
        coordinates: {
          latitude: densityCenter.latitude,
          longitude: densityCenter.longitude,
        },
        zoom: 13,
      });
    } else if (trees.length === 1 && mapRef.current) {
      mapRef.current.setCameraPosition({
        coordinates: {
          latitude: trees[0].latitude,
          longitude: trees[0].longitude,
        },
        zoom: 15,
      });
    }
  };

  const markers = trees.map((tree) => ({
    id: tree.id,
    coordinates: {
      latitude: tree.latitude,
      longitude: tree.longitude,
    },
    title: tree.description,
    snippet: `Type: ${tree.type}`,
  }));

  const userLocation = location
    ? {
        coordinates: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
        // Remove followUserLocation to prevent auto-centering on user
      }
    : undefined;

  if (Platform.OS === "android") {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: "#f3f4f6" }}
        edges={["top"]}
      >
        <StatusBar barStyle="dark-content" backgroundColor="#f3f4f6" />
        <View style={{ flex: 1 }}>
          {/* Map */}
          <GoogleMaps.View
            ref={mapRef}
            style={{
              flex: 1,
              width: "100%",
              height: "100%",
            }}
            cameraPosition={initialPosition}
            markers={markers}
            userLocation={userLocation}
            properties={{
              isMyLocationEnabled: true,
              mapPadding: {
                top: 70,
                right: 0,
                bottom: insets.bottom + (selectedTree ? 120 : 20),
                left: 0,
              },
            }}
            onMapReady={() => {
              setMapReady(true);
              setMapError(null);
            }}
            onMapLoaded={() => console.log("✅ MAP LOADED!")}
            onMapLoadError={(error) => {
              setMapError(error?.toString() || "Failed to load map");
            }}
            onMarkerClick={(marker) => {
              const tree = trees.find((t) => t.id === marker.id);
              if (tree) handleMarkerPress(tree);
            }}
          />

          {/* Back Button - Minimalist */}
          <TouchableOpacity
            style={{
              position: "absolute",
              top: (StatusBar.currentHeight || 20) + 8,
              left: 16,
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              padding: 10,
              borderRadius: 30,
              zIndex: 1000,
              elevation: 4,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
            }}
            onPress={handleBackPress}
          >
            <ArrowLeft size={22} color="#374151" />
          </TouchableOpacity>

          {/* Trees Button - Minimalist Counter */}
          {!loading && trees.length > 0 && (
            <TouchableOpacity
              style={{
                position: "absolute",
                top: (StatusBar.currentHeight || 20) + 20,
                right: 16,
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 30,
                zIndex: 1000,
                elevation: 4,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
              onPress={centerMapOnTrees}
            >
              <TreePine size={18} color="#059669" />
              <Text
                style={{
                  color: "#374151",
                  fontWeight: "600",
                  fontSize: 14,
                  includeFontPadding: false,
                }}
              >
                {trees.length}
              </Text>
            </TouchableOpacity>
          )}

          {/* Loading Indicator - Minimalist */}
          {loading && (
            <View
              style={{
                position: "absolute",
                top: "50%",
                left: 20,
                right: 20,
                transform: [{ translateY: -30 }],
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                padding: 16,
                borderRadius: 12,
                zIndex: 1000,
                elevation: 4,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
              }}
            >
              <ActivityIndicator size="small" color="#059669" />
              <Text style={{ color: "#6b7280", fontSize: 14 }}>
                Loading {trees.length > 0 ? `${trees.length} trees` : "trees"}
                ...
              </Text>
            </View>
          )}

          {/* Error Message - Minimalist */}
          {mapError && !loading && (
            <View
              style={{
                position: "absolute",
                top: (StatusBar.currentHeight || 20) + 70,
                left: 20,
                right: 20,
                backgroundColor: "rgba(254, 226, 226, 0.95)",
                padding: 12,
                borderRadius: 12,
                zIndex: 1000,
                borderWidth: 1,
                borderColor: "#fecaca",
              }}
            >
              <Text
                style={{ color: "#dc2626", textAlign: "center", fontSize: 13 }}
              >
                {mapError}
              </Text>
            </View>
          )}

          {/* Selected Tree Info - Minimalist Card */}
          {selectedTree && (
            <View
              style={{
                position: "absolute",
                bottom: insets.bottom + 20,
                left: 16,
                right: 16,
                backgroundColor: "rgba(255, 255, 255, 0.98)",
                padding: 16,
                borderRadius: 16,
                zIndex: 1000,
                elevation: 6,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                borderWidth: 1,
                borderColor: "rgba(0, 0, 0, 0.05)",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 8,
                  gap: 10,
                }}
              >
                <View
                  style={{
                    backgroundColor: "#ecfdf5",
                    padding: 8,
                    borderRadius: 12,
                  }}
                >
                  <TreePine size={18} color="#059669" />
                </View>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "600",
                    color: "#1f2937",
                    flex: 1,
                  }}
                >
                  {selectedTree.description}
                </Text>
              </View>
              <Text style={{ fontSize: 13, color: "#6b7280", marginLeft: 42 }}>
                {selectedTree.type}
              </Text>
              <TouchableOpacity
                onPress={() => setSelectedTree(null)}
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  padding: 6,
                  borderRadius: 20,
                  backgroundColor: "rgba(0, 0, 0, 0.05)",
                }}
              >
                <X size={16} color="#9ca3af" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Google Maps is only available on Android</Text>
    </View>
  );
}
