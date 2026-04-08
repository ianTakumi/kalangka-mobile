// app/qr-scanner.tsx
import TreeService from "@/services/treeService";
import { CameraType, CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import {
  AlertCircle,
  Camera,
  CheckCircle,
  Flashlight,
  FlashlightOff,
  FlipVertical,
  TreePine,
  X,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Alert,
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
    Vibration.vibrate(100);

    console.log(`QR Code Scanned - Type: ${type}, Data: ${data}`);

    try {
      // Check for UUID format (tree ID)
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (uuidRegex.test(data)) {
        console.log("Looking up tree with ID:", data);

        await TreeService.init();
        let tree = await TreeService.getTreeById(data);

        if (!tree) {
          console.log("Tree not found locally, syncing from server...");
          await TreeService.syncTreesFromServer();
          tree = await TreeService.getTreeById(data);
        }

        if (tree) {
          setTimeout(() => {
            router.push({
              pathname: "/admin/treeinfo",
              params: { treeData: JSON.stringify(tree) },
            });
          }, 500);
          return;
        } else {
          Alert.alert("Tree Not Found", `No tree found with ID: ${data}`);
          setScanned(false);
          setIsProcessing(false);
          return;
        }
      }

      // Try to parse as JSON (if it's tree data)
      try {
        const parsedData = JSON.parse(data);

        if (parsedData.id || parsedData.tree_id || parsedData._id) {
          const treeId = parsedData.id || parsedData.tree_id || parsedData._id;

          await TreeService.init();
          let tree = await TreeService.getTreeById(treeId);

          if (!tree) {
            await TreeService.syncTreesFromServer();
            tree = await TreeService.getTreeById(treeId);
          }

          if (tree) {
            setTimeout(() => {
              router.push({
                pathname: "/admin/treeinfo",
                params: { treeData: JSON.stringify(tree) },
              });
            }, 500);
            return;
          }
        }
      } catch (error) {
        // Not JSON, continue to next check
        console.log("Not JSON data");
      }

      // If we get here, no valid tree was found
      Alert.alert(
        "Invalid QR Code",
        "This QR code does not contain valid tree data.",
        [
          {
            text: "Scan Again",
            onPress: () => {
              setScanned(false);
              setIsProcessing(false);
            },
          },
        ],
      );
    } catch (error) {
      console.error("Error processing QR code:", error);
      Alert.alert("Error", "Failed to process QR code. Please try again.");
      setScanned(false);
      setIsProcessing(false);
    }
  };

  // Toggle flashlight
  const toggleTorch = () => {
    setTorchOn(!torchOn);
  };

  // Switch camera
  const switchCamera = () => {
    setCameraType((current) => (current === "back" ? "front" : "back"));
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
          <View className="w-10" />
        </View>
      </View>

      {/* Camera View */}
      <View className="flex-1">
        <CameraView
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          facing={cameraType}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
          style={StyleSheet.absoluteFillObject}
          enableTorch={torchOn}
        />

        {/* Overlay */}
        <View className="flex-1 bg-black/30">
          <View className="flex-1" />

          <View className="flex-row">
            <View className="flex-1 bg-black/30" />

            <View className="w-64 h-64 relative">
              <View className="absolute top-0 left-0 right-0 h-2 bg-emerald-500" />
              <View className="absolute top-0 right-0 bottom-0 w-2 bg-emerald-500" />
              <View className="absolute bottom-0 left-0 right-0 h-2 bg-emerald-500" />
              <View className="absolute top-0 left-0 bottom-0 w-2 bg-emerald-500" />

              <View className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-500" />
              <View className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-500" />
              <View className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-500" />
              <View className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-500" />

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

          <View className="flex-1 justify-end p-6">
            {scanned ? (
              <View className="items-center">
                <View className="bg-emerald-500/20 p-4 rounded-full mb-4">
                  <CheckCircle size={40} color="#10b981" />
                </View>
                <Text className="text-white text-xl font-bold mb-2">
                  {isProcessing ? "Processing..." : "Successfully Scanned!"}
                </Text>
                <Text className="text-gray-300 text-center mb-6">
                  {isProcessing
                    ? "Looking up tree information..."
                    : "Tree data found! Redirecting..."}
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

                <View className="flex-row space-x-4">
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

                  <TouchableOpacity
                    onPress={switchCamera}
                    className="bg-white/20 p-4 rounded-full"
                  >
                    <FlipVertical size={24} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </View>

      <View className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <TreePine size={40} color="#ffffff80" />
      </View>
    </SafeAreaView>
  );
}
