import { updateUser } from "@/redux/slices/authSlice";
import { RootState } from "@/redux/store";
import client from "@/utils/axiosInstance";
import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { useDispatch, useSelector } from "react-redux";

export default function EditProfile() {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [isCheckingNetwork, setIsCheckingNetwork] = useState(true);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    gender: "",
  });

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.first_name || "",
        lastName: user.last_name || "",
        email: user.email || "",
        gender: user.gender || "",
      });
    }
  }, [user]);

  // Check network status on mount and listen for changes
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const checkNetwork = async () => {
      try {
        const netState = await NetInfo.fetch();
        const online = netState.isConnected && netState.isInternetReachable;
        setIsOnline(online);
        setIsCheckingNetwork(false);

        // If offline, show alert
        if (!online) {
          Alert.alert(
            "Offline Mode",
            "You need an internet connection to edit your profile.",
            [
              {
                text: "OK",
                onPress: () => router.back(),
              },
            ],
            { cancelable: false },
          );
        }
      } catch (error) {
        console.error("Network check error:", error);
        setIsOnline(false);
        setIsCheckingNetwork(false);
      }
    };

    // Subscribe to network changes
    unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected && state.isInternetReachable;
      setIsOnline(online);

      // If user goes offline while on this screen, show alert
      if (!online && !isCheckingNetwork) {
        Alert.alert(
          "Connection Lost",
          "You've gone offline. Please check your internet connection to edit your profile.",
          [
            {
              text: "OK",
              onPress: () => router.back(),
            },
          ],
        );
      }
    });

    checkNetwork();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleInputChange = (field: string, value: string) => {
    if (!isOnline) {
      Alert.alert(
        "Offline",
        "You need an internet connection to edit your profile.",
      );
      return;
    }
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveChanges = async () => {
    // Check if offline
    if (!isOnline) {
      Alert.alert(
        "Offline",
        "You need an internet connection to update your profile. Please connect to the internet and try again.",
      );
      return;
    }

    // Validation
    if (!formData.firstName.trim()) {
      Alert.alert("Error", "First name is required");
      return;
    }

    if (!formData.lastName.trim()) {
      Alert.alert("Error", "Last name is required");
      return;
    }

    if (!formData.email.trim()) {
      Alert.alert("Error", "Email is required");
      return;
    }

    setLoading(true);

    try {
      const apiData = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        gender: formData.gender,
      };

      console.log("Sending data:", apiData);

      const res = await client.put("/users/" + user?.id, apiData);

      if (res.status === 200) {
        dispatch(
          updateUser({
            ...user,
            first_name: formData.firstName,
            last_name: formData.lastName,
            email: formData.email,
            gender: formData.gender,
          }),
        );

        Toast.show({
          type: "success",
          text1: "Profile updated successfully",
        });

        // Go back after successful update
        setTimeout(() => {
          router.back();
        }, 1500);
      }
    } catch (err: any) {
      console.error("Update error:", err.response?.data || err.message);

      const errorMessage =
        err.response?.data?.message || "Please try again later";

      Toast.show({
        type: "error",
        text1: "Failed to update profile",
        text2: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (
      formData.firstName !== (user?.first_name || "") ||
      formData.lastName !== (user?.last_name || "") ||
      formData.email !== (user?.email || "") ||
      formData.gender !== (user?.gender || "")
    ) {
      Alert.alert("Cancel", "Changes will be discarded", [
        { text: "Continue Editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => router.back(),
        },
      ]);
    } else {
      router.back();
    }
  };

  const selectGender = (gender: string) => {
    if (!isOnline) {
      Alert.alert(
        "Offline",
        "You need an internet connection to edit your profile.",
      );
      return;
    }
    setFormData((prev) => ({
      ...prev,
      gender: gender.toLowerCase(),
    }));
  };

  // Show loading while checking network
  if (isCheckingNetwork) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#16a34a" />
          <Text className="text-gray-500 mt-4">Checking connection...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 justify-center items-center">
          <Text className="text-gray-500 text-lg">No user data found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <TouchableOpacity onPress={handleCancel}>
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-800">
          Edit Profile
        </Text>
        <TouchableOpacity
          onPress={handleSaveChanges}
          disabled={loading || !isOnline}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#16a34a" />
          ) : (
            <Text
              className={`font-semibold ${
                !isOnline ? "text-gray-400" : "text-green-600"
              }`}
            >
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Offline Banner */}
      {!isOnline && (
        <View className="bg-red-50 px-6 py-3 border-b border-red-200">
          <View className="flex-row items-center">
            <Ionicons name="wifi-outline" size={20} color="#dc2626" />
            <Text className="text-red-600 ml-2 flex-1">
              You are offline. Connect to the internet to edit your profile.
            </Text>
          </View>
        </View>
      )}

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Form Section */}
        <View className="px-6 mt-2">
          {/* First Name */}
          <View className="mb-6">
            <Text className="text-gray-700 font-medium mb-2">First Name</Text>
            <View
              className={`bg-white rounded-xl border ${
                !isOnline ? "border-gray-300 bg-gray-50" : "border-gray-200"
              } px-4 py-3`}
            >
              <TextInput
                className={`text-base ${
                  !isOnline ? "text-gray-400" : "text-gray-800"
                }`}
                value={formData.firstName}
                onChangeText={(text) => handleInputChange("firstName", text)}
                placeholder="Enter your first name"
                editable={!loading && !!isOnline}
                placeholderTextColor={!isOnline ? "#9ca3af" : "#6b7280"}
              />
            </View>
          </View>

          {/* Last Name */}
          <View className="mb-6">
            <Text className="text-gray-700 font-medium mb-2">Last Name</Text>
            <View
              className={`bg-white rounded-xl border ${
                !isOnline ? "border-gray-300 bg-gray-50" : "border-gray-200"
              } px-4 py-3`}
            >
              <TextInput
                className={`text-base ${
                  !isOnline ? "text-gray-400" : "text-gray-800"
                }`}
                value={formData.lastName}
                onChangeText={(text) => handleInputChange("lastName", text)}
                placeholder="Enter your last name"
                editable={!loading && !!isOnline}
                placeholderTextColor={!isOnline ? "#9ca3af" : "#6b7280"}
              />
            </View>
          </View>

          {/* Email */}
          <View className="mb-6">
            <Text className="text-gray-700 font-medium mb-2">
              Email Address
            </Text>
            <View
              className={`bg-white rounded-xl border ${
                !isOnline ? "border-gray-300 bg-gray-50" : "border-gray-200"
              } px-4 py-3`}
            >
              <TextInput
                className={`text-base ${
                  !isOnline ? "text-gray-400" : "text-gray-800"
                }`}
                value={formData.email}
                onChangeText={(text) => handleInputChange("email", text)}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading && !!isOnline}
                placeholderTextColor={!isOnline ? "#9ca3af" : "#6b7280"}
              />
            </View>
          </View>

          {/* Gender Selection */}
          <View className="mb-8">
            <Text className="text-gray-700 font-medium mb-3">Gender</Text>
            <View className="flex-row gap-3">
              {["Male", "Female"].map((gender) => (
                <TouchableOpacity
                  key={gender}
                  className={`flex-1 py-3 rounded-xl items-center border ${
                    formData.gender.toLowerCase() === gender.toLowerCase()
                      ? "bg-green-50 border-green-500"
                      : !isOnline
                        ? "bg-gray-50 border-gray-300"
                        : "bg-white border-gray-200"
                  }`}
                  onPress={() => selectGender(gender)}
                  disabled={loading || !isOnline}
                >
                  <Text
                    className={`font-medium ${
                      formData.gender.toLowerCase() === gender.toLowerCase()
                        ? "text-green-700"
                        : !isOnline
                          ? "text-gray-400"
                          : "text-gray-700"
                    }`}
                  >
                    {gender}
                  </Text>
                  {formData.gender.toLowerCase() === gender.toLowerCase() && (
                    <View className="absolute top-1 right-1">
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={!isOnline ? "#9ca3af" : "#16a34a"}
                      />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Save Button */}
      <View className="p-6 bg-white border-t border-gray-200">
        <TouchableOpacity
          className={`py-4 rounded-xl items-center ${
            loading || !isOnline ? "bg-gray-400" : "bg-green-600"
          }`}
          onPress={handleSaveChanges}
          disabled={loading || !isOnline}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold text-lg">
              {!isOnline ? "Offline - Cannot Save" : "Save Changes"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className="py-4 rounded-xl items-center mt-3"
          onPress={handleCancel}
          disabled={loading}
        >
          <Text className="text-gray-600 font-medium">Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
