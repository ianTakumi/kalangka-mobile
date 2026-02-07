import React from "react";
import { View, Text, ScrollView, Image, TouchableOpacity } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Leaf,
  MapPin,
  CheckCircle,
  Clock,
  Tag,
  UploadCloud,
  QrCode,
} from "lucide-react-native";

export default function TreeInfoScreen() {
  const params = useLocalSearchParams();

  // Get the data directly
  const treeData = params.treeData
    ? JSON.parse(params.treeData as string)
    : null;

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

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <Stack.Screen
        options={{
          title: treeData?.description || "Tree Details",
          headerStyle: {
            backgroundColor: "#059669", // Green header
          },
          headerTintColor: "#fff",
        }}
      />

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
                    {treeData?.latitude?.toFixed(6)},{" "}
                    {treeData?.longitude?.toFixed(6)}
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
                <View className="bg-white p-4 rounded-lg shadow-sm">
                  <QRCode
                    value={qrCodeData}
                    size={180}
                    color="#059669"
                    backgroundColor="white"
                    quietZone={8}
                    ecl="H"
                  />
                </View>

                <Text className="text-center text-gray-600 mt-4 px-4">
                  Use this QR code for quick identification
                </Text>

                {/* Quick Actions */}
                <View className="flex-row mt-6 space-x-3">
                  <TouchableOpacity className="flex-1 bg-emerald-50 py-3 rounded-lg items-center">
                    <Text className="text-emerald-700 font-semibold">
                      Save QR
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity className="flex-1 bg-gray-100 py-3 rounded-lg items-center">
                    <Text className="text-gray-700 font-semibold">Share</Text>
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
    </SafeAreaView>
  );
}
