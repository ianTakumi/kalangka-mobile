import client from "@/utils/axiosInstance";
import NetInfo from "@react-native-community/netinfo";
import { useRouter } from "expo-router";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Mail,
  WifiOff,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [isOffline, setIsOffline] = useState(false);

  // Check network status on mount and listen for changes
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
    });

    // Initial check
    NetInfo.fetch().then((state) => {
      setIsOffline(!state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async () => {
    // Clear previous error
    setError("");

    // Check offline
    if (isOffline) {
      setError("No internet connection. Please check your network.");
      return;
    }

    // Basic validation
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setIsLoading(true);

    try {
      const response = await client.post("/auth/forgot-password", {
        email: email.trim().toLowerCase(),
      });

      if (response.status === 200) {
        setIsSubmitted(true);
      }
    } catch (err: any) {
      console.error("Forgot password error:", err);
      setError(
        err.response?.data?.message ||
          "Failed to send reset link. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollView
      className="flex-1 pt-10 bg-white"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      extraScrollHeight={20}
      enableOnAndroid={true}
    >
      <View className="flex-1 px-6 justify-center py-8">
        {isSubmitted ? (
          // ✅ SUCCESS STATE
          <View className="items-center">
            <View className="w-20 h-20 bg-green-100 rounded-full items-center justify-center mb-6">
              <CheckCircle size={40} color="#059669" />
            </View>
            <Text className="text-2xl font-bold text-gray-800 mb-3 text-center">
              Check Your Email
            </Text>
            <Text className="text-gray-500 text-center mb-2">
              We've sent a password reset link to
            </Text>
            <Text className="text-emerald-600 font-semibold text-center mb-8">
              {email}
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/login")}
              className="w-full bg-emerald-600 py-4 rounded-xl shadow-sm"
              activeOpacity={0.8}
            >
              <Text className="text-white text-center font-semibold text-base">
                Return to Login
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          // 📧 FORM STATE
          <>
            {/* Back Button */}
            <TouchableOpacity
              onPress={() => router.back()}
              className="flex-row items-center mb-8"
              activeOpacity={0.7}
            >
              <ArrowLeft size={18} color="#059669" />
              <Text className="text-emerald-700 font-medium ml-1">
                Back to Login
              </Text>
            </TouchableOpacity>

            {/* Header */}
            <View className="items-center mb-8">
              <View className="w-20 h-20 bg-green-100 rounded-full items-center justify-center mb-4">
                <Mail size={36} color="#059669" />
              </View>
              <Text className="text-2xl font-bold text-gray-800 mb-2 text-center">
                Forgot Password?
              </Text>
              <Text className="text-gray-500 text-center text-sm leading-5">
                No worries! Enter your email below and we'll send you a reset
                link.
              </Text>
            </View>

            {/* Offline Banner */}
            {isOffline && (
              <View className="flex-row items-center bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 mb-4">
                <WifiOff size={18} color="#D97706" />
                <Text className="text-yellow-700 ml-2 text-sm flex-1">
                  You're offline. Please check your internet connection.
                </Text>
              </View>
            )}

            {/* Email Input */}
            <View className="mb-4">
              <Text className="text-gray-700 mb-2 font-medium">
                Email Address
              </Text>
              <View
                className={`flex-row items-center border rounded-xl px-4 ${
                  error
                    ? "border-red-500 bg-red-50"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <Mail size={18} color={error ? "#EF4444" : "#9CA3AF"} />
                <TextInput
                  className="flex-1 py-3 ml-2 text-gray-800"
                  placeholder="you@example.com"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (error) setError("");
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>
              {error && (
                <View className="flex-row items-center mt-1 ml-1">
                  <AlertCircle size={14} color="#EF4444" />
                  <Text className="text-red-500 text-sm ml-1">{error}</Text>
                </View>
              )}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isLoading || isOffline}
              className={`w-full py-4 rounded-xl shadow-sm ${
                isOffline ? "bg-gray-400" : "bg-emerald-600"
              }`}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <View className="flex-row items-center justify-center gap-2">
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text className="text-white text-center font-semibold text-base">
                    Sending...
                  </Text>
                </View>
              ) : (
                <Text className="text-white text-center font-semibold text-base">
                  Send Reset Link
                </Text>
              )}
            </TouchableOpacity>

            <Text className="text-gray-400 text-xs text-center mt-4">
              We'll send a secure reset link to this email address.
            </Text>

            {/* Footer */}
            <View className="border-t border-gray-200 mt-8 pt-6">
              <Text className="text-gray-500 text-sm text-center">
                Remember your password?{" "}
                <Text
                  className="text-emerald-600 font-medium"
                  onPress={() => router.push("/login")}
                >
                  Sign in
                </Text>
              </Text>
            </View>
          </>
        )}
      </View>
    </KeyboardAwareScrollView>
  );
}
