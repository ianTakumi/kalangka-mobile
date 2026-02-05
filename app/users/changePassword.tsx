import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import client from "@/utils/axiosInstance";
import Toast from "react-native-toast-message";
import { useSelector } from "react-redux";
import { useRouter } from "expo-router";

export default function ChangePassword() {
  const [loading, setLoading] = useState(false);
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

  const handleInputChange = (field: string, value: string) => {
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
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    await client
      .put("/auth/change-password", {
        current_password: formData.currentPassword,
        new_password: formData.newPassword,
        confirm_password: formData.confirmPassword,
        email: user.email,
      })
      .then((res) => {
        if (res.status === 200) {
          Toast.show({
            type: "success",
            text1: "Password Changed",
            text2: "Your password has been updated successfully.",
          });
          router.replace("/users/profile");
        }
      });
    setLoading(false);
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
              // navigation.goBack();
            },
          },
        ],
      );
    } else {
      // navigation.goBack();
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
        <TouchableOpacity onPress={handleChangePassword} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#16a34a" />
          ) : (
            <Text className="text-green-600 font-semibold">Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Security Tips */}
        <View className="bg-green-50 mx-6 mt-6 p-4 rounded-xl">
          <View className="flex-row items-start">
            <Ionicons name="shield-checkmark" size={20} color="#16a34a" />
            <Text className="text-green-800 font-medium ml-2 flex-1">
              Password Security Tips
            </Text>
          </View>
          <View className="mt-2 space-y-1">
            <Text className="text-green-700 text-sm">
              • Use at least 8 characters
            </Text>
            <Text className="text-green-700 text-sm">
              • Include uppercase and lowercase letters
            </Text>
            <Text className="text-green-700 text-sm">
              • Include numbers and special characters
            </Text>
            <Text className="text-green-700 text-sm">
              • Avoid common words and personal information
            </Text>
          </View>
        </View>

        {/* Form Section */}
        <View className="px-6 mt-6">
          {/* Current Password */}
          <View className="mb-6">
            <Text className="text-gray-700 font-medium mb-2">
              Current Password
            </Text>
            <View
              className={`bg-white rounded-xl border px-4 py-3 flex-row items-center ${
                errors.currentPassword ? "border-red-300" : "border-gray-200"
              }`}
            >
              <TextInput
                className="flex-1 text-gray-800 text-base"
                value={formData.currentPassword}
                onChangeText={(text) =>
                  handleInputChange("currentPassword", text)
                }
                placeholder="Enter current password"
                secureTextEntry={!showCurrentPassword}
                autoCapitalize="none"
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                disabled={loading}
              >
                <Ionicons
                  name={showCurrentPassword ? "eye-off" : "eye"}
                  size={20}
                  color="#6b7280"
                />
              </TouchableOpacity>
            </View>
            {errors.currentPassword ? (
              <Text className="text-red-500 text-sm mt-1">
                {errors.currentPassword}
              </Text>
            ) : null}
          </View>

          {/* New Password */}
          <View className="mb-6">
            <Text className="text-gray-700 font-medium mb-2">New Password</Text>
            <View
              className={`bg-white rounded-xl border px-4 py-3 flex-row items-center ${
                errors.newPassword ? "border-red-300" : "border-gray-200"
              }`}
            >
              <TextInput
                className="flex-1 text-gray-800 text-base"
                value={formData.newPassword}
                onChangeText={(text) => handleInputChange("newPassword", text)}
                placeholder="Enter new password"
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowNewPassword(!showNewPassword)}
                disabled={loading}
              >
                <Ionicons
                  name={showNewPassword ? "eye-off" : "eye"}
                  size={20}
                  color="#6b7280"
                />
              </TouchableOpacity>
            </View>

            {/* Password Strength Indicator */}
            {formData.newPassword ? (
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

            {errors.newPassword ? (
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
              className={`bg-white rounded-xl border px-4 py-3 flex-row items-center ${
                errors.confirmPassword ? "border-red-300" : "border-gray-200"
              }`}
            >
              <TextInput
                className="flex-1 text-gray-800 text-base"
                value={formData.confirmPassword}
                onChangeText={(text) =>
                  handleInputChange("confirmPassword", text)
                }
                placeholder="Confirm new password"
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={loading}
              >
                <Ionicons
                  name={showConfirmPassword ? "eye-off" : "eye"}
                  size={20}
                  color="#6b7280"
                />
              </TouchableOpacity>
            </View>
            {errors.confirmPassword ? (
              <Text className="text-red-500 text-sm mt-1">
                {errors.confirmPassword}
              </Text>
            ) : null}

            {/* Password Match Indicator */}
            {formData.newPassword &&
            formData.confirmPassword &&
            !errors.confirmPassword ? (
              <View className="flex-row items-center mt-2">
                <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                <Text className="text-green-600 text-sm ml-1">
                  Passwords match
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Button */}
      <View className="p-6 bg-white border-t border-gray-200">
        <TouchableOpacity
          className={`py-4 rounded-xl items-center ${
            loading ? "bg-green-400" : "bg-green-600"
          }`}
          onPress={handleChangePassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold text-lg">
              Change Password
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
