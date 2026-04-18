// app/qr-scanner.tsx
import TreeService from "@/services/treeService"; // Import your TreeService
import { CameraType, CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import {
  AlertCircle,
  Camera,
  CheckCircle,
  Flashlight,
  FlashlightOff,
  TreePine,
  X,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function QRScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraType, setCameraType] = useState<CameraType>("back");
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();

  // Request camera permission
  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  // Handle QR code scan
  const handleBarCodeScanned = async ({ type, data }) => {
    if (scanned || isProcessing) return;

    setScanned(true);
    setIsProcessing(true);
    Vibration.vibrate(100); // Haptic feedback

    console.log(`QR Code Scanned - Type: ${type}, Data: ${data}`);

    try {
      // First, check if it's a valid UUID format (tree ID)
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (uuidRegex.test(data)) {
        // This is a tree UUID - query the database
        console.log("Looking up tree with ID:", data);

        // Initialize TreeService if needed
        await TreeService.init();

        // Try to get tree by ID from local database first
        let tree = await TreeService.getTreeById(data);

        if (!tree) {
          // If not found locally, try to sync from server first
          console.log("Tree not found locally, syncing from server...");
          await TreeService.syncTreesFromServer();

          // Try again after sync
          tree = await TreeService.getTreeById(data);
        }

        if (tree) {
          router.push({
            pathname: "/users/(tabs)/treeinfo",
            params: { treeData: JSON.stringify(tree) },
          });
          return;
        } else {
          // Tree ID not found in database
          Alert.alert(
            "Tree Not Found",
            `No tree found. Try to scan again or sync your data to get the latest trees from the server.`,
            [
              {
                text: "Try Again",
                onPress: () => {
                  setScanned(false);
                  setIsProcessing(false);
                },
              },
              {
                text: "Cancel",
                style: "cancel",
                onPress: () => router.push("/users/(drawers)/(tabs)"),
              },
            ],
          );
          return;
        }
      }

      // Try to parse as JSON (if it's tree data)
      const parsedData = JSON.parse(data);
      console.log("Parsed QR Data:", parsedData);

      // Check if it's tree data format
      if (parsedData.id || parsedData.tree_id || parsedData._id) {
        const treeId = parsedData.id || parsedData.tree_id || parsedData._id;

        // Get full tree data from database
        await TreeService.init();
        let tree = await TreeService.getTreeById(treeId);

        if (!tree) {
          await TreeService.syncTreesFromServer();
          tree = await TreeService.getTreeById(treeId);
        }

        if (tree) {
          setTimeout(() => {
            router.push({
              pathname: "/users/(tabs)/treeinfo",
              params: { treeData: JSON.stringify(tree) },
            });
          }, 500);
        } else {
          Alert.alert("Error", "Tree data not found in database");
          setScanned(false);
          setIsProcessing(false);
        }
        return;
      }
    } catch (error) {
      // Not JSON or UUID, check other formats
      console.log("Not JSON/UUID data, checking other formats...", error);
    }

    // Check for Tree ID format (starts with "tree_" or similar)
    if (data.match(/^(tree_|TREE_|Tree_)/) || data.match(/^[A-Z0-9]{6,12}$/)) {
      // This looks like a tree ID
      Alert.alert("Tree Found!", `Tree ID: ${data}\n\nSearching database...`, [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            setScanned(false);
            setIsProcessing(false);
          },
        },
        {
          text: "View Details",
          onPress: async () => {
            // Try to find tree by this ID format
            await TreeService.init();
            let tree = await TreeService.getTreeById(data);

            if (!tree) {
              await TreeService.syncTreesFromServer();
              tree = await TreeService.getTreeById(data);
            }

            if (tree) {
              router.push({
                pathname: "/users/(tabs)/treeinfo",
                params: { treeData: JSON.stringify(tree) },
              });
            } else {
              Alert.alert("Not Found", `Tree with ID "${data}" not found`);
              setScanned(false);
              setIsProcessing(false);
            }
          },
        },
      ]);
      return;
    }

    // Check for URL/deep link
    if (data.startsWith("http://") || data.startsWith("https://")) {
      Alert.alert("Open Link?", `Do you want to open:\n${data}`, [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            setScanned(false);
            setIsProcessing(false);
          },
        },
        {
          text: "Open",
          onPress: () => {
            Linking.openURL(data);
            setTimeout(() => {
              setScanned(false);
              setIsProcessing(false);
            }, 2000);
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
          onPress: () => {
            setScanned(false);
            setIsProcessing(false);
          },
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
        onPress: () => {
          setScanned(false);
          setIsProcessing(false);
        },
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
        pathname: "/users/(tabs)/treeinfo",
        params: { treeId },
      });
    } else {
      Alert.alert("Unknown Format", "This QR code format is not supported.");
      setScanned(false);
      setIsProcessing(false);
    }
  };

  // Toggle flashlight
  const toggleTorch = () => {
    setTorchOn(!torchOn);
  };

  // Reset scanner
  const resetScanner = () => {
    setScanned(false);
    setIsProcessing(false);
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
            onPress={() => router.push("/users/(drawers)/(tabs)")}
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
            onPress={() => router.push("/users/(drawers)/(tabs)")}
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
                />
              )}
            </View>

            <View className="flex-1 bg-black/30" />
          </View>

          {/* Bottom overlay */}
          <View className="flex-1 justify-end p-6">
            {scanned ? (
              <View className="items-center">
                <View className="bg-emerald-500/20 p-4 rounded-full mb-4">
                  {isProcessing ? (
                    <ActivityIndicator size="large" color="#10b981" />
                  ) : (
                    <CheckCircle size={40} color="#10b981" />
                  )}
                </View>
                <Text className="text-white text-xl font-bold mb-2">
                  {isProcessing ? "Processing..." : "Successfully Scanned!"}
                </Text>
                <Text className="text-gray-300 text-center mb-6">
                  {isProcessing
                    ? "Looking up tree information..."
                    : "Processing tree data..."}
                </Text>
                {!isProcessing && (
                  <TouchableOpacity
                    onPress={resetScanner}
                    className="bg-white py-3 px-8 rounded-full"
                  >
                    <Text className="text-gray-900 font-semibold">
                      Scan Another QR
                    </Text>
                  </TouchableOpacity>
                )}
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
