import client from "@/utils/axiosInstance";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { Eye, EyeOff, Lock, Mail } from "lucide-react-native";
import React, { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import Toast from "react-native-toast-message";
import { useDispatch } from "react-redux";
import { z } from "zod";
import { login } from "../redux/slices/authSlice";
import { AppDispatch } from "../redux/store";

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

    const trimmedData = {
      ...data,
      password: data.password.trim(),
    };

    await client
      .post("/auth/login", trimmedData)
      .then((res) => {
        if (res.status === 200) {
          console.log("Login successful:", res.data);
          const { user } = res.data;
          const token = {
            access_token: res.data.access_token,
            token_type: res.data.token_type,
          };

          dispatch(login({ user, token }));
          // Show success message
          Toast.show({
            type: "success",
            text1: "Login Successful",
            text2: "Welcome back!",
          });

          if (user.role !== "admin") {
            router.push("/users");
          } else {
            router.push("/admin");
          }
        }
      })
      .catch((err) => {
        console.error("Login error:", err);
        // Show error message using Toast
        Toast.show({
          type: "error",
          text1: "Login Failed",
          text2: "Invalid email or password",
          position: "top",
        });
      });

    setLoading(false);
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
        {/* Header */}
        <View className="items-center mb-10">
          <Image
            source={require("../assets/images/logo/logo.png")}
            className="w-24 h-24 mb-2"
            resizeMode="contain"
          />
          <Text className="text-3xl font-bold text-green-700">WrapCrop</Text>
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
            <View
              className={`flex-row items-center border rounded-xl px-4 ${
                errors.email
                  ? "border-red-500 bg-red-50"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              <Mail size={18} color={errors.email ? "#EF4444" : "#9CA3AF"} />
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value, onBlur } }) => (
                  <TextInput
                    className="flex-1 py-3 ml-2 text-gray-800"
                    placeholder="your.email@example.com"
                    placeholderTextColor="#9CA3AF"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                )}
              />
            </View>
            {errors.email && (
              <Text className="text-red-500 text-sm mt-1 ml-1">
                {errors.email.message}
              </Text>
            )}
          </View>

          {/* Password Input */}
          <View className="mb-6">
            <Text className="text-gray-700 mb-2 font-medium">Password</Text>
            <View
              className={`flex-row items-center border rounded-xl px-4 ${
                errors.password
                  ? "border-red-500 bg-red-50"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              <Lock size={18} color={errors.password ? "#EF4444" : "#9CA3AF"} />
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value, onBlur } }) => (
                  <TextInput
                    className="flex-1 py-3 ml-2 text-gray-800"
                    placeholder="Enter your password"
                    placeholderTextColor="#9CA3AF"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry={!showPassword}
                  />
                )}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                {showPassword ? (
                  <EyeOff size={18} color="#6B7280" />
                ) : (
                  <Eye size={18} color="#6B7280" />
                )}
              </TouchableOpacity>
            </View>
            {errors.password && (
              <Text className="text-red-500 text-sm mt-1 ml-1">
                {errors.password.message}
              </Text>
            )}
          </View>

          {/* Login Button */}
          <TouchableOpacity
            className={`w-full rounded-xl py-4 ${
              loading || !isValid
                ? "bg-emerald-300" // ← ITO ANG BAGONG BG COLOR (light green kapag disabled)
                : "bg-emerald-600" // ← ITO NAMAN (dark green kapag active)
            } shadow-sm`} // ← DINAGDAG: shadow effect
            onPress={handleSubmit(handleLogin)}
            disabled={loading || !isValid}
            activeOpacity={0.8} // ← DINAGDAG: nagfa-fade kapag pinindot
          >
            {loading ? (
              <View className="flex-row items-center justify-center gap-2">
                <ActivityIndicator size="small" color="#FFFFFF" />{" "}
                {/* ← DINAGDAG: loading spinner */}
                <Text className="text-white text-center font-semibold text-base">
                  Signing in...
                </Text>
              </View>
            ) : (
              <Text className="text-white text-center font-semibold text-base">
                Sign In
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        {/* <View className="mt-12 pt-6 border-t border-gray-200">
          <Text className="text-gray-500 text-center text-sm">
            By signing in, you agree to our Terms and Privacy Policy
          </Text>
        </View> */}
      </View>
    </KeyboardAwareScrollView>
  );
}
