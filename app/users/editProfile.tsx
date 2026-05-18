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
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { useDispatch, useSelector } from "react-redux";

// Accessibility constants
const TOUCH_TARGET = 56;
const ICON_SIZE_XL = 32;
const ICON_SIZE_LG = 28;
const ICON_SIZE_MD = 24;
const FONT_SIZE_TITLE = 28;
const FONT_SIZE_HEADING = 22;
const FONT_SIZE_BODY = 18;
const FONT_SIZE_CAPTION = 16;
const FONT_SIZE_SMALL = 15;

export default function EditProfile() {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [isCheckingNetwork, setIsCheckingNetwork] = useState(true);
  const insets = useSafeAreaInsets();
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
          <Text
            className="text-gray-500 mt-4"
            style={{ fontSize: FONT_SIZE_BODY }}
          >
            Checking connection...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 justify-center items-center">
          <Text className="text-gray-500" style={{ fontSize: FONT_SIZE_BODY }}>
            No user data found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Offline Banner - Larger */}
      {!isOnline && (
        <View className="bg-yellow-500 py-3 px-4">
          <View className="flex-row items-center justify-center">
            <Ionicons
              name="cloud-offline-outline"
              size={ICON_SIZE_MD}
              color="white"
            />
            <Text
              className="text-white font-semibold ml-3"
              style={{ fontSize: FONT_SIZE_CAPTION }}
            >
              You're offline. Some features are disabled.
            </Text>
          </View>
        </View>
      )}

      {/* Header with Back Button - Larger */}
      <SafeAreaView edges={["top"]} className="bg-white">
        <View className="pt-6 pb-3 px-4 flex-row items-center border-b border-gray-100">
          <TouchableOpacity
            onPress={handleCancel}
            className="w-12 h-12 rounded-full items-center justify-center bg-gray-100 active:bg-gray-200"
            style={{ minWidth: TOUCH_TARGET, minHeight: TOUCH_TARGET }}
          >
            <Ionicons name="chevron-back" size={ICON_SIZE_MD} color="#374151" />
          </TouchableOpacity>
          <Text
            className="flex-1 text-center font-semibold text-gray-800 mr-12"
            style={{ fontSize: FONT_SIZE_TITLE }}
          >
            Edit Profile
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Form Section */}
        <View className="px-6 mt-8">
          {/* First Name */}
          <View className="mb-6">
            <Text
              className="text-gray-700 font-semibold mb-3"
              style={{ fontSize: FONT_SIZE_CAPTION }}
            >
              First Name
            </Text>
            <View
              className={`bg-white rounded-2xl border-2 ${
                !isOnline ? "border-gray-300 bg-gray-50" : "border-gray-200"
              } px-5`}
              style={{ minHeight: TOUCH_TARGET }}
            >
              <TextInput
                className={`flex-1 ${
                  !isOnline ? "text-gray-400" : "text-gray-800"
                }`}
                style={{ fontSize: FONT_SIZE_BODY }}
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
            <Text
              className="text-gray-700 font-semibold mb-3"
              style={{ fontSize: FONT_SIZE_CAPTION }}
            >
              Last Name
            </Text>
            <View
              className={`bg-white rounded-2xl border-2 ${
                !isOnline ? "border-gray-300 bg-gray-50" : "border-gray-200"
              } px-5`}
              style={{ minHeight: TOUCH_TARGET }}
            >
              <TextInput
                className={`flex-1 ${
                  !isOnline ? "text-gray-400" : "text-gray-800"
                }`}
                style={{ fontSize: FONT_SIZE_BODY }}
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
            <Text
              className="text-gray-700 font-semibold mb-3"
              style={{ fontSize: FONT_SIZE_CAPTION }}
            >
              Email Address
            </Text>
            <View
              className={`bg-white rounded-2xl border-2 ${
                !isOnline ? "border-gray-300 bg-gray-50" : "border-gray-200"
              } px-5`}
              style={{ minHeight: TOUCH_TARGET }}
            >
              <TextInput
                className={`flex-1 ${
                  !isOnline ? "text-gray-400" : "text-gray-800"
                }`}
                style={{ fontSize: FONT_SIZE_BODY }}
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

          {/* Gender Selection - Larger Buttons */}
          <View className="mb-8">
            <Text
              className="text-gray-700 font-semibold mb-4"
              style={{ fontSize: FONT_SIZE_CAPTION }}
            >
              Gender
            </Text>
            <View className="flex-row gap-4">
              {["Male", "Female"].map((gender) => (
                <TouchableOpacity
                  key={gender}
                  className={`flex-1 py-5 rounded-2xl items-center border-2 relative ${
                    formData.gender.toLowerCase() === gender.toLowerCase()
                      ? "bg-green-50 border-green-500"
                      : !isOnline
                        ? "bg-gray-50 border-gray-300"
                        : "bg-white border-gray-200"
                  }`}
                  onPress={() => selectGender(gender)}
                  disabled={loading || !isOnline}
                  style={{ minHeight: TOUCH_TARGET + 10 }}
                >
                  <Text
                    className={`font-semibold ${
                      formData.gender.toLowerCase() === gender.toLowerCase()
                        ? "text-green-700"
                        : !isOnline
                          ? "text-gray-400"
                          : "text-gray-700"
                    }`}
                    style={{ fontSize: FONT_SIZE_BODY }}
                  >
                    {gender}
                  </Text>
                  {formData.gender.toLowerCase() === gender.toLowerCase() && (
                    <View className="absolute top-2 right-2">
                      <Ionicons
                        name="checkmark-circle"
                        size={ICON_SIZE_MD}
                        color={!isOnline ? "#9ca3af" : "#16a34a"}
                      />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Add bottom padding for scroll content */}
        <View style={{ height: 150 }} />
      </ScrollView>

      {/* Bottom Action Buttons - Larger */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: Platform.OS === "android" ? insets.bottom : 0,
        }}
        className="bg-white border-t border-gray-200 px-6 pt-5 pb-3"
      >
        <TouchableOpacity
          className={`py-5 rounded-2xl items-center active:opacity-90 ${
            loading || !isOnline ? "bg-gray-400" : "bg-green-600"
          }`}
          onPress={handleSaveChanges}
          disabled={loading || !isOnline}
          style={{ minHeight: TOUCH_TARGET }}
        >
          {loading ? (
            <ActivityIndicator color="white" size="large" />
          ) : (
            <Text
              className="text-white font-bold"
              style={{ fontSize: FONT_SIZE_BODY }}
            >
              {!isOnline ? "Offline - Cannot Save" : "Save Changes"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className="py-5 rounded-2xl items-center mt-3 active:bg-gray-100"
          onPress={handleCancel}
          disabled={loading}
          style={{ minHeight: TOUCH_TARGET }}
        >
          <Text
            className="text-gray-600 font-semibold"
            style={{ fontSize: FONT_SIZE_BODY }}
          >
            Cancel
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
