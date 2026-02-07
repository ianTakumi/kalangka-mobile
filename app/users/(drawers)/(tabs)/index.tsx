import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  RefreshControl,
  Animated,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
  Zap,
  ArrowRight,
  TrendingUp,
  Package,
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
  const scanButtonScale = new Animated.Value(1);
  const pulseAnim = new Animated.Value(1);
  const [weather] = useState({
    condition: "Sunny",
    temperature: "32°C",
    humidity: "65%",
    forecast: "Good for flowering",
    recommendation: "Ideal time for fertilizer application",
  });

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

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

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setRefreshing(false);
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
            onPress={() => router.push("/users/profile")}
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
          </View>
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
        {/* Weather & Conditions */}
        <View className="px-6 mb-6">
          <Text className="text-2xl font-bold text-gray-900 mb-4">
            Weather & Conditions
          </Text>

          <View className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
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

        {/* QR Scan Section - Main Feature */}
        <View className="px-6 pt-6 pb-4">
          <Text className="text-2xl font-bold text-gray-900 mb-2">
            Quick Tree Access
          </Text>
          <Text className="text-gray-600 mb-6">
            Scan any tree's QR code to instantly access its details
          </Text>

          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              className="bg-emerald-600 rounded-3xl p-6"
              onPress={() => router.push("/users/qrcam")}
              activeOpacity={0.9}
            >
              <Animated.View
                style={{ transform: [{ scale: scanButtonScale }] }}
                className="items-center mb-4"
              >
                <View className="w-20 h-20 bg-white/20 rounded-full items-center justify-center mb-4">
                  <QrCode size={40} color="white" />
                </View>

                <View className="flex-row items-center mb-2 gap-2">
                  <Camera size={20} color="white" className="mr-2" />
                  <Text className="text-white text-2xl font-bold">
                    Scan Tree QR Code
                  </Text>
                </View>

                <Text className="text-emerald-100 text-center mb-6">
                  Tap to open camera and scan any tree's QR code
                </Text>
              </Animated.View>

              <View className="bg-white/20 rounded-xl p-4">
                <View className="flex-row items-center">
                  <View className="w-10 h-10 bg-white rounded-full items-center justify-center mr-3">
                    <Zap size={20} color="#059669" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-bold">
                      Instant Tree Access
                    </Text>
                    <Text className="text-emerald-100 text-sm">
                      Register • Monitor • Report activities
                    </Text>
                  </View>
                  <ArrowRight size={20} color="white" />
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Kalangka Info Banner */}
        <View className="px-6 mb-10">
          <View className="bg-emerald-600 rounded-2xl p-6">
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
              onPress={() => router.push("/users/about")}
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
