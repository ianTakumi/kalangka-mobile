// app/registration.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react-native";
import client from "@/utils/axiosInstance";
import Toast from "react-native-toast-message";

// STEP 1: Define validation schema with Zod
const registrationSchema = z
  .object({
    first_name: z
      .string()
      .min(1, "First name is required")
      .max(50, "First name is too long")
      .regex(/^[a-zA-Z\s]+$/, "First name should only contain letters"),
    last_name: z
      .string()
      .min(1, "Last name is required")
      .max(50, "Last name is too long")
      .regex(/^[a-zA-Z\s]+$/, "Last name should only contain letters"),
    email: z
      .string()
      .min(1, "Email is required")
      .email("Please enter a valid email address")
      .toLowerCase(),
    gender: z.enum(["male", "female"], {
      errorMap: () => ({ message: "Please select gender" }),
    }),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      ),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// Type for form data based on Zod schema
type RegistrationFormData = z.infer<typeof registrationSchema>;

export default function RegistrationScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // STEP 2: Initialize react-hook-form with Zod resolver
  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      gender: "male",
      password: "",
      confirmPassword: "",
    },
    mode: "onChange", // Real-time validation
  });

  // STEP 3: Handle form submission
  const handleRegister = async (data: RegistrationFormData) => {
    setLoading(true);
    console.log(data);

    await client
      .post("/auth/register", data)
      .then((res) => {
        console.log(res);
        if (res.status === 201) {
          Toast.show({
            type: "success",
            text1: "Registration Successful",
            text2: "You can now log in with your credentials.",
          });
          router.push("/login");
        }
      })
      .catch((err) => {
        console.log(err);
        Toast.show({
          type: "error",
          text1: "Registration Failed",
          text2:
            err.response?.data?.message ||
            "Something went wrong. Please try again.",
        });
      });
    setLoading(false);
  };

  const handleLogin = () => {
    router.push("/login");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View className="flex-1 px-6 py-8">
          {/* Header */}
          <View className="items-center mb-8">
            <Text className="text-3xl font-bold text-green-700">
              Create Account
            </Text>
            <Text className="text-gray-600 mt-2 text-center">
              Join Kalangka Smart Farming Platform
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
                <Controller
                  control={control}
                  name="first_name"
                  render={({ field: { onChange, value, onBlur } }) => (
                    <View>
                      <TextInput
                        className={`w-full border rounded-xl px-4 py-3 ${errors.first_name ? "border-red-500 bg-red-50" : "border-gray-300 bg-gray-50"}`}
                        placeholder="John"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                      />
                      {errors.first_name && (
                        <Text className="text-red-500 text-sm mt-1 ml-1">
                          {errors.first_name.message}
                        </Text>
                      )}
                    </View>
                  )}
                />
              </View>

              <View className="flex-1 ml-2">
                <Text className="text-gray-700 mb-2 font-medium">
                  Last Name *
                </Text>
                <Controller
                  control={control}
                  name="last_name"
                  render={({ field: { onChange, value, onBlur } }) => (
                    <View>
                      <TextInput
                        className={`w-full border rounded-xl px-4 py-3 ${errors.last_name ? "border-red-500 bg-red-50" : "border-gray-300 bg-gray-50"}`}
                        placeholder="Doe"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                      />
                      {errors.last_name && (
                        <Text className="text-red-500 text-sm mt-1 ml-1">
                          {errors.last_name.message}
                        </Text>
                      )}
                    </View>
                  )}
                />
              </View>
            </View>

            {/* Email */}
            <View className="mb-4">
              <Text className="text-gray-700 mb-2 font-medium">Email *</Text>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value, onBlur } }) => (
                  <View>
                    <TextInput
                      className={`w-full border rounded-xl px-4 py-3 ${errors.email ? "border-red-500 bg-red-50" : "border-gray-300 bg-gray-50"}`}
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

            {/* Gender Selection */}
            <View className="mb-4">
              <Text className="text-gray-700 mb-2 font-medium">Gender *</Text>
              <Controller
                control={control}
                name="gender"
                render={({ field: { onChange, value } }) => (
                  <View className="flex-row gap-4">
                    <TouchableOpacity
                      className={`flex-1 py-3 rounded-xl border ${value === "male" ? "bg-blue-50 border-blue-500" : "bg-gray-50 border-gray-300"}`}
                      onPress={() => onChange("male")}
                    >
                      <Text
                        className={`text-center ${value === "male" ? "text-blue-600 font-semibold" : "text-gray-600"}`}
                      >
                        Male
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className={`flex-1 py-3 rounded-xl border ${value === "female" ? "bg-pink-50 border-pink-500" : "bg-gray-50 border-gray-300"}`}
                      onPress={() => onChange("female")}
                    >
                      <Text
                        className={`text-center ${value === "female" ? "text-pink-600 font-semibold" : "text-gray-600"}`}
                      >
                        Female
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
              {errors.gender && (
                <Text className="text-red-500 text-sm mt-1 ml-1">
                  {errors.gender.message}
                </Text>
              )}
            </View>

            {/* Password */}
            <View className="mb-4">
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
                      className={`w-full border rounded-xl px-4 py-3 ${errors.password ? "border-red-500 bg-red-50" : "border-gray-300 bg-gray-50"}`}
                      placeholder="At least 6 characters"
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
                    <Text className="text-gray-500 text-xs mt-2 ml-1">
                      Must contain uppercase, lowercase, and number
                    </Text>
                  </View>
                )}
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
                  <View className="flex-row items-center">
                    {showConfirmPassword ? (
                      <EyeOff size={18} color="#059669" />
                    ) : (
                      <Eye size={18} color="#059669" />
                    )}
                    <Text className="text-green-600 text-sm ml-1">
                      {showConfirmPassword ? "Hide" : "Show"}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, value, onBlur } }) => (
                  <View>
                    <TextInput
                      className={`w-full border rounded-xl px-4 py-3 ${errors.confirmPassword ? "border-red-500 bg-red-50" : "border-gray-300 bg-gray-50"}`}
                      placeholder="Confirm your password"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      secureTextEntry={!showConfirmPassword}
                    />
                    {errors.confirmPassword && (
                      <Text className="text-red-500 text-sm mt-1 ml-1">
                        {errors.confirmPassword.message}
                      </Text>
                    )}
                  </View>
                )}
              />
            </View>

            {/* Register Button */}
            <TouchableOpacity
              className={`w-full rounded-xl py-4 ${loading || !isValid ? "bg-green-400" : "bg-green-600"}`}
              onPress={handleSubmit(handleRegister)}
              disabled={loading || !isValid}
            >
              <Text className="text-white text-center font-semibold text-lg">
                {loading ? "Creating Account..." : "Create Account"}
              </Text>
            </TouchableOpacity>

            {/* Terms & Conditions */}
            <View className="mt-6 p-4 bg-gray-50 rounded-xl">
              <Text className="text-gray-700 text-sm text-center">
                By creating an account, you agree to our{" "}
                <Text className="text-green-600 font-medium">
                  Terms of Service
                </Text>{" "}
                and{" "}
                <Text className="text-green-600 font-medium">
                  Privacy Policy
                </Text>
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
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
