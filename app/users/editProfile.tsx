import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/redux/store";
import { updateUser } from "@/redux/slices/authSlice";
import { Ionicons } from "@expo/vector-icons";
import client from "@/utils/axiosInstance";

export default function EditProfile() {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    gender: "",
  });

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.first_name || "",
        lastName: user.last_name || "",
        email: user.email || "",
        gender: user.gender || "",
      });
    }
  }, [user]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveChanges = async () => {
    // Validation
    if (!formData.firstName.trim()) {
      Alert.alert("Error", "First name is required");
      return;
    }

    if (!formData.lastName.trim()) {
      Alert.alert("Error", "Last name is required");
      return;
    }

    if (!formData.email.trim()) {
      Alert.alert("Error", "Email is required");
      return;
    }

    setLoading(true);

    try {
      await client.put("/users/" + user?.id, formData).then((res) => {
        if (res.status === 200) {
          dispatch(
            updateUser({
              ...user,
              first_name: formData.firstName,
              last_name: formData.lastName,
              email: formData.email,
              gender: formData.gender,
            }),
          );
          Toast.show({
            type: "success",
            text1: "Profile updated successfully",
          });
        }
      });
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Failed to update profile",
        text2: "Please try again later",
      });
    }
    // try {
    //   dispatch(
    //     updateUser({
    //       ...user,
    //       first_name: formData.firstName,
    //       last_name: formData.lastName,
    //       email: formData.email,
    //       gender: formData.gender,
    //     }),
    //   );

    //   Alert.alert("Success", "Profile updated successfully", [{ text: "OK" }]);
    // } catch (error) {
    //   Alert.alert("Error", "Failed to update profile. Please try again.");
    // } finally {
    //   setLoading(false);
    // }
  };

  const handleCancel = () => {
    // Go back to previous screen
    // navigation.goBack();
    Alert.alert("Cancel", "Changes will be discarded", [
      { text: "Continue Editing", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => console.log("Navigating back"),
      },
    ]);
  };

  const selectGender = (gender: string) => {
    setFormData((prev) => ({
      ...prev,
      gender: gender.toLowerCase(),
    }));
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
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <TouchableOpacity onPress={handleCancel}>
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-800">
          Edit Profile
        </Text>
        <TouchableOpacity onPress={handleSaveChanges} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#16a34a" />
          ) : (
            <Text className="text-green-600 font-semibold">Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Form Section */}
        <View className="px-6 mt-2">
          {/* First Name */}
          <View className="mb-6">
            <Text className="text-gray-700 font-medium mb-2">First Name</Text>
            <View className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <TextInput
                className="text-gray-800 text-base"
                value={formData.firstName}
                onChangeText={(text) => handleInputChange("firstName", text)}
                placeholder="Enter your first name"
                editable={!loading}
              />
            </View>
          </View>

          {/* Last Name */}
          <View className="mb-6">
            <Text className="text-gray-700 font-medium mb-2">Last Name</Text>
            <View className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <TextInput
                className="text-gray-800 text-base"
                value={formData.lastName}
                onChangeText={(text) => handleInputChange("lastName", text)}
                placeholder="Enter your last name"
                editable={!loading}
              />
            </View>
          </View>

          {/* Email */}
          <View className="mb-6">
            <Text className="text-gray-700 font-medium mb-2">
              Email Address
            </Text>
            <View className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <TextInput
                className="text-gray-800 text-base"
                value={formData.email}
                onChangeText={(text) => handleInputChange("email", text)}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
              />
            </View>
          </View>

          {/* Gender Selection */}
          <View className="mb-8">
            <Text className="text-gray-700 font-medium mb-3">Gender</Text>
            <View className="flex-row gap-3">
              {["Male", "Female"].map((gender) => (
                <TouchableOpacity
                  key={gender}
                  className={`flex-1 py-3 rounded-xl items-center border ${
                    formData.gender.toLowerCase() === gender.toLowerCase()
                      ? "bg-green-50 border-green-500"
                      : "bg-white border-gray-200"
                  }`}
                  onPress={() => selectGender(gender)}
                  disabled={loading}
                >
                  <Text
                    className={`font-medium ${
                      formData.gender.toLowerCase() === gender.toLowerCase()
                        ? "text-green-700"
                        : "text-gray-700"
                    }`}
                  >
                    {gender}
                  </Text>
                  {formData.gender.toLowerCase() === gender.toLowerCase() && (
                    <View className="absolute top-1 right-1">
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#16a34a"
                      />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Save Button */}
      <View className="p-6 bg-white border-t border-gray-200">
        <TouchableOpacity
          className={`py-4 rounded-xl items-center ${
            loading ? "bg-green-400" : "bg-green-600"
          }`}
          onPress={handleSaveChanges}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold text-lg">
              Save Changes
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className="py-4 rounded-xl items-center mt-3"
          onPress={handleCancel}
          disabled={loading}
        >
          <Text className="text-gray-600 font-medium">Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
