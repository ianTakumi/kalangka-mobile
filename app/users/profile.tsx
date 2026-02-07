import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/redux/store";
import { logout } from "@/redux/slices/authSlice";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function ProfileScreen() {
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => {
          setLoading(true);
          // Simulate API call
          setTimeout(() => {
            dispatch(logout());
            setLoading(false);
            router.replace("/login");
          }, 1000);
        },
      },
    ]);
  };

  const handleEditProfile = () => {
    router.push("/users/editProfile");
  };

  const handleChangePassword = () => {
    router.push("/users/changePassword");
  };

  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 justify-center items-center">
          <Text className="text-gray-500 text-lg">No user data found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="bg-white pt-8 pb-6 px-6">
          <View className="items-center mb-6">
            {user.avatar ? (
              <Image
                source={{ uri: user.avatar }}
                className="w-32 h-32 rounded-full border-4 border-green-100"
              />
            ) : (
              <View className="w-32 h-32 bg-green-600 rounded-full items-center justify-center border-4 border-green-100">
                <Text className="text-white text-4xl font-bold">
                  {user.first_name?.[0]}
                  {user.last_name?.[0]}
                </Text>
              </View>
            )}
            <TouchableOpacity
              className="absolute bottom-0 right-24 bg-green-600 p-3 rounded-full"
              onPress={handleEditProfile}
            >
              <Ionicons name="camera" size={20} color="white" />
            </TouchableOpacity>
          </View>

          <View className="items-center">
            <Text className="text-2xl font-bold text-gray-800">
              {user.first_name} {user.last_name}
            </Text>
            <Text className="text-gray-500 text-base mt-1">{user.email}</Text>
            <View className="flex-row items-center mt-2">
              <View className="bg-green-100 px-3 py-1 rounded-full">
                <Text className="text-green-700 text-sm font-medium capitalize">
                  {user.role}
                </Text>
              </View>
              <View className="bg-gray-100 px-3 py-1 rounded-full ml-2">
                <Text className="text-gray-600 text-sm font-medium capitalize">
                  {user.gender}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Profile Info Section */}
        <View className="mt-6 mx-6 bg-white rounded-2xl shadow-sm">
          <View className="p-6">
            <Text className="text-lg font-semibold text-gray-800 mb-4">
              Profile Information
            </Text>

            <View className="space-y-4">
              <View className="flex-row justify-between items-center py-3 border-b border-gray-100">
                <View className="flex-1">
                  <Text className="text-gray-500 text-sm">First Name</Text>
                  <Text className="text-gray-800 text-base font-medium mt-1">
                    {user.first_name}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleEditProfile}>
                  <Ionicons name="pencil" size={20} color="#16a34a" />
                </TouchableOpacity>
              </View>

              <View className="flex-row justify-between items-center py-3 border-b border-gray-100">
                <View className="flex-1">
                  <Text className="text-gray-500 text-sm">Last Name</Text>
                  <Text className="text-gray-800 text-base font-medium mt-1">
                    {user.last_name}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleEditProfile}>
                  <Ionicons name="pencil" size={20} color="#16a34a" />
                </TouchableOpacity>
              </View>

              <View className="flex-row justify-between items-center py-3 border-b border-gray-100">
                <View className="flex-1">
                  <Text className="text-gray-500 text-sm">Email</Text>
                  <Text className="text-gray-800 text-base font-medium mt-1">
                    {user.email}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleEditProfile}>
                  <Ionicons name="pencil" size={20} color="#16a34a" />
                </TouchableOpacity>
              </View>

              <View className="flex-row justify-between items-center py-3">
                <View className="flex-1">
                  <Text className="text-gray-500 text-sm">Gender</Text>
                  <Text className="text-gray-800 text-base font-medium mt-1 capitalize">
                    {user.gender}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleEditProfile}>
                  <Ionicons name="pencil" size={20} color="#16a34a" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Account Settings Section */}
        <View className="mt-6 mx-6 bg-white rounded-2xl shadow-sm">
          <View className="p-6">
            <Text className="text-lg font-semibold text-gray-800 mb-4">
              Account Settings
            </Text>

            <TouchableOpacity
              className="flex-row items-center justify-between py-4 border-b border-gray-100"
              onPress={handleEditProfile}
            >
              <View className="flex-row items-center">
                <View className="w-10 h-10 bg-green-100 rounded-full items-center justify-center mr-3">
                  <Ionicons name="person" size={20} color="#16a34a" />
                </View>
                <View>
                  <Text className="text-gray-800 font-medium">
                    Edit Profile
                  </Text>
                  <Text className="text-gray-500 text-sm">
                    Update your personal information
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center justify-between py-4 border-b border-gray-100"
              onPress={handleChangePassword}
            >
              <View className="flex-row items-center">
                <View className="w-10 h-10 bg-green-100 rounded-full items-center justify-center mr-3">
                  <Ionicons name="lock-closed" size={20} color="#16a34a" />
                </View>
                <View>
                  <Text className="text-gray-800 font-medium">
                    Change Password
                  </Text>
                  <Text className="text-gray-500 text-sm">
                    Set a new password for your account
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center justify-between py-4"
              onPress={handleLogout}
              disabled={loading}
            >
              <View className="flex-row items-center">
                <View className="w-10 h-10 bg-red-100 rounded-full items-center justify-center mr-3">
                  <Ionicons name="log-out" size={20} color="#ef4444" />
                </View>
                <View>
                  <Text className="text-gray-800 font-medium">Logout</Text>
                  <Text className="text-gray-500 text-sm">
                    Sign out from your account
                  </Text>
                </View>
              </View>
              {loading ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Account Created Info */}
        <View className="mt-6 mx-6 mb-10">
          <Text className="text-gray-500 text-center text-sm">
            Account created on{" "}
            {new Date(user.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Action Button */}
      <View className="p-6 bg-white border-t border-gray-200">
        <TouchableOpacity
          className="bg-green-600 py-4 rounded-xl items-center"
          onPress={handleEditProfile}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold text-lg">
              Edit Profile
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
