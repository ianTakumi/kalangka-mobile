// screens/Users.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Pencil,
  Trash2,
  UserPlus,
  Cloud,
  CloudOff,
  Filter,
  User,
  Mail,
  Calendar,
  AlertCircle,
} from "lucide-react-native";
import userService, { User as UserType } from "@/services/UserService";

export default function Users() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    male: 0,
    female: 0,
    other: 0,
    synced: 0,
    unsynced: 0,
  });
  const [filterGender, setFilterGender] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Load users on component mount
  useEffect(() => {
    loadUsers();
    loadStats();
  }, []);

  // Load users from database
  const loadUsers = async () => {
    try {
      setLoading(true);
      await userService.init();
      const allUsers = await userService.getUsers();

      // Apply gender filter if set
      const filteredUsers = filterGender
        ? allUsers.filter((user) => user.gender === filterGender)
        : allUsers;

      setUsers(filteredUsers);
    } catch (error) {
      console.error("Error loading users:", error);
      Alert.alert("Error", "Failed to load users");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load statistics
  const loadStats = async () => {
    try {
      const statsData = await userService.getStats();
      setStats(statsData);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  // Handle pull to refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadUsers();
    loadStats();
  };

  // Sync all users with server
  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      await userService.syncAll();
      Alert.alert("Success", "Users synced successfully");
      loadUsers();
      loadStats();
    } catch (error) {
      console.error("Sync error:", error);
      Alert.alert("Error", "Failed to sync users");
    } finally {
      setSyncing(false);
    }
  };

  // Create a new user
  const handleCreateUser = () => {
    Alert.prompt(
      "Create New User",
      "Enter first name:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Next",
          onPress: async (first_name) => {
            if (!first_name) {
              Alert.alert("Error", "First name is required");
              return;
            }

            Alert.prompt(
              "Last Name",
              "Enter last name:",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Next",
                  onPress: async (last_name) => {
                    if (!last_name) {
                      Alert.alert("Error", "Last name is required");
                      return;
                    }

                    Alert.prompt(
                      "Email",
                      "Enter email address:",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Next",
                          onPress: async (email) => {
                            if (!email || !email.includes("@")) {
                              Alert.alert("Error", "Valid email is required");
                              return;
                            }

                            Alert.alert("Gender", "Select gender:", [
                              {
                                text: "Male",
                                onPress: () =>
                                  createUserWithDetails(
                                    first_name,
                                    last_name,
                                    email,
                                    "male",
                                  ),
                              },
                              {
                                text: "Female",
                                onPress: () =>
                                  createUserWithDetails(
                                    first_name,
                                    last_name,
                                    email,
                                    "female",
                                  ),
                              },
                              {
                                text: "Other",
                                onPress: () =>
                                  createUserWithDetails(
                                    first_name,
                                    last_name,
                                    email,
                                    "other",
                                  ),
                              },
                              { text: "Cancel", style: "cancel" },
                            ]);
                          },
                        },
                      ],
                      "plain-text",
                      "",
                      "email-address",
                    );
                  },
                },
              ],
              "plain-text",
              "",
            );
          },
        },
      ],
      "plain-text",
      "",
    );
  };

  const createUserWithDetails = async (
    first_name: string,
    last_name: string,
    email: string,
    gender: string,
  ) => {
    try {
      await userService.createUser({
        first_name,
        last_name,
        email,
        gender,
      });

      Alert.alert("Success", "User created successfully");
      loadUsers();
      loadStats();
    } catch (error: any) {
      console.error("Create error:", error);
      Alert.alert("Error", error.message || "Failed to create user");
    }
  };

  // Update a user
  const handleUpdateUser = (user: UserType) => {
    Alert.alert(
      "Update User",
      `Update details for ${user.first_name} ${user.last_name}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Update Name",
          onPress: () => {
            Alert.prompt(
              "Update Name",
              "Enter new first name:",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Update",
                  onPress: async (newFirstName) => {
                    try {
                      await userService.updateUser(user.id, {
                        first_name: newFirstName || user.first_name,
                      });

                      Alert.alert("Success", "Name updated successfully");
                      loadUsers();
                    } catch (error: any) {
                      Alert.alert(
                        "Error",
                        error.message || "Failed to update user",
                      );
                    }
                  },
                },
              ],
              "plain-text",
              user.first_name,
            );
          },
        },
        {
          text: "Update Email",
          onPress: () => {
            Alert.prompt(
              "Update Email",
              "Enter new email:",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Update",
                  onPress: async (newEmail) => {
                    if (!newEmail || !newEmail.includes("@")) {
                      Alert.alert("Error", "Valid email is required");
                      return;
                    }

                    try {
                      await userService.updateUser(user.id, {
                        email: newEmail,
                      });

                      Alert.alert("Success", "Email updated successfully");
                      loadUsers();
                    } catch (error: any) {
                      Alert.alert(
                        "Error",
                        error.message || "Failed to update email",
                      );
                    }
                  },
                },
              ],
              "plain-text",
              user.email,
              "email-address",
            );
          },
        },
        {
          text: "Update Gender",
          onPress: () => {
            Alert.alert("Update Gender", "Select new gender:", [
              {
                text: "Male",
                onPress: () => updateUserGender(user.id, "male"),
              },
              {
                text: "Female",
                onPress: () => updateUserGender(user.id, "female"),
              },
              {
                text: "Other",
                onPress: () => updateUserGender(user.id, "other"),
              },
              { text: "Cancel", style: "cancel" },
            ]);
          },
        },
      ],
    );
  };

  const updateUserGender = async (userId: string, gender: string) => {
    try {
      await userService.updateUser(userId, { gender });
      Alert.alert("Success", "Gender updated successfully");
      loadUsers();
    } catch (error) {
      Alert.alert("Error", "Failed to update gender");
    }
  };

  // Delete a user
  const handleDeleteUser = (user: UserType) => {
    Alert.alert(
      "Delete User",
      `Are you sure you want to delete ${user.first_name} ${user.last_name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await userService.deleteUser(user.id);
              Alert.alert("Success", "User deleted successfully");
              loadUsers();
              loadStats();
            } catch (error) {
              Alert.alert("Error", "Failed to delete user");
            }
          },
        },
      ],
    );
  };

  // Filter users by gender
  const handleFilter = (gender: string | null) => {
    setFilterGender(gender);
    setShowFilters(false);

    if (!gender) {
      loadUsers();
    } else {
      const filteredUsers = users.filter((user) => user.gender === gender);
      setUsers(filteredUsers);
    }
  };

  // Clear filter
  const clearFilter = () => {
    setFilterGender(null);
    loadUsers();
  };

  // Clear all data (for testing)
  const handleClearData = () => {
    Alert.alert(
      "Clear All Data",
      "This will delete ALL users. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            try {
              await userService.clearDatabase();
              Alert.alert("Success", "All users cleared");
              setUsers([]);
              setStats({
                total: 0,
                male: 0,
                female: 0,
                other: 0,
                synced: 0,
                unsynced: 0,
              });
            } catch (error) {
              Alert.alert("Error", "Failed to clear data");
            }
          },
        },
      ],
    );
  };

  // Render user item
  const renderUserItem = (user: UserType) => (
    <View
      key={user.id}
      className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100"
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-3">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-lg font-semibold text-gray-900">
              {user.first_name} {user.last_name}
            </Text>
            <View
              className={`w-6 h-6 rounded-full items-center justify-center ${
                user.is_synced ? "bg-green-500" : "bg-yellow-500"
              }`}
            >
              {user.is_synced ? (
                <Cloud size={12} color="#fff" />
              ) : (
                <CloudOff size={12} color="#fff" />
              )}
            </View>
          </View>

          <View className="flex-row items-center mb-2">
            <Mail size={14} color="#6b7280" />
            <Text className="text-gray-600 ml-2 text-sm">{user.email}</Text>
          </View>

          <View className="flex-row items-center justify-between">
            <View
              className={`px-3 py-1 rounded-full ${
                user.gender === "male"
                  ? "bg-blue-100"
                  : user.gender === "female"
                    ? "bg-pink-100"
                    : "bg-gray-100"
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  user.gender === "male"
                    ? "text-blue-800"
                    : user.gender === "female"
                      ? "text-pink-800"
                      : "text-gray-800"
                }`}
              >
                {user.gender.charAt(0).toUpperCase() + user.gender.slice(1)}
              </Text>
            </View>

            <View className="flex-row items-center">
              <Calendar size={12} color="#9ca3af" />
              <Text className="text-gray-400 text-xs ml-1">
                {user.created_at
                  ? new Date(user.created_at).toLocaleDateString()
                  : "N/A"}
              </Text>
            </View>
          </View>
        </View>

        <View className="flex-row space-x-2">
          <TouchableOpacity
            className="w-10 h-10 rounded-full items-center justify-center bg-blue-50 border border-blue-100"
            onPress={() => handleUpdateUser(user)}
          >
            <Pencil size={18} color="#3b82f6" />
          </TouchableOpacity>

          <TouchableOpacity
            className="w-10 h-10 rounded-full items-center justify-center bg-red-50 border border-red-100"
            onPress={() => handleDeleteUser(user)}
          >
            <Trash2 size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="text-gray-600 mt-4">Loading users...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        stickyHeaderIndices={[0]}
      >
        {/* Header */}
        <View className="bg-white border-b border-gray-200 px-4 pt-4 pb-3">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-2xl font-bold text-gray-900">Users</Text>
            <View className="flex-row items-center space-x-3">
              <TouchableOpacity
                className="w-11 h-11 rounded-full items-center justify-center bg-gray-100 relative"
                onPress={() => setShowFilters(!showFilters)}
              >
                <Filter size={22} color="#6b7280" />
                {filterGender && (
                  <View className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                className={`w-11 h-11 rounded-full items-center justify-center ${syncing ? "bg-blue-300" : "bg-blue-500"}`}
                onPress={handleSyncAll}
                disabled={syncing}
              >
                {syncing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Cloud size={22} color="#fff" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                className="w-11 h-11 rounded-full items-center justify-center bg-green-500"
                onPress={handleCreateUser}
              >
                <UserPlus size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats */}
          <View className="bg-gray-50 rounded-xl p-3 mb-3">
            <View className="flex-row">
              <View className="flex-1 items-center">
                <Text className="text-lg font-bold text-gray-900">
                  {stats.total}
                </Text>
                <Text className="text-xs text-gray-600">Total</Text>
              </View>

              <View className="w-px bg-gray-300 mx-2" />

              <View className="flex-1 items-center">
                <Text className="text-lg font-bold text-blue-600">
                  {stats.male}
                </Text>
                <Text className="text-xs text-gray-600">Male</Text>
              </View>

              <View className="w-px bg-gray-300 mx-2" />

              <View className="flex-1 items-center">
                <Text className="text-lg font-bold text-pink-600">
                  {stats.female}
                </Text>
                <Text className="text-xs text-gray-600">Female</Text>
              </View>

              <View className="w-px bg-gray-300 mx-2" />

              <View className="flex-1 items-center">
                <Text className="text-lg font-bold text-green-600">
                  {stats.synced}
                </Text>
                <Text className="text-xs text-gray-600">Synced</Text>
              </View>

              <View className="w-px bg-gray-300 mx-2" />

              <View className="flex-1 items-center">
                <Text className="text-lg font-bold text-yellow-600">
                  {stats.unsynced}
                </Text>
                <Text className="text-xs text-gray-600">Pending</Text>
              </View>
            </View>
          </View>

          {/* Filter Options */}
          {showFilters && (
            <View className="bg-gray-50 rounded-xl p-3 mt-2">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Filter by Gender:
              </Text>
              <View className="flex-row flex-wrap gap-2">
                <TouchableOpacity
                  className={`px-4 py-2 rounded-full ${filterGender === "male" ? "bg-blue-500" : "bg-gray-200"}`}
                  onPress={() => handleFilter("male")}
                >
                  <Text
                    className={`text-sm font-medium ${filterGender === "male" ? "text-white" : "text-gray-700"}`}
                  >
                    Male
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className={`px-4 py-2 rounded-full ${filterGender === "female" ? "bg-pink-500" : "bg-gray-200"}`}
                  onPress={() => handleFilter("female")}
                >
                  <Text
                    className={`text-sm font-medium ${filterGender === "female" ? "text-white" : "text-gray-700"}`}
                  >
                    Female
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className={`px-4 py-2 rounded-full ${filterGender === "other" ? "bg-gray-500" : "bg-gray-200"}`}
                  onPress={() => handleFilter("other")}
                >
                  <Text
                    className={`text-sm font-medium ${filterGender === "other" ? "text-white" : "text-gray-700"}`}
                  >
                    Other
                  </Text>
                </TouchableOpacity>

                {filterGender && (
                  <TouchableOpacity
                    className="px-4 py-2 rounded-full bg-red-500"
                    onPress={clearFilter}
                  >
                    <Text className="text-sm font-medium text-white">
                      Clear
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Content */}
        <View className="p-4">
          {users.length === 0 ? (
            <View className="bg-white rounded-xl p-8 items-center justify-center">
              <User size={48} color="#d1d5db" />
              <Text className="text-xl font-semibold text-gray-400 mt-4">
                No users found
              </Text>
              <Text className="text-gray-500 text-center mt-2">
                {filterGender
                  ? `No ${filterGender} users available`
                  : "Add a new user to get started"}
              </Text>
              {filterGender && (
                <TouchableOpacity
                  className="mt-4 px-6 py-2 bg-blue-500 rounded-full"
                  onPress={clearFilter}
                >
                  <Text className="text-white font-medium">Clear Filter</Text>
                </TouchableOpacity>
              )}
              {!filterGender && (
                <TouchableOpacity
                  className="mt-6 px-6 py-3 bg-green-500 rounded-full flex-row items-center"
                  onPress={handleCreateUser}
                >
                  <UserPlus size={18} color="#fff" />
                  <Text className="text-white font-medium ml-2">
                    Add First User
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              {users.map(renderUserItem)}

              {/* Debug Actions (for testing) */}
              {__DEV__ && (
                <TouchableOpacity
                  className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl items-center"
                  onPress={handleClearData}
                >
                  <AlertCircle size={24} color="#ef4444" />
                  <Text className="text-red-600 font-medium mt-2">
                    Clear All Data (Debug)
                  </Text>
                  <Text className="text-red-400 text-xs text-center mt-1">
                    This will delete ALL users permanently
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
