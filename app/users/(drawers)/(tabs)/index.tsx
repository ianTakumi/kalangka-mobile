import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  Dimensions,
} from "react-native";
import {
  BarChart3,
  Camera,
  Calendar,
  Cloud,
  CloudOff,
  Download,
  Flower2,
  MapPin,
  QrCode,
  RefreshCw,
  Shield,
  Trees,
  Upload,
  User,
  AlertCircle,
  TrendingUp,
  Package,
  ArrowRight,
  ChevronRight,
} from "lucide-react-native";
import NetInfo from "@react-native-community/netinfo";
import { useRouter } from "expo-router";

const { width } = Dimensions.get("window");

export default function FarmerHomeScreen() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userStats, setUserStats] = useState({
    totalTrees: 24,
    activeTrees: 22,
    flowersToday: 8,
    pendingSync: 3,
    harvestThisWeek: 125,
    totalLoss: 12,
  });

  const [quickActions] = useState([
    {
      id: 1,
      title: "Register Tree",
      description: "Add new jackfruit tree",
      icon: <Trees size={28} color="#059669" />,
      bgColor: "bg-emerald-50",
      iconColor: "text-emerald-600",
      route: "/trees/register",
    },
    {
      id: 2,
      title: "Log Flowers",
      description: "Record flower count",
      icon: <Flower2 size={28} color="#7C3AED" />,
      bgColor: "bg-violet-50",
      iconColor: "text-violet-600",
      route: "/flowers/log",
    },
    {
      id: 3,
      title: "Report Harvest",
      description: "Log harvested weight",
      icon: <Package size={28} color="#DC2626" />,
      bgColor: "bg-red-50",
      iconColor: "text-red-600",
      route: "/harvest/report",
    },
    {
      id: 4,
      title: "Scan QR",
      description: "Quick tree access",
      icon: <QrCode size={28} color="#2563EB" />,
      bgColor: "bg-blue-50",
      iconColor: "text-blue-600",
      route: "/scan",
    },

    {
      id: 5,
      title: "View Map",
      description: "Tree locations",
      icon: <MapPin size={28} color="#059669" />,
      bgColor: "bg-emerald-50",
      iconColor: "text-emerald-600",
      route: "/map",
    },
  ]);

  const [recentActivities] = useState([
    {
      id: 1,
      type: "tree",
      title: "Papaya Tree Registered",
      description: "Tree #JP-024 added to Plot A",
      time: "2 hours ago",
      icon: <Trees size={18} color="#059669" />,
      bgColor: "bg-emerald-50",
    },
    {
      id: 2,
      type: "flower",
      title: "Flower Count Updated",
      description: "5 flowers logged on Tree JP-018",
      time: "5 hours ago",
      icon: <Flower2 size={18} color="#7C3AED" />,
      bgColor: "bg-violet-50",
    },
    {
      id: 3,
      type: "harvest",
      title: "Harvest Reported",
      description: "12.5 kg jackfruit harvested",
      time: "Yesterday",
      icon: <Package size={18} color="#DC2626" />,
      bgColor: "bg-red-50",
    },
    {
      id: 4,
      type: "sync",
      title: "Data Synced",
      description: "3 pending items uploaded to cloud",
      time: "2 days ago",
      icon: <Upload size={18} color="#2563EB" />,
      bgColor: "bg-blue-50",
    },
  ]);

  const [weather] = useState({
    condition: "Sunny",
    temperature: "32°C",
    humidity: "65%",
    forecast: "Good for flowering",
    recommendation: "Ideal time for fertilizer application",
  });

  useEffect(() => {
    checkNetworkStatus();
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? false);
    });
    return () => unsubscribe();
  }, []);

  const checkNetworkStatus = async () => {
    const state = await NetInfo.fetch();
    setIsOnline(state.isConnected ?? false);
  };

  const handleManualSync = async () => {
    if (!isOnline) return;
    setSyncing(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setSyncing(false);
    setUserStats((prev) => ({ ...prev, pendingSync: 0 }));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setRefreshing(false);
  };

  const handleQuickAction = (route) => {
    router.push(route);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

      {/* Header */}
      <View className="bg-white px-6 pt-6 pb-4 border-b border-gray-200">
        <View className="flex-row justify-between items-center mb-4">
          <View>
            <Text className="text-3xl font-bold text-gray-900">
              Good morning
            </Text>
            <Text className="text-lg text-gray-600">Welcome to Kalangka</Text>
          </View>
          <TouchableOpacity
            className="w-12 h-12 rounded-full bg-gray-100 items-center justify-center"
            onPress={() => router.push("/profile")}
          >
            <User size={24} color="#4B5563" />
          </TouchableOpacity>
        </View>

        {/* Network Status & Sync */}
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center gap-2">
            <View
              className={`flex-row items-center px-3 py-1.5 rounded-full ${isOnline ? "bg-emerald-50" : "bg-gray-100"}`}
            >
              {isOnline ? (
                <>
                  <Cloud size={16} color="#059669" />
                  <Text className="ml-2 text-emerald-700 font-medium">
                    Online
                  </Text>
                </>
              ) : (
                <>
                  <CloudOff size={16} color="#6B7280" />
                  <Text className="ml-2 text-gray-600 font-medium">
                    Offline
                  </Text>
                </>
              )}
            </View>
            {userStats.pendingSync > 0 && (
              <View className="bg-yellow-100 px-3 py-1.5 rounded-full">
                <Text className="text-yellow-800 font-medium">
                  {userStats.pendingSync} pending
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            className={`flex-row items-center px-4 py-2.5 rounded-lg ${isOnline && !syncing ? "bg-emerald-600" : "bg-gray-300"}`}
            onPress={handleManualSync}
            disabled={!isOnline || syncing}
          >
            <RefreshCw
              size={18}
              color={isOnline && !syncing ? "white" : "#9CA3AF"}
              className={syncing ? "animate-spin" : ""}
            />
            <Text
              className={`ml-2 font-semibold ${isOnline && !syncing ? "text-white" : "text-gray-400"}`}
            >
              {syncing ? "Syncing..." : "Sync"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#059669"]}
            tintColor="#059669"
          />
        }
      >
        {/* Stats Overview */}
        <View className="px-6 pt-6">
          <View className="mb-4">
            <Text className="text-2xl font-bold text-gray-900">
              Farm Overview
            </Text>
            <Text className="text-gray-600">Today's summary</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-6"
          >
            <View className="flex-row space-x-4">
              {/* Total Trees Card */}
              <View className="w-40 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <View className="w-12 h-12 bg-emerald-50 rounded-xl items-center justify-center mb-3">
                  <Trees size={24} color="#059669" />
                </View>
                <Text className="text-3xl font-bold text-gray-900">
                  {userStats.totalTrees}
                </Text>
                <Text className="text-gray-600 font-medium">Total Trees</Text>
                <Text className="text-sm text-emerald-600 mt-1">
                  {userStats.activeTrees} active
                </Text>
              </View>

              {/* Flowers Today Card */}
              <View className="w-40 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <View className="w-12 h-12 bg-violet-50 rounded-xl items-center justify-center mb-3">
                  <Flower2 size={24} color="#7C3AED" />
                </View>
                <Text className="text-3xl font-bold text-gray-900">
                  {userStats.flowersToday}
                </Text>
                <Text className="text-gray-600 font-medium">Flowers Today</Text>
                <Text className="text-sm text-gray-500 mt-1">
                  Last 24 hours
                </Text>
              </View>

              {/* Harvest Card */}
              <View className="w-40 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <View className="w-12 h-12 bg-amber-50 rounded-xl items-center justify-center mb-3">
                  <Package size={24} color="#D97706" />
                </View>
                <Text className="text-3xl font-bold text-gray-900">
                  {userStats.harvestThisWeek}
                </Text>
                <Text className="text-gray-600 font-medium">Kg This Week</Text>
                <Text className="text-sm text-gray-500 mt-1">Jackfruit</Text>
              </View>
            </View>
          </ScrollView>
        </View>

        {/* Quick Actions */}
        <View className="px-6 mb-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-2xl font-bold text-gray-900">
              Quick Actions
            </Text>
            <TouchableOpacity onPress={() => router.push("/actions")}>
              <Text className="text-emerald-600 font-medium">View all</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row flex-wrap -mx-2">
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                className="w-1/3 px-2 mb-4"
                onPress={() => handleQuickAction(action.route)}
              >
                <View
                  className={`${action.bgColor} rounded-2xl p-4 items-center justify-center h-32`}
                >
                  <View className="mb-3">{action.icon}</View>
                  <Text className="font-semibold text-gray-900 text-center">
                    {action.title}
                  </Text>
                  <Text className="text-xs text-gray-600 text-center mt-1">
                    {action.description}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Weather & Conditions */}
        <View className="px-6 mb-6">
          <Text className="text-2xl font-bold text-gray-900 mb-4">
            Weather & Conditions
          </Text>

          <View className="bg-gradient-to-r from-blue-50 to-emerald-50 rounded-2xl p-5 border border-blue-100">
            <View className="flex-row justify-between items-center mb-4">
              <View>
                <Text className="text-5xl font-bold text-gray-900">
                  {weather.temperature}
                </Text>
                <Text className="text-lg text-gray-600">
                  {weather.condition}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-gray-700 font-medium">Humidity</Text>
                <Text className="text-2xl font-bold text-blue-600">
                  {weather.humidity}
                </Text>
              </View>
            </View>

            <View className="bg-white rounded-xl p-4 mb-3">
              <View className="flex-row items-center">
                <AlertCircle size={20} color="#D97706" />
                <Text className="ml-2 font-medium text-gray-900">
                  Farming Recommendation
                </Text>
              </View>
              <Text className="text-gray-600 mt-2">
                {weather.recommendation}
              </Text>
            </View>

            <Text className="text-sm text-gray-500 text-center">
              Forecast: {weather.forecast}
            </Text>
          </View>
        </View>

        {/* Kalangka Info Banner */}
        <View className="px-6 mb-10">
          <View className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-2xl p-6">
            <View className="flex-row items-center mb-4">
              <View className="w-12 h-12 bg-white/20 rounded-xl items-center justify-center mr-4">
                <Trees size={24} color="white" />
              </View>
              <View>
                <Text className="text-white text-xl font-bold">Kalangka</Text>
                <Text className="text-emerald-100">
                  Smart Jackfruit Farming
                </Text>
              </View>
            </View>
            <Text className="text-white/90 mb-4">
              QR-per-tree tracking system for optimizing yield and reducing
              losses in jackfruit plantations.
            </Text>
            <TouchableOpacity
              className="bg-white rounded-xl px-4 py-3 items-center"
              onPress={() => router.push("/about")}
            >
              <Text className="text-emerald-700 font-bold">
                Learn More About Kalangka
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
