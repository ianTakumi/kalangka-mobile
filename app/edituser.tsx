// app/edit-user.tsx
import userService from "@/services/UserService";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { z } from "zod";

// STEP 1: Define validation schema with Zod (no password fields)
const editUserSchema = z.object({
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
});

// Type for form data based on Zod schema
type EditUserFormData = z.infer<typeof editUserSchema>;

interface UserData {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  gender: string;
}

export default function EditUser() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);

  // STEP 2: Parse user data from params
  useEffect(() => {
    if (params.userData) {
      try {
        const parsedUser = JSON.parse(params.userData as string);
        setUserData(parsedUser);
        setFetchLoading(false);
      } catch (error) {
        console.error("Error parsing user data:", error);
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Failed to load user data",
        });
        router.back();
      }
    } else {
      setFetchLoading(false);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "No user data provided",
      });
      router.back();
    }
  }, [params.userData]); // ← Dependency lang sa params.userData

  // Separate useEffect for resetting form
  useEffect(() => {
    if (userData) {
      reset({
        first_name: userData.first_name,
        last_name: userData.last_name,
        email: userData.email,
        gender: userData.gender as "male" | "female",
      });
    }
  }, [userData, reset]); // ← Magti-trigger lang kapag nagbago ang userData

  // STEP 3: Initialize react-hook-form with Zod resolver
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid, isDirty },
  } = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      gender: "male",
    },
    mode: "onChange",
  });

  // STEP 4: Handle form submission using UserService
  const handleUpdateUser = async (data: EditUserFormData) => {
    if (!userData) return;

    setLoading(true);

    const updateData = {
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      gender: data.gender,
    };

    try {
      // Use UserService to update user
      const success = await userService.updateUser(userData.id, updateData);

      if (success) {
        Toast.show({
          type: "success",
          text1: "Update Successful",
          text2: "User information has been updated.",
        });
        router.push("/admin/users");
      } else {
        Toast.show({
          type: "error",
          text1: "Update Failed",
          text2: "Something went wrong. Please try again.",
        });
      }
    } catch (error: any) {
      console.log(error);
      Toast.show({
        type: "error",
        text1: "Update Failed",
        text2: error.message || "Something went wrong. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#059669" />
        <Text className="mt-4 text-gray-600">Loading user data...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1 mt-5"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="px-6 py-8">
          {/* Header with Back Button */}
          <View className="flex-row items-center mb-8">
            <TouchableOpacity
              onPress={() => router.back()}
              className="mr-4 p-2"
            >
              <ArrowLeft size={24} color="#4b5563" />
            </TouchableOpacity>
            <View>
              <Text className="text-3xl font-bold text-green-700">
                Edit User
              </Text>
              <Text className="text-gray-500 text-base mt-1">
                Update user information
              </Text>
            </View>
          </View>

          {/* Edit Form */}
          <View className="gap-6">
            {/* Name Fields */}
            <View>
              <Text className="text-gray-700 font-semibold mb-3">
                Full Name
              </Text>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Controller
                    control={control}
                    name="first_name"
                    render={({ field: { onChange, value, onBlur } }) => (
                      <View>
                        <TextInput
                          className={`w-full border rounded-xl px-4 py-4 text-gray-900 ${
                            errors.first_name
                              ? "border-red-500 bg-red-50"
                              : "border-gray-300 bg-gray-50"
                          }`}
                          placeholder="First name"
                          placeholderTextColor="#9ca3af"
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                        />
                        {errors.first_name && (
                          <Text className="text-red-500 text-sm mt-2 ml-1">
                            {errors.first_name.message}
                          </Text>
                        )}
                      </View>
                    )}
                  />
                </View>

                <View className="flex-1">
                  <Controller
                    control={control}
                    name="last_name"
                    render={({ field: { onChange, value, onBlur } }) => (
                      <View>
                        <TextInput
                          className={`w-full border rounded-xl px-4 py-4 text-gray-900 ${
                            errors.last_name
                              ? "border-red-500 bg-red-50"
                              : "border-gray-300 bg-gray-50"
                          }`}
                          placeholder="Last name"
                          placeholderTextColor="#9ca3af"
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                        />
                        {errors.last_name && (
                          <Text className="text-red-500 text-sm mt-2 ml-1">
                            {errors.last_name.message}
                          </Text>
                        )}
                      </View>
                    )}
                  />
                </View>
              </View>
            </View>

            {/* Email */}
            <View>
              <Text className="text-gray-700 font-semibold mb-3">
                Email Address
              </Text>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value, onBlur } }) => (
                  <View>
                    <TextInput
                      className={`w-full border rounded-xl px-4 py-4 text-gray-900 ${
                        errors.email
                          ? "border-red-500 bg-red-50"
                          : "border-gray-300 bg-gray-50"
                      }`}
                      placeholder="your.email@example.com"
                      placeholderTextColor="#9ca3af"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {errors.email && (
                      <Text className="text-red-500 text-sm mt-2 ml-1">
                        {errors.email.message}
                      </Text>
                    )}
                  </View>
                )}
              />
            </View>

            {/* Gender Selection */}
            <View>
              <Text className="text-gray-700 font-semibold mb-3">Gender</Text>
              <Controller
                control={control}
                name="gender"
                render={({ field: { onChange, value } }) => (
                  <View className="flex-row gap-3">
                    <TouchableOpacity
                      className={`flex-1 py-4 rounded-xl border-2 ${
                        value === "male"
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 bg-gray-50"
                      }`}
                      onPress={() => onChange("male")}
                    >
                      <Text
                        className={`text-center font-medium ${
                          value === "male" ? "text-blue-600" : "text-gray-600"
                        }`}
                      >
                        Male
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      className={`flex-1 py-4 rounded-xl border-2 ${
                        value === "female"
                          ? "border-pink-500 bg-pink-50"
                          : "border-gray-200 bg-gray-50"
                      }`}
                      onPress={() => onChange("female")}
                    >
                      <Text
                        className={`text-center font-medium ${
                          value === "female" ? "text-pink-600" : "text-gray-600"
                        }`}
                      >
                        Female
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
              {errors.gender && (
                <Text className="text-red-500 text-sm mt-2 ml-1">
                  {errors.gender.message}
                </Text>
              )}
            </View>

            {/* Action Buttons */}
            <View className="flex-row gap-3 pt-6">
              <TouchableOpacity
                className="flex-1 bg-gray-100 rounded-xl py-4"
                onPress={() => router.back()}
                disabled={loading}
              >
                <Text className="text-gray-700 text-center font-semibold text-lg">
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={`flex-1 rounded-xl py-4 ${
                  loading || !isDirty || !isValid
                    ? "bg-green-300"
                    : "bg-green-600"
                }`}
                onPress={handleSubmit(handleUpdateUser)}
                disabled={loading || !isDirty || !isValid}
              >
                <Text className="text-white text-center font-semibold text-lg">
                  {loading ? "Saving..." : "Save Changes"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
