import { GoogleMaps } from "expo-maps";
import {
  Platform,
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useEffect, useState, useRef } from "react";
import * as Location from "expo-location";
import TreeService from "@/services/treeService";
import { Tree } from "@/types/index";
import { X, TreePine, Locate } from "lucide-react-native";

export default function App() {
  const [trees, setTrees] = useState<Tree[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [selectedTree, setSelectedTree] = useState<Tree | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  // Location states
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [followUserLocation, setFollowUserLocation] = useState(false);

  // Map reference for camera control
  const mapRef = useRef<any>(null);

  // Initial position
  const [initialPosition, setInitialPosition] = useState({
    coordinates: {
      latitude: 14.5995,
      longitude: 120.9842,
    },
    zoom: 15,
  });

  useEffect(() => {
    requestLocationPermission();
    loadTrees();
  }, []);

  useEffect(() => {
    // Center map on first tree when loaded (if no location yet)
    if (trees.length > 0 && !loading && !location) {
      setInitialPosition({
        coordinates: {
          latitude: trees[0].latitude,
          longitude: trees[0].longitude,
        },
        zoom: 16,
      });
      console.log("Centered on first tree:", trees[0].description);
    }
  }, [trees, loading, location]);

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

      // Center map on user location
      setInitialPosition({
        coordinates: {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        },
        zoom: 16,
      });

      // Start following user location
      setFollowUserLocation(true);

      console.log("User location:", currentLocation.coords);
    } catch (error) {
      console.error("Error getting location:", error);
    } finally {
      setGettingLocation(false);
    }
  };

  const handleCenterOnUser = () => {
    if (location) {
      // Update camera position to user location
      if (mapRef.current) {
        mapRef.current.setCameraPosition({
          coordinates: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
          zoom: 18,
        });
      }
      setFollowUserLocation(true);
    } else {
      getUserLocation();
    }
  };

  const loadTrees = async () => {
    try {
      setLoading(true);
      console.log("Loading trees...");
      const allTrees = await TreeService.getTrees(true);
      console.log(`Loaded ${allTrees.length} trees`);
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
    // Stop following user when marker is clicked
    setFollowUserLocation(false);
    console.log("Selected tree:", tree.description);
  };

  // Create markers array
  const markers = trees.map((tree) => ({
    id: tree.id,
    coordinates: {
      latitude: tree.latitude,
      longitude: tree.longitude,
    },
    title: tree.description,
    snippet: `Type: ${tree.type}`,
  }));

  // Create user location object for the map
  const userLocation = location
    ? {
        coordinates: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
        followUserLocation: followUserLocation,
      }
    : undefined;

  if (Platform.OS === "android") {
    return (
      <View style={{ flex: 1, backgroundColor: "#f3f4f6" }}>
        {/* Loading Indicator */}
        {loading && (
          <View
            style={{
              position: "absolute",
              top: 20,
              left: 20,
              right: 20,
              backgroundColor: "white",
              padding: 15,
              borderRadius: 10,
              zIndex: 1000,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
              elevation: 5,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ActivityIndicator size="small" color="#059669" />
            <Text style={{ marginLeft: 10, color: "#4b5563" }}>
              Loading{" "}
              {trees.length > 0 ? `${trees.length} trees...` : "trees..."}
            </Text>
          </View>
        )}

        {/* Error Message */}
        {mapError && !loading && (
          <View
            style={{
              position: "absolute",
              top: 20,
              left: 20,
              right: 20,
              backgroundColor: "#fee2e2",
              padding: 15,
              borderRadius: 10,
              zIndex: 1000,
              borderWidth: 1,
              borderColor: "#ef4444",
            }}
          >
            <Text style={{ color: "#b91c1c", textAlign: "center" }}>
              {mapError}
            </Text>
          </View>
        )}

        {/* Tree Count Info */}
        {!loading && trees.length > 0 && (
          <View
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              backgroundColor: "#059669",
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
              zIndex: 1000,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
              elevation: 5,
            }}
          >
            <Text style={{ color: "white", fontWeight: "600" }}>
              {trees.length} Trees
            </Text>
          </View>
        )}

        {/* Location Button */}
        <TouchableOpacity
          style={{
            position: "absolute",
            bottom: selectedTree ? 200 : 120,
            right: 20,
            backgroundColor: "white",
            padding: 12,
            borderRadius: 30,
            zIndex: 1000,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
          }}
          onPress={handleCenterOnUser}
          disabled={gettingLocation}
        >
          {gettingLocation ? (
            <ActivityIndicator size="small" color="#059669" />
          ) : (
            <Locate size={24} color={location ? "#059669" : "#6b7280"} />
          )}
        </TouchableOpacity>

        {/* Location Status */}
        {/* {location && (
          <View
            style={{
              position: "absolute",
              top: 80,
              right: 20,
              backgroundColor: followUserLocation ? "#059669" : "#6b7280",
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 15,
              zIndex: 1000,
            }}
          >
            <Text style={{ color: "white", fontSize: 10 }}>
              {followUserLocation ? "Following you" : "Not following"}
            </Text>
          </View>
        )} */}

        {/* Selected Tree Info */}
        {selectedTree && (
          <View
            style={{
              position: "absolute",
              bottom: 20,
              left: 20,
              right: 20,
              backgroundColor: "white",
              padding: 15,
              borderRadius: 10,
              zIndex: 1000,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
              elevation: 5,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <TreePine size={20} color="#059669" />
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "bold",
                  color: "#1f2937",
                  marginLeft: 8,
                  flex: 1,
                }}
              >
                {selectedTree.description}
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: "#6b7280", marginLeft: 28 }}>
              Type: {selectedTree.type}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: "#9ca3af",
                marginLeft: 28,
                marginTop: 4,
              }}
            >
              {selectedTree.latitude.toFixed(6)},{" "}
              {selectedTree.longitude.toFixed(6)}
            </Text>
            <TouchableOpacity
              onPress={() => setSelectedTree(null)}
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                padding: 5,
              }}
            >
              <X size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>
        )}

        {/* Map with markers and user location */}
        <GoogleMaps.View
          ref={mapRef}
          style={{ flex: 1, width: "100%", height: "100%" }}
          cameraPosition={initialPosition}
          markers={markers}
          userLocation={userLocation}
          properties={{
            isMyLocationEnabled: true, // Show blue dot
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
          onMarkerClick={(marker) => {
            const tree = trees.find((t) => t.id === marker.id);
            if (tree) handleMarkerPress(tree);
          }}
          onCameraMove={() => {
            // Stop following when user moves map manually
            if (followUserLocation) {
              setFollowUserLocation(false);
            }
          }}
        />

        {/* Debug Info - Remove in production */}
        {/* {__DEV__ && (
          <View
            style={{
              position: "absolute",
              bottom: 100,
              left: 10,
              backgroundColor: "rgba(0,0,0,0.7)",
              padding: 8,
              borderRadius: 5,
            }}
          >
            <Text style={{ color: "white", fontSize: 10 }}>
              Trees: {trees.length} | Loc: {location ? "✅" : "❌"} | Follow:{" "}
              {followUserLocation ? "✅" : "❌"}
            </Text>
          </View>
        )} */}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Google Maps is only available on Android</Text>
    </View>
  );
}
