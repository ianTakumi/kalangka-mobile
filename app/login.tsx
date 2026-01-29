// app/login.tsx
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
import { useDispatch } from "react-redux";
import { setCredentials } from "../redux/slices/authSlice";
import { AppDispatch } from "../redux/store";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (!email.includes("@")) {
      Alert.alert("Error", "Please enter a valid email");
      return;
    }

    setLoading(true);

    try {
      // Mock login - replace with actual API call
      const mockUser = {
        id: "1",
        first_name: "John",
        last_name: "Doe",
        email: email,
        avatar: "https://i.pravatar.cc/150?img=1",
        gender: "male",
      };

      const mockToken = "mock-jwt-token-123456";

      // Dispatch to Redux
      dispatch(
        setCredentials({
          token: mockToken,
          user: mockUser,
        }),
      );

      // Navigate to main app
      router.replace("/(tabs)");
    } catch (error) {
      Alert.alert("Login Failed", "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = () => {
    router.push("/registration");
  };

  const handleForgotPassword = () => {
    Alert.alert("Forgot Password", "Please contact admin for password reset");
  };

  return (
    <View className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="flex-1 px-6 justify-center min-h-screen py-8">
          {/* Header */}
          <View className="items-center mb-10">
            <Text className="text-3xl font-bold text-green-700">Kalangka</Text>
            <Text className="text-gray-600 mt-2">Smart Farming Platform</Text>
          </View>

          {/* Login Form */}
          <View className="mb-8">
            <Text className="text-2xl font-bold text-gray-800 mb-2">
              Welcome Back
            </Text>
            <Text className="text-gray-600 mb-6">Sign in to your account</Text>

            {/* Email Input */}
            <View className="mb-4">
              <Text className="text-gray-700 mb-2 font-medium">Email</Text>
              <TextInput
                className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50"
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password Input */}
            <View className="mb-6">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-gray-700 font-medium">Password</Text>
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
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
            </View>

            {/* Forgot Password */}
            <TouchableOpacity onPress={handleForgotPassword} className="mb-6">
              <Text className="text-green-600 text-right">
                Forgot Password?
              </Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              className={`w-full rounded-xl py-4 ${loading ? "bg-green-400" : "bg-green-600"}`}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text className="text-white text-center font-semibold text-lg">
                {loading ? "Signing in..." : "Sign In"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Register Link */}
          <View className="flex-row justify-center items-center mt-8">
            <Text className="text-gray-600">Don't have an account? </Text>
            <TouchableOpacity onPress={handleRegister}>
              <Text className="text-green-600 font-semibold"> Sign Up</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View className="mt-12 pt-6 border-t border-gray-200">
            <Text className="text-gray-500 text-center text-sm">
              By signing in, you agree to our Terms and Privacy Policy
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
