import client from "@/utils/axiosInstance";
import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { useSelector } from "react-redux";

export default function ChangePassword() {
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [isCheckingNetwork, setIsCheckingNetwork] = useState(true);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const user = useSelector((state: any) => state.auth.user);
  const router = useRouter();

  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

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
            "You need an internet connection to change your password.",
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
          "You've gone offline. Please check your internet connection to change your password.",
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
        "You need an internet connection to change your password.",
      );
      return;
    }
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear error when user types
    if (errors[field as keyof typeof errors]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const validateForm = () => {
    let valid = true;
    const newErrors = {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    };

    if (!formData.currentPassword.trim()) {
      newErrors.currentPassword = "Current password is required";
      valid = false;
    }

    if (!formData.newPassword.trim()) {
      newErrors.newPassword = "New password is required";
      valid = false;
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters";
      valid = false;
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.newPassword)) {
      newErrors.newPassword = "Must include uppercase, lowercase, and number";
      valid = false;
    }

    if (!formData.confirmPassword.trim()) {
      newErrors.confirmPassword = "Please confirm your password";
      valid = false;
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
      valid = false;
    }

    setErrors(newErrors);
    return valid;
  };

  const handleChangePassword = async () => {
    // Check if offline
    if (!isOnline) {
      Alert.alert(
        "Offline",
        "You need an internet connection to change your password. Please connect to the internet and try again.",
      );
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // CHANGE FROM PUT TO POST
      // CHANGE FIELD NAMES TO MATCH BACKEND
      const res = await client.post("/auth/change-password", {
        user_id: user?.id, // Add user_id from Redux state
        current_password: formData.currentPassword,
        new_password: formData.newPassword,
        new_password_confirmation: formData.confirmPassword, // Changed from confirm_password
      });

      if (res.status === 200) {
        Toast.show({
          type: "success",
          text1: "Password Changed",
          text2: "Your password has been updated successfully.",
        });

        // Clear form and go back after success
        setFormData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });

        setTimeout(() => {
          router.replace("/users/profile");
        }, 1500);
      }
    } catch (err: any) {
      console.error(
        "Change password error:",
        err.response?.data || err.message,
      );

      // Better error handling para sa validation errors
      if (err.response?.data?.errors) {
        const errors = err.response.data.errors;

        // Map backend errors to form fields
        if (errors.current_password) {
          setErrors((prev) => ({
            ...prev,
            currentPassword: errors.current_password[0],
          }));
        }
        if (errors.new_password) {
          setErrors((prev) => ({
            ...prev,
            newPassword: errors.new_password[0],
          }));
        }

        Toast.show({
          type: "error",
          text1: "Validation Error",
          text2: err.response.data.message || "Please check your input",
        });
      } else {
        Toast.show({
          type: "error",
          text1: "Failed to change password",
          text2: err.response?.data?.message || "Please try again later",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Check if form has data
    const hasData = Object.values(formData).some(
      (value) => value.trim() !== "",
    );

    if (hasData) {
      Alert.alert(
        "Discard Changes?",
        "You have unsaved changes. Are you sure you want to discard them?",
        [
          { text: "Keep Editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              setFormData({
                currentPassword: "",
                newPassword: "",
                confirmPassword: "",
              });
              setErrors({
                currentPassword: "",
                newPassword: "",
                confirmPassword: "",
              });
              router.back();
            },
          },
        ],
      );
    } else {
      router.back();
    }
  };

  const passwordStrength = (password: string) => {
    if (!password) return { score: 0, text: "", color: "gray" };

    let score = 0;
    if (password.length >= 8) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) return { score, text: "Weak", color: "red" };
    if (score <= 3) return { score, text: "Fair", color: "yellow" };
    if (score <= 4) return { score, text: "Good", color: "green" };
    return { score, text: "Strong", color: "green" };
  };

  const strength = passwordStrength(formData.newPassword);

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

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <TouchableOpacity onPress={handleCancel} disabled={loading}>
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-800">
          Change Password
        </Text>
        <TouchableOpacity
          onPress={handleChangePassword}
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
              You are offline. Connect to the internet to change your password.
            </Text>
          </View>
        </View>
      )}

      {/* Keyboard Aware Scroll View */}
      <KeyboardAwareScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        extraScrollHeight={20}
        keyboardShouldPersistTaps="handled"
      >
        {/* Security Tips */}
        <View
          className={`mx-6 mt-6 p-4 rounded-xl ${
            !isOnline ? "bg-gray-100" : "bg-green-50"
          }`}
        >
          <View className="flex-row items-start">
            <Ionicons
              name="shield-checkmark"
              size={20}
              color={!isOnline ? "#6b7280" : "#16a34a"}
            />
            <Text
              className={`font-medium ml-2 flex-1 ${
                !isOnline ? "text-gray-600" : "text-green-800"
              }`}
            >
              Password Security Tips
            </Text>
          </View>
          <View className="mt-2 space-y-1">
            <Text
              className={`text-sm ${
                !isOnline ? "text-gray-500" : "text-green-700"
              }`}
            >
              • Use at least 8 characters
            </Text>
            <Text
              className={`text-sm ${
                !isOnline ? "text-gray-500" : "text-green-700"
              }`}
            >
              • Include uppercase and lowercase letters
            </Text>
            <Text
              className={`text-sm ${
                !isOnline ? "text-gray-500" : "text-green-700"
              }`}
            >
              • Include numbers and special characters
            </Text>
            <Text
              className={`text-sm ${
                !isOnline ? "text-gray-500" : "text-green-700"
              }`}
            >
              • Avoid common words and personal information
            </Text>
          </View>
        </View>

        {/* Form Section */}
        <View className="px-6 mt-6 mb-8">
          {/* Current Password */}
          <View className="mb-6">
            <Text className="text-gray-700 font-medium mb-2">
              Current Password
            </Text>
            <View
              className={`rounded-xl border px-4 py-3 flex-row items-center ${
                !isOnline
                  ? "bg-gray-50 border-gray-300"
                  : errors.currentPassword
                    ? "bg-white border-red-300"
                    : "bg-white border-gray-200"
              }`}
            >
              <TextInput
                className={`flex-1 text-base ${
                  !isOnline ? "text-gray-400" : "text-gray-800"
                }`}
                value={formData.currentPassword}
                onChangeText={(text) =>
                  handleInputChange("currentPassword", text)
                }
                placeholder="Enter current password"
                secureTextEntry={!showCurrentPassword}
                autoCapitalize="none"
                editable={!loading && !!isOnline}
                placeholderTextColor={!isOnline ? "#9ca3af" : "#6b7280"}
              />
              <TouchableOpacity
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                disabled={loading || !isOnline}
              >
                <Ionicons
                  name={showCurrentPassword ? "eye-off" : "eye"}
                  size={20}
                  color={!isOnline ? "#9ca3af" : "#6b7280"}
                />
              </TouchableOpacity>
            </View>
            {errors.currentPassword &&
            !isOnline ? null : errors.currentPassword ? (
              <Text className="text-red-500 text-sm mt-1">
                {errors.currentPassword}
              </Text>
            ) : null}
          </View>

          {/* New Password */}
          <View className="mb-6">
            <Text className="text-gray-700 font-medium mb-2">New Password</Text>
            <View
              className={`rounded-xl border px-4 py-3 flex-row items-center ${
                !isOnline
                  ? "bg-gray-50 border-gray-300"
                  : errors.newPassword
                    ? "bg-white border-red-300"
                    : "bg-white border-gray-200"
              }`}
            >
              <TextInput
                className={`flex-1 text-base ${
                  !isOnline ? "text-gray-400" : "text-gray-800"
                }`}
                value={formData.newPassword}
                onChangeText={(text) => handleInputChange("newPassword", text)}
                placeholder="Enter new password"
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
                editable={!loading && !!isOnline}
                placeholderTextColor={!isOnline ? "#9ca3af" : "#6b7280"}
              />
              <TouchableOpacity
                onPress={() => setShowNewPassword(!showNewPassword)}
                disabled={loading || !isOnline}
              >
                <Ionicons
                  name={showNewPassword ? "eye-off" : "eye"}
                  size={20}
                  color={!isOnline ? "#9ca3af" : "#6b7280"}
                />
              </TouchableOpacity>
            </View>

            {/* Password Strength Indicator */}
            {formData.newPassword && isOnline ? (
              <View className="mt-2">
                <View className="flex-row items-center mb-1">
                  <Text className="text-gray-600 text-sm mr-2">Strength:</Text>
                  <Text
                    className={`text-sm font-medium ${
                      strength.color === "red"
                        ? "text-red-500"
                        : strength.color === "yellow"
                          ? "text-yellow-500"
                          : "text-green-600"
                    }`}
                  >
                    {strength.text}
                  </Text>
                </View>
                <View className="flex-row h-1 space-x-1">
                  {[1, 2, 3, 4, 5].map((index) => (
                    <View
                      key={index}
                      className={`flex-1 rounded-full ${
                        index <= strength.score
                          ? strength.color === "red"
                            ? "bg-red-500"
                            : strength.color === "yellow"
                              ? "bg-yellow-500"
                              : "bg-green-600"
                          : "bg-gray-200"
                      }`}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {errors.newPassword && !isOnline ? null : errors.newPassword ? (
              <Text className="text-red-500 text-sm mt-1">
                {errors.newPassword}
              </Text>
            ) : null}
          </View>

          {/* Confirm Password */}
          <View className="mb-6">
            <Text className="text-gray-700 font-medium mb-2">
              Confirm New Password
            </Text>
            <View
              className={`rounded-xl border px-4 py-3 flex-row items-center ${
                !isOnline
                  ? "bg-gray-50 border-gray-300"
                  : errors.confirmPassword
                    ? "bg-white border-red-300"
                    : "bg-white border-gray-200"
              }`}
            >
              <TextInput
                className={`flex-1 text-base ${
                  !isOnline ? "text-gray-400" : "text-gray-800"
                }`}
                value={formData.confirmPassword}
                onChangeText={(text) =>
                  handleInputChange("confirmPassword", text)
                }
                placeholder="Confirm new password"
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                editable={!loading && !!isOnline}
                placeholderTextColor={!isOnline ? "#9ca3af" : "#6b7280"}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={loading || !isOnline}
              >
                <Ionicons
                  name={showConfirmPassword ? "eye-off" : "eye"}
                  size={20}
                  color={!isOnline ? "#9ca3af" : "#6b7280"}
                />
              </TouchableOpacity>
            </View>
            {errors.confirmPassword &&
            !isOnline ? null : errors.confirmPassword ? (
              <Text className="text-red-500 text-sm mt-1">
                {errors.confirmPassword}
              </Text>
            ) : null}

            {/* Password Match Indicator */}
            {formData.newPassword &&
            formData.confirmPassword &&
            !errors.confirmPassword &&
            isOnline ? (
              <View className="flex-row items-center mt-2">
                <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                <Text className="text-green-600 text-sm ml-1">
                  Passwords match
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </KeyboardAwareScrollView>

      {/* Bottom Action Button */}
      <View className="p-6 bg-white border-t border-gray-200">
        <TouchableOpacity
          className={`py-4 rounded-xl items-center ${
            loading || !isOnline ? "bg-gray-400" : "bg-green-600"
          }`}
          onPress={handleChangePassword}
          disabled={loading || !isOnline}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold text-lg">
              {!isOnline ? "Offline - Cannot Change" : "Change Password"}
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
