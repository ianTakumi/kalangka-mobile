// app/registration.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";

export default function RegistrationScreen() {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirmPassword: "",
    gender: "male",
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const router = useRouter();

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const validateForm = () => {
    if (
      !formData.first_name ||
      !formData.last_name ||
      !formData.email ||
      !formData.password
    ) {
      return "Please fill in all required fields";
    }

    if (!formData.email.includes("@")) {
      return "Please enter a valid email address";
    }

    if (formData.password.length < 6) {
      return "Password must be at least 6 characters";
    }

    if (formData.password !== formData.confirmPassword) {
      return "Passwords do not match";
    }

    return null;
  };

  const handleRegister = async () => {
    const error = validateForm();
    if (error) {
      Alert.alert("Error", error);
      return;
    }

    setLoading(true);

    try {
      // Mock API call - replace with actual registration
      const mockUser = {
        id: Date.now().toString(),
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        avatar: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`,
        gender: formData.gender,
      };

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      Alert.alert(
        "Registration Successful",
        "Your account has been created successfully!",
        [
          {
            text: "Continue to Login",
            onPress: () => router.replace("/login"),
          },
        ],
      );
    } catch (error) {
      Alert.alert(
        "Registration Failed",
        "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    router.push("/login");
  };

  return (
    <View className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="flex-1 px-6 py-8">
          {/* Header */}
          <View className="items-center mb-8">
            <Text className="text-3xl font-bold text-green-700">
              Create Account
            </Text>
            <Text className="text-gray-600 mt-2">
              Join Kalangka Smart Farming
            </Text>
          </View>

          {/* Registration Form */}
          <View className="mb-8">
            {/* Name Fields */}
            <View className="flex-row mb-4">
              <View className="flex-1 mr-2">
                <Text className="text-gray-700 mb-2 font-medium">
                  First Name *
                </Text>
                <TextInput
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50"
                  placeholder="John"
                  value={formData.first_name}
                  onChangeText={(text) => handleInputChange("first_name", text)}
                />
              </View>
              <View className="flex-1 ml-2">
                <Text className="text-gray-700 mb-2 font-medium">
                  Last Name *
                </Text>
                <TextInput
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50"
                  placeholder="Doe"
                  value={formData.last_name}
                  onChangeText={(text) => handleInputChange("last_name", text)}
                />
              </View>
            </View>

            {/* Email */}
            <View className="mb-4">
              <Text className="text-gray-700 mb-2 font-medium">Email *</Text>
              <TextInput
                className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50"
                placeholder="your.email@example.com"
                value={formData.email}
                onChangeText={(text) => handleInputChange("email", text)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Gender Selection */}
            <View className="mb-4">
              <Text className="text-gray-700 mb-2 font-medium">Gender</Text>
              <View className="flex-row  gap-4">
                <TouchableOpacity
                  className={`flex-1 py-3 rounded-xl border ${formData.gender === "male" ? "bg-blue-50 border-blue-500" : "bg-gray-50 border-gray-300"}`}
                  onPress={() => handleInputChange("gender", "male")}
                >
                  <Text
                    className={`text-center ${formData.gender === "male" ? "text-blue-600 font-semibold" : "text-gray-600"}`}
                  >
                    Male
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`flex-1 py-3 rounded-xl border ${formData.gender === "female" ? "bg-pink-50 border-pink-500" : "bg-gray-50 border-gray-300"}`}
                  onPress={() => handleInputChange("gender", "female")}
                >
                  <Text
                    className={`text-center ${formData.gender === "female" ? "text-pink-600 font-semibold" : "text-gray-600"}`}
                  >
                    Female
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Password */}
            <View className="mb-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-gray-700 font-medium">Password *</Text>
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text className="text-green-600 text-sm">
                    {showPassword ? "Hide" : "Show"}
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50"
                placeholder="At least 6 characters"
                value={formData.password}
                onChangeText={(text) => handleInputChange("password", text)}
                secureTextEntry={!showPassword}
              />
            </View>

            {/* Confirm Password */}
            <View className="mb-6">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-gray-700 font-medium">
                  Confirm Password *
                </Text>
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Text className="text-green-600 text-sm">
                    {showConfirmPassword ? "Hide" : "Show"}
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChangeText={(text) =>
                  handleInputChange("confirmPassword", text)
                }
                secureTextEntry={!showConfirmPassword}
              />
            </View>

            {/* Register Button */}
            <TouchableOpacity
              className={`w-full rounded-xl py-4 ${loading ? "bg-green-400" : "bg-green-600"}`}
              onPress={handleRegister}
              disabled={loading}
            >
              <Text className="text-white text-center font-semibold text-lg">
                {loading ? "Creating Account..." : "Create Account"}
              </Text>
            </TouchableOpacity>

            {/* Terms & Conditions */}
            <View className="mt-6 p-4 bg-gray-50 rounded-xl">
              <Text className="text-gray-700 text-sm text-center">
                By creating an account, you agree to our{" "}
                <Text className="text-green-600">Terms of Service</Text> and{" "}
                <Text className="text-green-600">Privacy Policy</Text>
              </Text>
            </View>
          </View>

          {/* Login Link */}
          <View className="flex-row justify-center items-center mt-6">
            <Text className="text-gray-600">Already have an account? </Text>
            <TouchableOpacity onPress={handleLogin}>
              <Text className="text-green-600 font-semibold"> Sign In</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View className="mt-12 pt-6 border-t border-gray-200">
            <Text className="text-gray-500 text-center text-sm">
              Kalangka - Smart Farming Platform for Jackfruit Farmers
            </Text>
            <Text className="text-gray-400 text-center text-xs mt-2">
              Version 1.0.0 • Android App
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
