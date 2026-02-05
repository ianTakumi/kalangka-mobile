// app/login.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useDispatch } from "react-redux";
import { login, setCredentials } from "../redux/slices/authSlice";
import { AppDispatch } from "../redux/store";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react-native";
import Toast from "react-native-toast-message";
import client from "@/utils/axiosInstance";

// STEP 1: Define validation schema with Zod
const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address")
    .toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

// Type for form data based on Zod schema
type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();

  // STEP 2: Initialize react-hook-form with Zod resolver
  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onChange", // Real-time validation
  });

  // STEP 3: Handle form submission
  const handleLogin = async (data: LoginFormData) => {
    setLoading(true);

    await client
      .post("/auth/login", data)
      .then((res) => {
        if (res.status === 200) {
          console.log("Login successful:", res.data);
          const { user } = res.data;
          const token = {
            access_token: res.data.session.access_token,
            refresh_token: res.data.session.refresh_token,
          };

          dispatch(login({ user, token }));
          // Show success message
          Toast.show({
            type: "success",
            text1: "Login Successful",
            text2: "Welcome back!",
          });

          router.push("/users");
        }
      })
      .catch((err) => {
        console.error("Login error:", err);
        // Show error message using Toast
        Toast.show({
          type: "error",
          text1: "Login Failed",
          text2: "Invalid email or password",
          position: "bottom",
        });
      });

    setLoading(false);
  };

  const handleRegister = () => {
    router.push("/registration");
  };

  const handleForgotPassword = () => {
    Toast.show({
      type: "info",
      text1: "Forgot Password",
      text2: "Please contact admin for password reset",
      position: "bottom",
    });
  };

  return (
    <>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 bg-white"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <View className="flex-1 px-6 justify-center min-h-screen py-8">
            {/* Header */}
            <View className="items-center mb-10">
              <Text className="text-3xl font-bold text-green-700">
                Kalangka
              </Text>
              <Text className="text-gray-600 mt-2">Smart Farming Platform</Text>
            </View>

            {/* Login Form */}
            <View className="mb-8">
              <Text className="text-2xl font-bold text-gray-800 mb-2">
                Welcome Back
              </Text>
              <Text className="text-gray-600 mb-6">
                Sign in to your account
              </Text>

              {/* Email Input */}
              <View className="mb-4">
                <Text className="text-gray-700 mb-2 font-medium">Email *</Text>
                <Controller
                  control={control}
                  name="email"
                  render={({ field: { onChange, value, onBlur } }) => (
                    <View>
                      <TextInput
                        className={`w-full border rounded-xl px-4 py-3 ${
                          errors.email
                            ? "border-red-500 bg-red-50"
                            : "border-gray-300 bg-gray-50"
                        }`}
                        placeholder="your.email@example.com"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      {errors.email && (
                        <Text className="text-red-500 text-sm mt-1 ml-1">
                          {errors.email.message}
                        </Text>
                      )}
                    </View>
                  )}
                />
              </View>

              {/* Password Input */}
              <View className="mb-6">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-gray-700 font-medium">Password *</Text>
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <View className="flex-row items-center">
                      {showPassword ? (
                        <EyeOff size={18} color="#059669" />
                      ) : (
                        <Eye size={18} color="#059669" />
                      )}
                      <Text className="text-green-600 text-sm ml-1">
                        {showPassword ? "Hide" : "Show"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
                <Controller
                  control={control}
                  name="password"
                  render={({ field: { onChange, value, onBlur } }) => (
                    <View>
                      <TextInput
                        className={`w-full border text-black rounded-xl px-4 py-3 ${
                          errors.password
                            ? "border-red-500 bg-red-50"
                            : "border-gray-300 bg-gray-50"
                        }`}
                        placeholder="Enter your password"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        secureTextEntry={!showPassword}
                      />
                      {errors.password && (
                        <Text className="text-red-500 text-sm mt-1 ml-1">
                          {errors.password.message}
                        </Text>
                      )}
                    </View>
                  )}
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
                className={`w-full rounded-xl py-4 ${
                  loading || !isValid ? "bg-green-400" : "bg-green-600"
                }`}
                onPress={handleSubmit(handleLogin)}
                disabled={loading || !isValid}
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
      </KeyboardAvoidingView>
    </>
  );
}
