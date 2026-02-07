// app/qr-scanner.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  Vibration,
} from "react-native";
import { CameraView, useCameraPermissions, CameraType } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Camera,
  ScanLine,
  X,
  AlertCircle,
  CheckCircle,
  TreePine,
  Flashlight,
  FlashlightOff,
  FlipVertical,
} from "lucide-react-native";

export default function QRScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraType, setCameraType] = useState<CameraType>("back");
  const router = useRouter();

  // Request camera permission
  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  // Handle QR code scan
  const handleBarCodeScanned = ({ type, data }) => {
    setScanned(true);
    Vibration.vibrate(100); // Haptic feedback

    console.log(`QR Code Scanned - Type: ${type}, Data: ${data}`);

    try {
      // Try to parse as JSON (if it's tree data)
      const parsedData = JSON.parse(data);

      // Check if it's tree data format
      if (parsedData.id || parsedData.tree_id || parsedData._id) {
        // Navigate to Tree Info screen with the data
        setTimeout(() => {
          router.push({
            pathname: "/users/treeinfo",
            params: { treeData: JSON.stringify(parsedData) },
          });
        }, 500);

        return;
      }
    } catch (error) {
      // Not JSON, check other formats
      console.log("Not JSON data, checking other formats...");
    }

    // Check for Tree ID format (starts with "tree_" or similar)
    if (data.match(/^(tree_|TREE_|Tree_)/) || data.match(/^[A-Z0-9]{6,12}$/)) {
      // This looks like a tree ID
      Alert.alert(
        "Tree Found!",
        `Tree ID: ${data}\n\nFetching tree details...`,
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => setScanned(false),
          },
          {
            text: "View Details",
            onPress: () => {
              // Navigate to tree info (you'll need to fetch data from backend)
              router.push({
                pathname: "/tree-info",
                params: {
                  treeId: data,
                  scanned: "true",
                },
              });
            },
          },
        ],
      );
      return;
    }

    // Check for URL/deep link
    if (data.startsWith("http://") || data.startsWith("https://")) {
      Alert.alert("Open Link?", `Do you want to open:\n${data}`, [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => setScanned(false),
        },
        {
          text: "Open",
          onPress: () => {
            Linking.openURL(data);
            setTimeout(() => setScanned(false), 2000);
          },
        },
      ]);
      return;
    }

    // Check for deep link to your app
    if (data.startsWith("greenph://") || data.startsWith("treeapp://")) {
      Alert.alert("Open in App", "This QR code contains app-specific data", [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => setScanned(false),
        },
        {
          text: "Process",
          onPress: () => {
            // Handle your custom deep link
            processDeepLink(data);
          },
        },
      ]);
      return;
    }

    // Generic QR code content
    Alert.alert("QR Code Scanned", `Content: ${data}`, [
      {
        text: "Scan Again",
        onPress: () => setScanned(false),
      },
    ]);
  };

  // Process deep links for your app
  const processDeepLink = (url) => {
    // Example: greenph://tree/tree_12345
    const match = url.match(/greenph:\/\/tree\/(.+)/);
    if (match) {
      const treeId = match[1];
      router.push({
        pathname: "/tree-info",
        params: { treeId },
      });
    } else {
      Alert.alert("Unknown Format", "This QR code format is not supported.");
      setScanned(false);
    }
  };

  // Toggle flashlight
  const toggleTorch = () => {
    setTorchOn(!torchOn);
  };

  // Reset scanner
  const resetScanner = () => {
    setScanned(false);
  };

  if (!permission) {
    return (
      <SafeAreaView className="flex-1 bg-gray-900 justify-center items-center">
        <View className="items-center">
          <Camera size={60} color="#6b7280" />
          <Text className="text-gray-300 mt-4 text-lg">
            Requesting camera permission...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-gray-900 justify-center items-center p-6">
        <View className="items-center">
          <AlertCircle size={60} color="#ef4444" />
          <Text className="text-gray-300 mt-4 text-xl font-bold text-center">
            Camera Permission Required
          </Text>
          <Text className="text-gray-400 mt-2 text-center">
            Please enable camera access in your device settings to scan QR
            codes.
          </Text>
          <TouchableOpacity
            className="mt-6 bg-emerald-600 py-3 px-6 rounded-full"
            onPress={() => router.back()}
          >
            <Text className="text-white font-semibold">Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      {/* Header */}
      <View className="absolute top-0 left-0 right-0 z-10 pt-4 px-4">
        <View className="flex-row justify-between items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-black/70 p-2 rounded-full"
          >
            <X size={24} color="white" />
          </TouchableOpacity>
          <View className="items-center">
            <Text className="text-white text-xl font-bold">
              Scan Tree QR Code
            </Text>
            <Text className="text-gray-300 text-sm">
              Point camera at QR code
            </Text>
          </View>
          <View className="w-10" /> {/* Spacer for alignment */}
        </View>
      </View>

      {/* Camera View - USING EXPO-CAMERA */}
      <View className="flex-1">
        <CameraView
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          facing={cameraType}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"], // QR codes lang
          }}
          style={StyleSheet.absoluteFillObject}
          enableTorch={torchOn}
        />

        {/* Overlay */}
        <View className="flex-1 bg-black/30">
          {/* Top overlay */}
          <View className="flex-1" />

          {/* Middle scanning area */}
          <View className="flex-row">
            <View className="flex-1 bg-black/30" />

            <View className="w-64 h-64 relative">
              {/* Scanning frame */}
              <View className="absolute top-0 left-0 right-0 h-2 bg-emerald-500" />
              <View className="absolute top-0 right-0 bottom-0 w-2 bg-emerald-500" />
              <View className="absolute bottom-0 left-0 right-0 h-2 bg-emerald-500" />
              <View className="absolute top-0 left-0 bottom-0 w-2 bg-emerald-500" />

              {/* Corner decorations */}
              <View className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-500" />
              <View className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-500" />
              <View className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-500" />
              <View className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-500" />

              {/* Animated scan line */}
              {!scanned && (
                <View
                  className="absolute left-2 right-2 h-1 bg-emerald-400/80"
                  style={{
                    top: "50%",
                    transform: [{ translateY: -0.5 }],
                  }}
                >
                  <ScanLine
                    size={20}
                    color="#10b981"
                    className="absolute -top-2 left-1/2"
                  />
                </View>
              )}
            </View>

            <View className="flex-1 bg-black/30" />
          </View>

          {/* Bottom overlay */}
          <View className="flex-1 justify-end p-6">
            {scanned ? (
              <View className="items-center">
                <View className="bg-emerald-500/20 p-4 rounded-full mb-4">
                  <CheckCircle size={40} color="#10b981" />
                </View>
                <Text className="text-white text-xl font-bold mb-2">
                  Successfully Scanned!
                </Text>
                <Text className="text-gray-300 text-center mb-6">
                  Processing tree data...
                </Text>
                <TouchableOpacity
                  onPress={resetScanner}
                  className="bg-white py-3 px-8 rounded-full"
                >
                  <Text className="text-gray-900 font-semibold">
                    Scan Another QR
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="items-center">
                <Text className="text-white text-center mb-6">
                  Align the QR code within the frame
                </Text>

                <View className="flex-row gap-5">
                  {/* Flashlight Button */}
                  <TouchableOpacity
                    onPress={toggleTorch}
                    className={`p-4 rounded-full ${torchOn ? "bg-emerald-500" : "bg-white/20"}`}
                  >
                    {torchOn ? (
                      <FlashlightOff size={24} color="white" />
                    ) : (
                      <Flashlight size={24} color="white" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Tree Icon Indicator */}
      <View className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <TreePine size={40} color="#ffffff80" />
      </View>
    </SafeAreaView>
  );
}
