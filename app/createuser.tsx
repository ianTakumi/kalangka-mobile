import UserService from "@/services/UserService";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { Eye, EyeOff, Shield, User } from "lucide-react-native";
import React, { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import Toast from "react-native-toast-message";
import { z } from "zod";

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
    role: z.enum(["user", "admin"], {
      errorMap: () => ({ message: "Please select a role" }),
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

type RegistrationFormData = z.infer<typeof registrationSchema>;

export default function CreateUser() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"user" | "admin">("user");

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isValid },
    watch,
  } = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      gender: "male",
      role: "user",
      password: "",
      confirmPassword: "",
    },
    mode: "onChange",
  });

  // Watch role value for debugging
  const currentRole = watch("role");
  console.log("Current selected role:", currentRole);

  const handleRegister = async (data: RegistrationFormData) => {
    setLoading(true);

    // Log the data being sent
    console.log("📤 Sending registration data:", {
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      gender: data.gender,
      role: data.role,
      password: "***",
    });

    try {
      // Make sure role is explicitly passed
      const userData = {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        gender: data.gender,
        role: data.role, // Explicitly pass role
        password: data.password,
      };

      console.log("📤 Calling UserService.createUser with:", userData);

      const userId = await UserService.createUser(userData);

      console.log("✅ User created with ID:", userId);
      console.log("✅ Role saved:", data.role);

      Toast.show({
        type: "success",
        text1: "User Created Successfully",
        text2: `${data.first_name} ${data.last_name} (${data.role}) has been created.`,
      });

      // Wait a bit before navigating
      setTimeout(() => {
        router.push("/admin/users");
      }, 1000);
    } catch (error: any) {
      console.error("❌ Registration error:", error);
      Toast.show({
        type: "error",
        text1: "User Creation Failed",
        text2: error.message || "Something went wrong. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      enableOnAndroid={true}
      extraScrollHeight={Platform.OS === "ios" ? 0 : 20}
      keyboardShouldPersistTaps="handled"
      className="bg-white"
    >
      <View className="flex-1 px-6 py-8 mt-10">
        {/* Header */}
        <View className="items-center mb-8">
          <Text className="text-3xl font-bold text-green-700">
            Create Account
          </Text>
          <Text className="text-gray-600 mt-2 text-center">
            Add farm workers or administrators to your farm
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

          {/* Role Selection - FIXED */}
          <View className="mb-4">
            <Text className="text-gray-700 mb-2 font-medium">Role *</Text>
            <View className="flex-row gap-4">
              <TouchableOpacity
                className={`flex-1 py-3 rounded-xl border flex-row items-center justify-center ${currentRole === "user" ? "bg-emerald-50 border-emerald-500" : "bg-gray-50 border-gray-300"}`}
                onPress={() => {
                  console.log("🟢 User role selected");
                  setValue("role", "user", { shouldValidate: true });
                  setSelectedRole("user");
                }}
              >
                <User
                  size={18}
                  color={currentRole === "user" ? "#047857" : "#6b7280"}
                />
                <Text
                  className={`text-center ml-2 ${currentRole === "user" ? "text-emerald-700 font-semibold" : "text-gray-600"}`}
                >
                  User
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={`flex-1 py-3 rounded-xl border flex-row items-center justify-center ${currentRole === "admin" ? "bg-purple-50 border-purple-500" : "bg-gray-50 border-gray-300"}`}
                onPress={() => {
                  console.log("🟣 Admin role selected");
                  setValue("role", "admin", { shouldValidate: true });
                  setSelectedRole("admin");
                }}
              >
                <Shield
                  size={18}
                  color={currentRole === "admin" ? "#6b21a8" : "#6b7280"}
                />
                <Text
                  className={`text-center ml-2 ${currentRole === "admin" ? "text-purple-700 font-semibold" : "text-gray-600"}`}
                >
                  Admin
                </Text>
              </TouchableOpacity>
            </View>

            {/* Hidden input for react-hook-form */}
            <Controller
              control={control}
              name="role"
              render={({ field: { value } }) => (
                <Text className="hidden">Current role: {value}</Text>
              )}
            />

            {errors.role && (
              <Text className="text-red-500 text-sm mt-1 ml-1">
                {errors.role.message}
              </Text>
            )}
            <Text className="text-gray-500 text-xs mt-2 ml-1">
              Users have standard access, Admins have full system access
            </Text>
          </View>

          {/* Password */}
          <View className="mb-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-gray-700 font-medium">Password *</Text>
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
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
                    className={`w-full border rounded-xl px-4 text-gray-900 py-3 ${errors.password ? "border-red-500 bg-red-50" : "border-gray-300 bg-gray-50"}`}
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
                    className={`w-full border rounded-xl px-4 py-3 text-gray-900 ${errors.confirmPassword ? "border-red-500 bg-red-50" : "border-gray-300 bg-gray-50"}`}
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

          {/* Debug info - remove in production */}
          <Text className="text-gray-400 text-xs text-center mt-4">
            Selected role: {currentRole}
          </Text>
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
}
