// components/TreeCamera.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { CameraView, useCameraPermissions, CameraType } from "expo-camera";
import * as Location from "expo-location";
import { Camera, X, MapPin, Check } from "lucide-react-native";

interface TreeCameraProps {
  onPhotoCaptured: (
    photoUri: string,
    latitude: number,
    longitude: number,
  ) => void;
  onClose: () => void;
}

export default function TreeCamera({
  onPhotoCaptured,
  onClose,
}: TreeCameraProps) {
  const [facing, setFacing] = useState<CameraType>("back");
  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [capturing, setCapturing] = useState(false);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const cameraRef = useRef<any>(null);

  useEffect(() => {
    requestCameraPermission();
    requestLocationPermission();
  }, []);

  const requestCameraPermission = async () => {
    const { status } = await requestPermission();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Camera permission is needed to take photos of trees",
      );
    }
  };

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(status === "granted");

    if (status === "granted") {
      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      setLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current || capturing) return;

    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      if (photo?.uri && location) {
        onPhotoCaptured(photo.uri, location.latitude, location.longitude);
      } else if (photo?.uri && !location) {
        // Try to get location again
        try {
          const currentLocation = await Location.getCurrentPositionAsync({});
          onPhotoCaptured(
            photo.uri,
            currentLocation.coords.latitude,
            currentLocation.coords.longitude,
          );
        } catch (locationError) {
          // Use default coordinates if location fails
          onPhotoCaptured(photo.uri, 0, 0);
        }
      }
    } catch (error) {
      console.error("Error taking picture:", error);
      Alert.alert("Error", "Failed to take picture");
    } finally {
      setCapturing(false);
    }
  };

  const toggleCameraFacing = () => {
    setFacing((current) => (current === "back" ? "front" : "back"));
  };

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>No camera permission</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        mode="picture"
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color="white" />
          </TouchableOpacity>

          <View style={styles.locationInfo}>
            <MapPin size={16} color="white" />
            <Text style={styles.locationText}>
              {location ? `Location ready` : "Getting location..."}
            </Text>
          </View>
        </View>

        <View style={styles.captureGuide}>
          <View style={styles.captureFrame} />
        </View>

        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.flipButton}
            onPress={toggleCameraFacing}
          >
            <Text style={styles.flipText}>Flip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.captureButton, capturing && styles.capturing]}
            onPress={takePicture}
            disabled={capturing}
          >
            {capturing ? (
              <ActivityIndicator color="white" />
            ) : (
              <Camera size={28} color="white" />
            )}
          </TouchableOpacity>

          <View style={{ width: 60 }} />
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  camera: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 40,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  locationInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  locationText: {
    color: "white",
    fontSize: 12,
    marginLeft: 4,
  },
  captureGuide: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  captureFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.7)",
    borderRadius: 10,
    backgroundColor: "transparent",
  },
  controls: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  flipButton: {
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 8,
  },
  flipText: {
    color: "white",
    fontSize: 14,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#059669",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "white",
  },
  capturing: {
    backgroundColor: "#666",
  },
  message: {
    color: "white",
    fontSize: 18,
    textAlign: "center",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
  },
});
