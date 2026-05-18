import { logout } from "@/redux/slices/authSlice";
import { RootState } from "@/redux/store";
import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";

// Accessibility constants
const TOUCH_TARGET = 56;
const ICON_SIZE_XL = 36;
const ICON_SIZE_LG = 28;
const ICON_SIZE_MD = 24;
const FONT_SIZE_TITLE = 28;
const FONT_SIZE_HEADING = 22;
const FONT_SIZE_BODY = 18;
const FONT_SIZE_CAPTION = 16;
const FONT_SIZE_SMALL = 15;

export default function ProfileScreen() {
  const user = useSelector((state: RootState) => state.auth.user);
  console.log(user);
  const dispatch = useDispatch();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected && state.isInternetReachable);
    });

    // Check initial network state
    NetInfo.fetch().then((state) => {
      setIsOnline(state.isConnected && state.isInternetReachable);
    });

    return () => {
      unsubscribe();
    };
  }, []);

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
    if (!isOnline) {
      Alert.alert(
        "Offline Mode",
        "You need an internet connection to edit your profile. Please connect to the internet and try again.",
      );
      return;
    }
    router.push("/users/editProfile");
  };

  const handleChangePassword = () => {
    if (!isOnline) {
      Alert.alert(
        "Offline Mode",
        "You need an internet connection to change your password. Please connect to the internet and try again.",
      );
      return;
    }
    router.push("/users/changePassword");
  };

  const handleGoBack = () => {
    router.back();
  };

  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 justify-center items-center">
          <Text className="text-gray-500 text-xl">No user data found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Offline Banner - Larger */}
      {!isOnline && (
        <View className="bg-yellow-500 py-3 px-4">
          <View className="flex-row items-center justify-center">
            <Ionicons
              name="cloud-offline-outline"
              size={ICON_SIZE_MD}
              color="white"
            />
            <Text className="text-white font-semibold ml-3 text-base">
              You&apos;re offline. Some features are disabled.
            </Text>
          </View>
        </View>
      )}

      {/* Header with Back Button - Larger */}
      <SafeAreaView edges={["top"]} className="bg-white">
        <View className="pt-6 pb-3 px-4 flex-row items-center border-b border-gray-100">
          <TouchableOpacity
            onPress={handleGoBack}
            className="w-12 h-12 rounded-full items-center justify-center bg-gray-100 active:bg-gray-200"
            style={{ minWidth: TOUCH_TARGET, minHeight: TOUCH_TARGET }}
          >
            <Ionicons name="chevron-back" size={ICON_SIZE_MD} color="#374151" />
          </TouchableOpacity>
          <Text
            className="flex-1 text-center font-semibold text-gray-800 mr-12"
            style={{ fontSize: FONT_SIZE_TITLE }}
          >
            Profile
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Profile Header - Larger Avatar */}
        <View className="bg-white pt-10 pb-8 px-6">
          <View className="items-center mb-6">
            <View className="w-36 h-36 bg-green-600 rounded-full items-center justify-center border-4 border-green-100 shadow-sm">
              <Text className="text-white font-bold" style={{ fontSize: 48 }}>
                {user.first_name?.[0]}
                {user.last_name?.[0]}
              </Text>
            </View>
          </View>

          <View className="items-center">
            <Text
              className="font-bold text-gray-800"
              style={{ fontSize: FONT_SIZE_HEADING }}
            >
              {user.first_name} {user.last_name}
            </Text>
            <Text
              className="text-gray-500 mt-2"
              style={{ fontSize: FONT_SIZE_BODY }}
            >
              {user.email}
            </Text>
            <View className="flex-row items-center mt-3 gap-2">
              <View className="bg-green-100 px-4 py-2 rounded-full">
                <Text
                  className="text-green-700 font-semibold capitalize"
                  style={{ fontSize: FONT_SIZE_SMALL }}
                >
                  {user.role}
                </Text>
              </View>
              <View className="bg-gray-100 px-4 py-2 rounded-full">
                <Text
                  className="text-gray-600 font-semibold capitalize"
                  style={{ fontSize: FONT_SIZE_SMALL }}
                >
                  {user.gender}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Profile Info Section - Larger Touch Targets */}
        <View className="mt-8 mx-6 bg-white rounded-3xl shadow-sm">
          <View className="p-6">
            <Text
              className="font-semibold text-gray-800 mb-6"
              style={{ fontSize: FONT_SIZE_HEADING }}
            >
              Profile Information
            </Text>

            <View className="space-y-2">
              {/* First Name */}
              <View className="flex-row justify-between items-center py-4 border-b border-gray-100">
                <View className="flex-1 mr-4">
                  <Text
                    className="text-gray-500"
                    style={{ fontSize: FONT_SIZE_SMALL }}
                  >
                    First Name
                  </Text>
                  <Text
                    className="text-gray-800 font-semibold mt-2"
                    style={{ fontSize: FONT_SIZE_BODY }}
                  >
                    {user.first_name}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleEditProfile}
                  disabled={!isOnline}
                  className="w-12 h-12 items-center justify-center rounded-full active:bg-gray-100"
                  style={{ minWidth: TOUCH_TARGET, minHeight: TOUCH_TARGET }}
                >
                  <Ionicons
                    name="pencil"
                    size={ICON_SIZE_MD}
                    color={!isOnline ? "#9ca3af" : "#16a34a"}
                  />
                </TouchableOpacity>
              </View>

              {/* Last Name */}
              <View className="flex-row justify-between items-center py-4 border-b border-gray-100">
                <View className="flex-1 mr-4">
                  <Text
                    className="text-gray-500"
                    style={{ fontSize: FONT_SIZE_SMALL }}
                  >
                    Last Name
                  </Text>
                  <Text
                    className="text-gray-800 font-semibold mt-2"
                    style={{ fontSize: FONT_SIZE_BODY }}
                  >
                    {user.last_name}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleEditProfile}
                  disabled={!isOnline}
                  className="w-12 h-12 items-center justify-center rounded-full active:bg-gray-100"
                  style={{ minWidth: TOUCH_TARGET, minHeight: TOUCH_TARGET }}
                >
                  <Ionicons
                    name="pencil"
                    size={ICON_SIZE_MD}
                    color={!isOnline ? "#9ca3af" : "#16a34a"}
                  />
                </TouchableOpacity>
              </View>

              {/* Email */}
              <View className="flex-row justify-between items-center py-4 border-b border-gray-100">
                <View className="flex-1 mr-4">
                  <Text
                    className="text-gray-500"
                    style={{ fontSize: FONT_SIZE_SMALL }}
                  >
                    Email
                  </Text>
                  <Text
                    className="text-gray-800 font-semibold mt-2"
                    style={{ fontSize: FONT_SIZE_BODY }}
                    numberOfLines={1}
                  >
                    {user.email}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleEditProfile}
                  disabled={!isOnline}
                  className="w-12 h-12 items-center justify-center rounded-full active:bg-gray-100"
                  style={{ minWidth: TOUCH_TARGET, minHeight: TOUCH_TARGET }}
                >
                  <Ionicons
                    name="pencil"
                    size={ICON_SIZE_MD}
                    color={!isOnline ? "#9ca3af" : "#16a34a"}
                  />
                </TouchableOpacity>
              </View>

              {/* Gender */}
              <View className="flex-row justify-between items-center py-4">
                <View className="flex-1 mr-4">
                  <Text
                    className="text-gray-500"
                    style={{ fontSize: FONT_SIZE_SMALL }}
                  >
                    Gender
                  </Text>
                  <Text
                    className="text-gray-800 font-semibold mt-2 capitalize"
                    style={{ fontSize: FONT_SIZE_BODY }}
                  >
                    {user.gender}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleEditProfile}
                  disabled={!isOnline}
                  className="w-12 h-12 items-center justify-center rounded-full active:bg-gray-100"
                  style={{ minWidth: TOUCH_TARGET, minHeight: TOUCH_TARGET }}
                >
                  <Ionicons
                    name="pencil"
                    size={ICON_SIZE_MD}
                    color={!isOnline ? "#9ca3af" : "#16a34a"}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Account Settings Section - Larger Touch Targets */}
        <View className="mt-8 mx-6 bg-white rounded-3xl shadow-sm">
          <View className="p-6">
            <Text
              className="font-semibold text-gray-800 mb-6"
              style={{ fontSize: FONT_SIZE_HEADING }}
            >
              Account Settings
            </Text>

            {/* Edit Profile Button */}
            <TouchableOpacity
              className={`flex-row items-center justify-between py-5 border-b border-gray-100 active:bg-gray-50 ${
                !isOnline ? "opacity-50" : ""
              }`}
              onPress={handleEditProfile}
              disabled={!isOnline}
              style={{ minHeight: TOUCH_TARGET }}
            >
              <View className="flex-row items-center flex-1 mr-4">
                <View
                  className={`w-14 h-14 rounded-full items-center justify-center mr-4 ${
                    !isOnline ? "bg-gray-200" : "bg-green-100"
                  }`}
                >
                  <Ionicons
                    name="person"
                    size={ICON_SIZE_MD}
                    color={!isOnline ? "#9ca3af" : "#16a34a"}
                  />
                </View>
                <View className="flex-1">
                  <Text
                    className="text-gray-800 font-semibold"
                    style={{ fontSize: FONT_SIZE_BODY }}
                  >
                    Edit Profile
                  </Text>
                  <Text
                    className="text-gray-500 mt-1"
                    style={{ fontSize: FONT_SIZE_SMALL }}
                  >
                    Update your personal information
                  </Text>
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={ICON_SIZE_MD}
                color={!isOnline ? "#d1d5db" : "#9ca3af"}
              />
            </TouchableOpacity>

            {/* Change Password Button */}
            <TouchableOpacity
              className={`flex-row items-center justify-between py-5 border-b border-gray-100 active:bg-gray-50 ${
                !isOnline ? "opacity-50" : ""
              }`}
              onPress={handleChangePassword}
              disabled={!isOnline}
              style={{ minHeight: TOUCH_TARGET }}
            >
              <View className="flex-row items-center flex-1 mr-4">
                <View
                  className={`w-14 h-14 rounded-full items-center justify-center mr-4 ${
                    !isOnline ? "bg-gray-200" : "bg-green-100"
                  }`}
                >
                  <Ionicons
                    name="lock-closed"
                    size={ICON_SIZE_MD}
                    color={!isOnline ? "#9ca3af" : "#16a34a"}
                  />
                </View>
                <View className="flex-1">
                  <Text
                    className="text-gray-800 font-semibold"
                    style={{ fontSize: FONT_SIZE_BODY }}
                  >
                    Change Password
                  </Text>
                  <Text
                    className="text-gray-500 mt-1"
                    style={{ fontSize: FONT_SIZE_SMALL }}
                  >
                    Set a new password for your account
                  </Text>
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={ICON_SIZE_MD}
                color={!isOnline ? "#d1d5db" : "#9ca3af"}
              />
            </TouchableOpacity>

            {/* Logout Button */}
            <TouchableOpacity
              className="flex-row items-center justify-between py-5 active:bg-gray-50"
              onPress={handleLogout}
              disabled={loading}
              style={{ minHeight: TOUCH_TARGET }}
            >
              <View className="flex-row items-center flex-1 mr-4">
                <View className="w-14 h-14 bg-red-100 rounded-full items-center justify-center mr-4">
                  <Ionicons
                    name="log-out"
                    size={ICON_SIZE_MD}
                    color="#ef4444"
                  />
                </View>
                <View className="flex-1">
                  <Text
                    className="text-gray-800 font-semibold"
                    style={{ fontSize: FONT_SIZE_BODY }}
                  >
                    Logout
                  </Text>
                  <Text
                    className="text-gray-500 mt-1"
                    style={{ fontSize: FONT_SIZE_SMALL }}
                  >
                    Sign out from your account
                  </Text>
                </View>
              </View>
              {loading ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <Ionicons
                  name="chevron-forward"
                  size={ICON_SIZE_MD}
                  color="#9ca3af"
                />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Account Created Info - Larger */}
        <View className="mt-8 mx-6">
          <Text
            className="text-gray-500 text-center"
            style={{ fontSize: FONT_SIZE_SMALL }}
          >
            Account created on{" "}
            {new Date(user.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </Text>
        </View>

        {/* Add bottom padding for scroll content */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Action Button - Larger */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: Platform.OS === "android" ? insets.bottom : 0,
        }}
        className="bg-white border-t border-gray-200 px-6 pt-4 pb-2"
      >
        <TouchableOpacity
          className={`py-5 rounded-2xl items-center active:opacity-90 ${
            !isOnline ? "bg-gray-400" : "bg-green-600"
          }`}
          onPress={handleEditProfile}
          disabled={loading || !isOnline}
          style={{ minHeight: TOUCH_TARGET }}
        >
          {loading ? (
            <ActivityIndicator color="white" size="large" />
          ) : (
            <Text
              className="text-white font-bold"
              style={{ fontSize: FONT_SIZE_BODY }}
            >
              Edit Profile
            </Text>
          )}
        </TouchableOpacity>
        {!isOnline && (
          <Text
            className="text-gray-500 text-center mt-3"
            style={{ fontSize: FONT_SIZE_SMALL }}
          >
            Connect to internet to edit profile
          </Text>
        )}
      </View>
    </View>
  );
}
