import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  RefreshControl,
} from "react-native";
import TreeService from "@/services/treeService";
import NetInfo from "@react-native-community/netinfo";
import Toast from "react-native-toast-message";
import { Tree } from "@/types/index";
import {
  MapPin,
  QrCode,
  Wifi,
  WifiOff,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  Camera,
  X,
} from "lucide-react-native";
import TreeCamera from "@/components/TreeCamera";
import * as FileSystem from "expo-file-system/legacy";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
// Create directory for tree images
const TREE_IMAGES_DIR = FileSystem.documentDirectory + "tree_images/";

const ensureImagesDirExists = async () => {
  const dirInfo = await FileSystem.getInfoAsync(TREE_IMAGES_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(TREE_IMAGES_DIR, {
      intermediates: true,
    });
  }
};

export default function TreesScreen() {
  const [trees, setTrees] = useState<Tree[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const router = useRouter();
  const [hasSyncedFromServer, setHasSyncedFromServer] = useState(false);
  const [serverTreeCount, setServerTreeCount] = useState(0);

  // For CRUD operations
  const [modalVisible, setModalVisible] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [editingTree, setEditingTree] = useState<Tree | null>(null);
  const [formData, setFormData] = useState({
    description: "",
    status: "active" as const,
    type: "",
    latitude: "",
    longitude: "",
    image_path: "",
  });
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    synced: 0,
    unsynced: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    initApp();
    ensureImagesDirExists();

    // Listen to network changes
    const unsubscribe = NetInfo.addEventListener(async (state) => {
      const online = state.isConnected ?? false;
      setIsOnline(online);

      // Auto-sync when coming online
      if (online) {
        autoSync();

        // NEW: Sync trees FROM server when online and not yet synced
        if (!hasSyncedFromServer) {
          setTimeout(() => syncTreesFromServer(), 1000); // Small delay
        }
      }
    });

    return () => unsubscribe();
  }, [hasSyncedFromServer]); // Add dependency

  const syncTreesFromServer = async () => {
    if (!isOnline) {
      console.log("📴 Offline - Cannot sync from server");
      return;
    }

    try {
      console.log("🔄 Starting sync from server...");
      setSyncing(true);

      Toast.show({
        type: "info",
        text1: "Syncing from Server",
        text2: "Downloading latest trees...",
      });

      const { synced, errors } = await TreeService.syncTreesFromServer();

      if (errors.length > 0) {
        console.warn("Sync completed with warnings:", errors);
      }

      if (synced > 0) {
        Toast.show({
          type: "success",
          text1: "Sync Complete!",
          text2: `${synced} tree(s) downloaded from server`,
        });
        setHasSyncedFromServer(true); // Mark as synced
      } else {
        Toast.show({
          type: "info",
          text1: "Already Up-to-date",
          text2: "No new trees on server",
        });
      }

      // Refresh local data
      await loadTrees();
      await loadStats();
    } catch (error: any) {
      console.error("❌ Server sync failed:", error);
      Toast.show({
        type: "error",
        text1: "Server Sync Failed",
        text2: error.message || "Failed to sync from server",
      });
    } finally {
      setSyncing(false);
    }
  };

  const initApp = async () => {
    try {
      setLoading(true);
      await TreeService.init();
      await loadTrees();
      await loadStats();

      // NEW: Check network status immediately
      const netInfo = await NetInfo.fetch();
      const online = netInfo.isConnected ?? false;
      setIsOnline(online);

      if (online) {
        // Check if we should sync from server
        try {
          const { needsSync, treeCount } = await TreeService.checkAndSync();
          setServerTreeCount(treeCount);

          if (needsSync) {
            console.log(`🔄 Server has ${treeCount} trees, auto-syncing...`);
            setTimeout(() => syncTreesFromServer(), 1500); // Delay to let UI load
          } else if (treeCount > 0) {
            setHasSyncedFromServer(true); // Already in sync
            console.log(`✅ Already synced with server (${treeCount} trees)`);
          }
        } catch (checkError) {
          console.log("Could not check server status:", checkError);
        }
      }
    } catch (error) {
      console.error("Init error:", error);
      Toast.show({
        type: "error",
        text1: "Initialization Error",
        text2: "Failed to initialize database. Please restart the app.",
      });
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Refresh both trees and stats
      await loadTrees();
      await loadStats();

      // If online, also sync from server
      if (isOnline) {
        await syncTreesFromServer();
      }
    } catch (error) {
      console.error("Refresh error:", error);
      Toast.show({
        type: "error",
        text1: "Refresh Failed",
        text2: "Failed to refresh data",
      });
    } finally {
      setRefreshing(false);
    }
  };
  const loadTrees = async () => {
    try {
      const data = await TreeService.getTreesWithDistance();
      console.log(`📊 Loaded ${data.length} trees locally`);
      setTrees(data);

      // NEW: Auto-sync if online and no local trees
      if (isOnline && !hasSyncedFromServer && data.length === 0) {
        console.log(
          "📥 First time online with empty local DB, auto-syncing...",
        );
        setTimeout(() => syncTreesFromServer(), 1000);
      }
    } catch (error) {
      console.error("Load trees error:", error);
      Toast.show({
        type: "error",
        text1: "Load Failed",
        text2: "Failed to load trees from database",
      });
    }
  };

  const loadStats = async () => {
    try {
      const databaseStats = await TreeService.getStats();
      setStats(databaseStats);
    } catch (error) {
      console.error("Load stats error:", error);
    }
  };

  const handleTakePhoto = () => {
    // Reset form and open camera
    resetForm();
    setCameraVisible(true);
  };

  const handlePhotoCaptured = async (
    photoUri: string,
    latitude: number,
    longitude: number,
  ) => {
    try {
      // Generate unique filename
      const timestamp = Date.now();
      const filename = `tree_${timestamp}.jpg`;
      const newPath = TREE_IMAGES_DIR + filename;

      // Copy image to our app directory
      await FileSystem.copyAsync({
        from: photoUri,
        to: newPath,
      });

      // Set form data with captured location
      setFormData({
        description: "",
        type: "",
        status: "active",
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        image_path: newPath,
      });

      setPreviewImage(newPath);
      setCameraVisible(false);
      setModalVisible(true);

      Toast.show({
        type: "success",
        text1: "Photo Captured",
        text2: "Location recorded. Add tree details.",
      });
    } catch (error) {
      console.error("Error handling photo:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to save photo",
      });
    }
  };

  const handleCreate = async () => {
    if (!formData.description.trim()) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Please enter tree description",
      });
      return;
    }

    if (!formData.latitude || !formData.longitude) {
      Toast.show({
        type: "error",
        text1: "Location Error",
        text2: "Could not get location from photo",
      });
      return;
    }

    try {
      const treeData = {
        description: formData.description,
        type: formData.type,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        status: formData.status,
        image_path: formData.image_path || "",
      };

      console.log("Creating tree with data:", treeData);
      await TreeService.createTree(treeData);

      Toast.show({
        type: "success",
        text1: "Tree Created",
        text2: isOnline ? "Synced to server" : "Saved locally (offline)",
      });

      await loadTrees();
      await loadStats();
      resetForm();
      setModalVisible(false);
      setPreviewImage(null);
    } catch (error) {
      console.error("Create error:", error);

      Toast.show({
        type: "error",
        text1: "Create Failed",
        text2: "Failed to create tree",
      });
    }
  };

  const handleEdit = (tree: Tree) => {
    setEditingTree(tree);
    setFormData({
      description: tree.description,
      status: tree.status,
      latitude: tree.latitude.toString(),
      longitude: tree.longitude.toString(),
      image_path: (tree as any).image_path || "",
      type: tree.type || "",
    });
    setPreviewImage((tree as any).image_path || null);
    setModalVisible(true);
  };

  const handleUpdate = async () => {
    if (!editingTree) return;

    try {
      const updates = {
        description: formData.description,
        status: formData.status,
        type: formData.type || "",
      };

      await TreeService.updateTree(editingTree.id, updates);

      Toast.show({
        type: "success",
        text1: "Tree Updated",
        text2: isOnline ? "Synced to server" : "Updated locally (offline)",
      });

      await loadTrees();
      await loadStats();
      resetForm();
      setModalVisible(false);
      setPreviewImage(null);
    } catch (error) {
      console.error("Update error:", error);
      Toast.show({
        type: "error",
        text1: "Update Failed",
        text2: "Failed to update tree",
      });
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert("Delete Tree", "Are you sure you want to delete this tree?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await TreeService.deleteTree(id);

            Toast.show({
              type: "success",
              text1: "Tree Deleted",
              text2: isOnline ? "Synced to server" : "Deleted locally",
            });

            await loadTrees();
            await loadStats();
          } catch (error) {
            console.error("Delete error:", error);
            Toast.show({
              type: "error",
              text1: "Delete Failed",
              text2: "Failed to delete tree",
            });
          }
        },
      },
    ]);
  };

  const resetForm = () => {
    setEditingTree(null);
    setFormData({
      type: "",
      description: "",
      status: "active",
      latitude: "",
      longitude: "",
      image_path: "",
    });
    setPreviewImage(null);
  };

  const manualSync = async () => {
    if (!isOnline) {
      Toast.show({
        type: "info",
        text1: "Offline Mode",
        text2: "Cannot sync while offline",
      });
      return;
    }

    setSyncing(true);
    try {
      // First sync local changes TO server
      await TreeService.syncAll();

      // Then sync FROM server to get latest data
      const { synced, errors } = await TreeService.syncTreesFromServer();

      // Refresh data
      await loadTrees();
      await loadStats();

      Toast.show({
        type: "success",
        text1: "Full Sync Complete",
        text2:
          synced > 0
            ? `Uploaded local changes and downloaded ${synced} tree(s) from server`
            : "All data synchronized",
      });

      setHasSyncedFromServer(true); // Mark as synced
    } catch (error) {
      console.error("Sync error:", error);
      Toast.show({
        type: "error",
        text1: "Sync Failed",
        text2: "Failed to sync data with server",
      });
    } finally {
      setSyncing(false);
    }
  };

  const autoSync = async () => {
    try {
      await TreeService.syncAll();
      await loadTrees();
      await loadStats();
    } catch (error) {
      console.error("Auto-sync error:", error);
    }
  };

  // Clear database (for testing/debugging)
  const handleClearDatabase = async () => {
    Alert.alert(
      "Clear Database",
      "Warning: This will delete ALL trees. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            try {
              await TreeService.clearDatabase();
              await loadTrees();
              await loadStats();

              Toast.show({
                type: "success",
                text1: "Database Cleared",
                text2: "All trees have been removed",
              });
            } catch (error) {
              Toast.show({
                type: "error",
                text1: "Clear Failed",
                text2: "Failed to clear database",
              });
            }
          },
        },
      ],
    );
  };

  const renderTreeItem = ({ item }: { item: Tree & { distance?: string } }) => {
    const hasLocalImage = (item as any).image_path;

    const treeInfoData = {
      id: item.id,
      description: item.description,
      image_path: (item as any).image_path || null,
      is_synced: item.is_synced,
      coordinates: {
        latitude: item.latitude,
        longitude: item.longitude,
      },
      type: item.type,
      status: item.status,
      created_at: item.created_at,
    };

    const handlePress = () => {
      router.push({
        pathname: "/admin/treeinfo",
        params: {
          treeData: JSON.stringify(treeInfoData),
        },
      });
    };

    const handleEditPress = (e: any) => {
      e.stopPropagation();
      handleEdit(item);
    };

    const handleDeletePress = (e: any) => {
      e.stopPropagation();
      handleDelete(item.id);
    };

    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
        <View className="bg-white p-4 rounded-xl mb-3 shadow-sm border border-gray-100">
          <View className="flex-row">
            {/* Image Preview */}
            {hasLocalImage ? (
              <View className="mr-4">
                <Image
                  source={{ uri: (item as any).image_path }}
                  className="w-20 h-20 rounded-lg"
                  resizeMode="cover"
                />
              </View>
            ) : (
              <View className="mr-4 w-20 h-20 bg-gray-100 rounded-lg items-center justify-center">
                <Camera size={24} color="#9ca3af" />
              </View>
            )}

            <View className="flex-1">
              <View className="flex-row items-center mb-2">
                <Text className="text-lg font-semibold text-gray-800 flex-1">
                  {item.description}
                </Text>
                <View
                  className={`px-2 py-1 rounded-full ${item.status === "active" ? "bg-green-100" : "bg-gray-100"}`}
                >
                  <Text
                    className={`text-xs font-medium ${item.status === "active" ? "text-green-700" : "text-gray-700"}`}
                  >
                    {item.status}
                  </Text>
                </View>
              </View>

              {/* Distance from user */}
              <View className="flex-row items-center mb-2">
                <MapPin size={14} color="#6b7280" />
                <Text className="text-sm text-gray-600 ml-1">
                  {item.distance || "Distance unavailable"}
                </Text>
              </View>

              <View className="flex-row items-center justify-between mt-2">
                <View className="flex-row items-center">
                  <View
                    className={`w-2 h-2 rounded-full mr-2 ${item.is_synced ? "bg-green-500" : "bg-yellow-500"}`}
                  />
                  <Text className="text-xs text-gray-500">
                    {item.is_synced ? "Synced" : "Pending Sync"}
                  </Text>
                </View>

                <Text className="text-xs text-gray-400">
                  {item.created_at
                    ? new Date(item.created_at).toLocaleDateString()
                    : "No date"}
                </Text>
              </View>
            </View>

            <View className="flex-row ml-2">
              <TouchableOpacity
                className="p-2 bg-blue-50 rounded-lg mr-2"
                onPress={handleEditPress}
              >
                <Edit2 size={18} color="#3b82f6" />
              </TouchableOpacity>
              <TouchableOpacity
                className="p-2 bg-red-50 rounded-lg"
                onPress={handleDeletePress}
              >
                <Trash2 size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#059669" />
        <Text className="mt-4 text-gray-600">Loading...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white pt-12 pb-4 px-4 shadow-sm border-b border-gray-200">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-2xl font-bold text-gray-800">My Trees</Text>

          <View className="flex-row items-center">
            {isOnline ? (
              <Wifi size={20} color="#059669" />
            ) : (
              <WifiOff size={20} color="#6b7280" />
            )}
            <Text
              className={`ml-2 ${isOnline ? "text-green-600" : "text-gray-500"}`}
            >
              {isOnline ? "Online" : "Offline"}
            </Text>
          </View>
        </View>

        {/* Stats Overview */}
        <View className="bg-gray-50 rounded-xl p-3 mb-4">
          <View className="flex-row justify-between">
            <View className="items-center">
              <Text className="text-2xl font-bold text-gray-800">
                {stats.total}
              </Text>
              <Text className="text-xs text-gray-500">Total</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-green-600">
                {stats.active}
              </Text>
              <Text className="text-xs text-gray-500">Active</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-yellow-600">
                {stats.unsynced}
              </Text>
              <Text className="text-xs text-gray-500">Pending</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-blue-600">
                {stats.synced}
              </Text>
              <Text className="text-xs text-gray-500">Synced</Text>
            </View>
          </View>
        </View>

        <View className="flex-row">
          <TouchableOpacity
            className="flex-1 bg-green-600 py-3 rounded-xl flex-row items-center justify-center"
            onPress={handleTakePhoto}
          >
            <Camera size={20} color="white" />
            <Text className="text-white font-semibold ml-2">
              Take Tree Photo
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`ml-3 px-4 py-3 rounded-xl flex-row items-center ${isOnline && !syncing ? "bg-blue-600" : "bg-gray-300"}`}
            onPress={manualSync}
            disabled={!isOnline || syncing}
          >
            <RefreshCw
              size={20}
              color={isOnline && !syncing ? "white" : "#9ca3af"}
              className={syncing ? "animate-spin" : ""}
            />
            <Text
              className={`ml-2 font-medium ${isOnline && !syncing ? "text-white" : "text-gray-400"}`}
            >
              {syncing ? "Syncing..." : "Sync"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Debug button - remove in production */}
        {__DEV__ && (
          <TouchableOpacity
            className="mt-3 bg-red-100 py-2 rounded-xl"
            onPress={handleClearDatabase}
          >
            <Text className="text-red-600 text-center font-medium">
              [DEV] Clear Database
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tree List */}
      <FlatList
        data={trees}
        renderItem={renderTreeItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        // Add RefreshControl here
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#059669"]} // Android
            tintColor="#059669" // iOS
            title="Pull to refresh"
            titleColor="#6b7280"
          />
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-20 px-4">
            <View className="bg-gray-100 p-6 rounded-full mb-4">
              <Camera size={48} color="#9ca3af" />
            </View>
            <Text className="text-xl font-medium text-gray-700 mb-2">
              No Trees Yet
            </Text>
            <Text className="text-gray-500 text-center mb-6">
              Take a photo of your tree to get started
            </Text>
            <TouchableOpacity
              className="bg-green-600 px-6 py-3 rounded-xl"
              onPress={handleTakePhoto}
            >
              <Text className="text-white font-semibold">Take First Photo</Text>
            </TouchableOpacity>
          </View>
        }
        ListHeaderComponent={
          trees.length > 0 ? (
            <View className="mb-4">
              <Text className="text-gray-600">
                Showing {trees.length} tree{trees.length !== 1 ? "s" : ""}
                {stats.unsynced > 0 && (
                  <Text className="text-yellow-600">
                    {" "}
                    ({stats.unsynced} pending sync)
                  </Text>
                )}
              </Text>
            </View>
          ) : null
        }
      />

      {/* Camera Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={cameraVisible}
        onRequestClose={() => setCameraVisible(false)}
      >
        <TreeCamera
          onPhotoCaptured={handlePhotoCaptured}
          onClose={() => setCameraVisible(false)}
        />
      </Modal>

      {/* Tree Details Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(false);
          resetForm();
        }}
      >
        <View className="flex-1 justify-end">
          <View className="bg-white rounded-t-3xl pt-6 pb-8 px-6 max-h-[90%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-gray-800">
                {editingTree ? "Edit Tree" : "Add Tree Details"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  resetForm();
                }}
                className="p-2"
              >
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Image Preview */}
              {previewImage && (
                <View className="mb-4">
                  <Text className="text-gray-700 font-medium mb-2">
                    Tree Photo
                  </Text>
                  <Image
                    source={{ uri: previewImage }}
                    className="w-full h-64 rounded-xl"
                    resizeMode="cover"
                  />
                  <View className="flex-row items-center mt-2">
                    <MapPin size={14} color="#059669" />
                    <Text className="text-sm text-gray-600 ml-1">
                      Location: {formData.latitude}, {formData.longitude}
                    </Text>
                  </View>
                </View>
              )}

              <View className="mb-4 relative">
                <Text className="text-gray-700 font-medium mb-2">
                  Tree Type *
                </Text>

                <TouchableOpacity
                  className="border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 flex-row justify-between items-center"
                  onPress={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  <Text
                    className={`${formData.type ? "text-gray-800" : "text-gray-400"}`}
                  >
                    {formData.type || "Select tree type..."}
                  </Text>
                  <Text className="text-gray-500">▼</Text>
                </TouchableOpacity>

                {/* Dropdown Options */}
                {isDropdownOpen && (
                  <View className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60">
                    <ScrollView className="max-h-60">
                      <TouchableOpacity
                        className="px-4 py-3 border-b border-gray-100 active:bg-gray-50"
                        onPress={() => {
                          setFormData({ ...formData, type: "Langka" });
                          setIsDropdownOpen(false);
                        }}
                      >
                        <Text className="text-gray-800">Langka</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="px-4 py-3 border-b border-gray-100 active:bg-gray-50"
                        onPress={() => {
                          setFormData({ ...formData, type: "Banana" });
                          setIsDropdownOpen(false);
                        }}
                      >
                        <Text className="text-gray-800">Banana</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="px-4 py-3 border-b border-gray-100 active:bg-gray-50"
                        onPress={() => {
                          setFormData({ ...formData, type: "Papaya" });
                          setIsDropdownOpen(false);
                        }}
                      >
                        <Text className="text-gray-800">Papaya</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="px-4 py-3 border-b border-gray-100 active:bg-gray-50"
                        onPress={() => {
                          setFormData({ ...formData, type: "Mangga" });
                          setIsDropdownOpen(false);
                        }}
                      >
                        <Text className="text-gray-800">Mangga</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="px-4 py-3 active:bg-gray-50"
                        onPress={() => {
                          setFormData({ ...formData, type: "Durian" });
                          setIsDropdownOpen(false);
                        }}
                      >
                        <Text className="text-gray-800">Durian</Text>
                      </TouchableOpacity>
                    </ScrollView>
                  </View>
                )}

                {!formData.type && (
                  <Text className="text-red-500 text-sm mt-1">
                    Please select a tree type
                  </Text>
                )}
              </View>

              <View className="mb-4">
                <Text className="text-gray-700 font-medium mb-2">
                  Description *
                </Text>
                <TextInput
                  className="border border-gray-300 rounded-xl px-4 py-3 bg-gray-50"
                  placeholder="Describe this tree (e.g., Mango Tree #1)"
                  value={formData.description}
                  onChangeText={(text) =>
                    setFormData({ ...formData, description: text })
                  }
                />
              </View>

              <View className="mb-6">
                <Text className="text-gray-700 font-medium mb-2">Status</Text>
                <View className="flex-row">
                  <TouchableOpacity
                    className={`flex-1 py-3 rounded-xl mr-2 ${formData.status === "active" ? "bg-green-600 border-2 border-green-600" : "bg-gray-100 border-2 border-gray-300"}`}
                    onPress={() =>
                      setFormData({ ...formData, status: "active" })
                    }
                  >
                    <Text
                      className={`text-center font-medium ${formData.status === "active" ? "text-white" : "text-gray-600"}`}
                    >
                      Active
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`flex-1 py-3 rounded-xl ${formData.status === "inactive" ? "bg-red-600 border-2 border-red-600" : "bg-gray-100 border-2 border-gray-300"}`}
                    onPress={() =>
                      setFormData({ ...formData, status: "inactive" })
                    }
                  >
                    <Text
                      className={`text-center font-medium ${formData.status === "inactive" ? "text-white" : "text-gray-600"}`}
                    >
                      Inactive
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View className="flex-row mt-4">
                <TouchableOpacity
                  className="flex-1 bg-gray-200 py-4 rounded-xl mr-3"
                  onPress={() => {
                    setModalVisible(false);
                    resetForm();
                  }}
                >
                  <Text className="text-center font-semibold text-gray-700">
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-green-600 py-4 rounded-xl"
                  onPress={editingTree ? handleUpdate : handleCreate}
                >
                  <Text className="text-center font-semibold text-white">
                    {editingTree ? "Update" : "Save"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
