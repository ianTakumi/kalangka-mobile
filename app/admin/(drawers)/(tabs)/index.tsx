import FlowerService from "@/services/FlowerService";
import FruitService from "@/services/FruitService";
import HarvestService from "@/services/HarvestService";
import treeService from "@/services/treeService";
import UserService from "@/services/UserService";
import { Fruit } from "@/types";
import { getTimeBasedGreeting } from "@/utils/helpers";
import NetInfo from "@react-native-community/netinfo";
import axios from "axios";
import * as Location from "expo-location";
import { Link } from "expo-router";
import {
  AlertCircle,
  AlertTriangle,
  Banana,
  Calendar,
  CalendarCheck,
  Cloud,
  CloudOff,
  CloudRain,
  CloudSnow,
  CloudSun,
  Cloudy,
  Droplets,
  Flower2,
  MapPin,
  Package,
  QrCode,
  RefreshCw,
  Sun,
  Thermometer,
  Trees,
  Umbrella,
  User,
  Wind,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

const { width } = Dimensions.get("window");

export default function FarmerHomeScreen() {
  const [isOnline, setIsOnline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState(null);
  const [fruitsWithoutHarvest, setFruitsWithoutHarvest] = useState<Fruit[]>([]);
  const [loadingFruits, setLoadingFruits] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);

  const [userStats, setUserStats] = useState({
    totalTrees: 0,
    totalFlowers: 0,
    totalFruits: 0,
    totalUsers: 0,
    totalContacts: 0,
    totalHarvests: 0,
    totalWeight: 0,
    totalWaste: 0,
  });

  const [quickActions] = useState([
    {
      id: 1,
      title: "Register Tree",
      description: "Add new jackfruit tree",
      icon: <Trees size={28} color="#059669" />,
      bgColor: "bg-emerald-50",
      iconColor: "text-emerald-600",
      route: "/admin/(drawers)/(tabs)/trees",
    },
    {
      id: 2,
      title: "Scan QR",
      description: "Quick tree access",
      icon: <QrCode size={28} color="#2563EB" />,
      bgColor: "bg-blue-50",
      iconColor: "text-blue-600",
      route: "/admin/qrcam",
    },
    {
      id: 3,
      title: "View Map",
      description: "Tree locations",
      icon: <MapPin size={28} color="#059669" />,
      bgColor: "bg-emerald-50",
      iconColor: "text-emerald-600",
      route: "admin/map",
    },
    {
      id: 4,
      title: "User Management",
      description: "Manage farm workers",
      icon: <User size={28} color="#7C3AED" />,
      bgColor: "bg-violet-50",
      iconColor: "text-violet-600",
      route: "/admin/users",
    },
    {
      id: 5,
      title: "Assign Harvest",
      description: "Schedule harvest",
      icon: <CalendarCheck size={28} color="#E67E22" />,
      bgColor: "bg-orange-50",
      iconColor: "text-orange-600",
      route: "/admin/assign",
    },
    {
      id: 6,
      title: "View Flowers",
      description: "All flowers list",
      icon: <Flower2 size={28} color="#EC4899" />,
      bgColor: "bg-pink-50",
      iconColor: "text-pink-600",
      route: "/admin/allFlowers",
    },
    {
      id: 7,
      title: "View Fruits",
      description: "All fruits list",
      icon: <Banana size={28} color="#F97316" />,
      bgColor: "bg-orange-50",
      iconColor: "text-orange-600",
      route: "/admin/allFruits",
    },
    {
      id: 8,
      title: "View Harvests",
      description: "All harvests list",
      icon: <Banana size={28} color="#F97316" />,
      bgColor: "bg-orange-50",
      iconColor: "text-orange-600",
      route: "/admin/allHarvest",
    },
  ]);

  const [weather, setWeather] = useState({
    condition: "Loading...",
    temperature: "--°C",
    humidity: "--%",
    feelsLike: "--°C",
    windSpeed: "-- km/h",
    rainfall: "0 mm",
    forecast: "Fetching weather data...",
    recommendation: "Getting farming recommendations...",
    loading: true,
    error: null,
  });

  const loadStats = async () => {
    try {
      setLoadingStats(true);

      const [
        totalTrees,
        totalFlowers,
        totalFruits,
        totalUsers,
        completedStats,
      ] = await Promise.all([
        treeService.getTreeCount(),
        FlowerService.getFlowerCount(),
        FruitService.getFruitCount(),
        UserService.getUserCount(),
        HarvestService.getCompletedHarvestStats(),
      ]);

      setUserStats({
        totalTrees,
        totalFlowers,
        totalFruits,
        totalUsers,
        totalContacts: completedStats.totalContacts || 0,
        totalHarvests: completedStats.totalHarvest,
        totalWeight: completedStats.totalWeight,
        totalWaste: completedStats.totalWaste,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to load statistics",
      });
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchFruitsWithoutHarvest = async () => {
    setLoadingFruits(true);
    try {
      const fruits = await FruitService.getFruitsWithoutHarvest(false);
      setFruitsWithoutHarvest(fruits);
    } catch (error) {
      console.error("Error fetching fruits without harvest:", error);
    } finally {
      setLoadingFruits(false);
    }
  };

  useEffect(() => {
    const checkNetwork = async () => {
      const state = await NetInfo.fetch();
      setIsOnline(state.isConnected ?? false);
    };

    checkNetwork();
    loadStats();
    fetchFruitsWithoutHarvest();

    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? false);
    });

    fetchLocationAndWeather();

    return () => unsubscribe();
  }, []);

  const fetchLocationAndWeather = async () => {
    setWeather((prev) => ({ ...prev, loading: true, error: null }));

    try {
      let { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setWeather({
          condition: "Location Required",
          temperature: "--°C",
          humidity: "--%",
          feelsLike: "--°C",
          windSpeed: "-- km/h",
          rainfall: "-- mm",
          forecast: "Enable location for weather",
          recommendation: "Enable location for personalized farming advice",
          loading: false,
          error: "Location permission denied",
        });
        return;
      }

      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLocation(location);

      await fetchWeatherData(
        location.coords.latitude,
        location.coords.longitude,
      );
    } catch (error) {
      console.error("Location/Weather error:", error);
      setWeather({
        condition: "Error",
        temperature: "--°C",
        humidity: "--%",
        feelsLike: "--°C",
        windSpeed: "-- km/h",
        rainfall: "-- mm",
        forecast: "Failed to get weather data",
        recommendation: "Unable to provide farming recommendations",
        loading: false,
        error: error.message,
      });
    }
  };

  const fetchWeatherData = async (latitude, longitude) => {
    try {
      const response = await axios.get(
        `https://api.open-meteo.com/v1/forecast`,
        {
          params: {
            latitude: latitude,
            longitude: longitude,
            current:
              "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code,rain,precipitation",
            timezone: "auto",
          },
          timeout: 10000,
        },
      );

      const data = response.data;

      const getWeatherCondition = (code) => {
        const weatherCodes = {
          0: "Clear Sky",
          1: "Mainly Clear",
          2: "Partly Cloudy",
          3: "Cloudy",
          45: "Foggy",
          48: "Foggy",
          51: "Light Drizzle",
          53: "Moderate Drizzle",
          55: "Dense Drizzle",
          56: "Light Freezing Drizzle",
          57: "Dense Freezing Drizzle",
          61: "Light Rain",
          63: "Moderate Rain",
          65: "Heavy Rain",
          66: "Light Freezing Rain",
          67: "Heavy Freezing Rain",
          71: "Light Snow",
          73: "Moderate Snow",
          75: "Heavy Snow",
          77: "Snow Grains",
          80: "Light Rain Showers",
          81: "Moderate Rain Showers",
          82: "Violent Rain Showers",
          85: "Light Snow Showers",
          86: "Heavy Snow Showers",
          95: "Thunderstorm",
          96: "Thunderstorm with Hail",
          99: "Heavy Thunderstorm",
        };
        return weatherCodes[code] || "Unknown";
      };

      const condition = getWeatherCondition(data.current.weather_code);
      const rainfall = data.current.rain || data.current.precipitation || 0;
      const recommendation = generateFarmingRecommendation(
        data.current.weather_code,
        data.current.temperature_2m,
        rainfall,
        data.current.wind_speed_10m,
      );

      setWeather({
        condition: condition,
        temperature: `${Math.round(data.current.temperature_2m)}°C`,
        humidity: `${data.current.relative_humidity_2m}%`,
        feelsLike: `${Math.round(data.current.apparent_temperature)}°C`,
        windSpeed: `${(data.current.wind_speed_10m * 3.6).toFixed(1)} km/h`,
        rainfall: `${rainfall.toFixed(1)} mm`,
        forecast: "Real-time weather (Open-Meteo)",
        recommendation: recommendation,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error("Weather fetch error:", error);
      setWeather({
        condition: "API Error",
        temperature: "--°C",
        humidity: "--%",
        feelsLike: "--°C",
        windSpeed: "-- km/h",
        rainfall: "-- mm",
        forecast: "Weather service unavailable",
        recommendation: "Check connection for farming recommendations",
        loading: false,
        error: error.message,
      });
    }
  };

  const generateFarmingRecommendation = (
    weatherCode,
    temperature,
    rainfall,
    windSpeed,
  ) => {
    const recommendations = [];

    if (temperature > 35) {
      recommendations.push(
        "🌡️ Extreme heat: Water trees in early morning or late evening",
      );
    } else if (temperature < 10) {
      recommendations.push(
        "❄️ Cold weather: Protect young jackfruit trees from frost",
      );
    } else if (temperature >= 25 && temperature <= 35) {
      recommendations.push("☀️ Ideal temperature for jackfruit growth");
    }

    if (weatherCode >= 61 && weatherCode <= 67) {
      if (rainfall > 20) {
        recommendations.push(
          "🌧️ Heavy rain: Check drainage to prevent waterlogging",
        );
      } else if (rainfall > 5) {
        recommendations.push("🌦️ Moderate rain: Good for natural watering");
      } else {
        recommendations.push("🌧️ Light rain: Perfect for planting activities");
      }
    } else if (rainfall === 0 && temperature > 25) {
      recommendations.push("💧 No rain: Consider irrigation for young trees");
    }

    if (weatherCode === 0 || weatherCode === 1) {
      recommendations.push("☀️ Sunny day: Ideal for pruning and weeding");
    } else if (weatherCode === 2 || weatherCode === 3) {
      recommendations.push("☁️ Cloudy weather: Good for transplanting");
    } else if (weatherCode >= 95 && weatherCode <= 99) {
      recommendations.push("⚡ Storm warning: Secure farm equipment");
    }

    if (windSpeed > 30) {
      recommendations.push("💨 Strong winds: Check tree supports and staking");
    }

    if (recommendations.length === 0) {
      recommendations.push("🌱 Good day for routine jackfruit inspection");
    }

    const currentMonth = new Date().getMonth();
    if (currentMonth >= 2 && currentMonth <= 5) {
      recommendations.push("🌸 Flowering season: Monitor pollination");
    }

    return recommendations.join(" • ");
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadStats(),
      fetchFruitsWithoutHarvest(),
      fetchLocationAndWeather(),
    ]);
    setRefreshing(false);
  };

  const getWeatherIcon = (condition: string) => {
    const cond = condition.toLowerCase();

    if (cond.includes("clear") || cond.includes("sunny")) {
      return <Sun size={32} color="#F59E0B" />;
    } else if (
      cond.includes("partly cloudy") ||
      cond.includes("mainly clear")
    ) {
      return <CloudSun size={32} color="#F59E0B" />;
    } else if (cond.includes("cloudy")) {
      return <Cloudy size={32} color="#6B7280" />;
    } else if (cond.includes("drizzle") || cond.includes("light rain")) {
      return <CloudRain size={32} color="#3B82F6" />;
    } else if (cond.includes("rain") || cond.includes("shower")) {
      return <Umbrella size={32} color="#2563EB" />;
    } else if (cond.includes("thunderstorm") || cond.includes("storm")) {
      return <AlertTriangle size={32} color="#DC2626" />;
    } else if (cond.includes("fog")) {
      return <Cloud size={32} color="#9CA3AF" />;
    } else if (cond.includes("error") || cond.includes("unavailable")) {
      return <AlertTriangle size={32} color="#DC2626" />;
    } else if (cond.includes("snow")) {
      return <CloudSnow size={32} color="#93C5FD" />;
    } else {
      return <Cloud size={32} color="#6B7280" />;
    }
  };

  // Stats card configuration with routes
  const statsCards = [
    {
      id: "totalTrees",
      title: "Total Trees",
      value: userStats.totalTrees,
      icon: <Trees size={24} color="#059669" />,
      iconBgColor: "bg-emerald-100",
      route: "/admin/(drawers)/(tabs)/trees",
      subtitle: "All trees",
    },
    {
      id: "totalFlowers",
      title: "Total Flowers",
      value: userStats.totalFlowers,
      icon: <Flower2 size={24} color="#EC4899" />,
      iconBgColor: "bg-pink-100",
      route: "/admin/allFlowers",
      subtitle: "All flowers",
    },
    {
      id: "totalFruits",
      title: "Total Fruits",
      value: userStats.totalFruits,
      icon: <Banana size={24} color="#F97316" />,
      iconBgColor: "bg-orange-100",
      route: "/admin/allFruits",
      subtitle: "All fruits",
    },
    {
      id: "totalHarvests",
      title: "Harvested Fruits",
      value: userStats.totalHarvests,
      icon: <Package size={24} color="#3B82F6" />,
      iconBgColor: "bg-blue-100",
      route: "/admin/allHarvest",
      subtitle: "This year",
    },
    {
      id: "totalWeight",
      title: "Total Weight",
      value: `${userStats.totalWeight} kg`,
      icon: <Banana size={24} color="#059669" />,
      iconBgColor: "bg-emerald-100",
      route: "/admin/allHarvest",
      subtitle: "This year",
    },
    {
      id: "totalWaste",
      title: "Total Waste",
      value: `${userStats.totalWaste} fruits`,
      icon: <AlertTriangle size={24} color="#EA580C" />,
      iconBgColor: "bg-orange-100",
      route: "/admin/allHarvest",
      subtitle: "This year",
    },
    {
      id: "totalUsers",
      title: "Farm Workers",
      value: userStats.totalUsers,
      icon: <User size={24} color="#7C3AED" />,
      iconBgColor: "bg-violet-100",
      route: "/admin/users",
      subtitle: "Active",
    },
    {
      id: "totalContacts",
      title: "Total Contacts",
      value: userStats.totalContacts,
      icon: <MapPin size={24} color="#2563EB" />,
      iconBgColor: "bg-blue-100",
      route: "/admin/contacts",
      subtitle: "All contacts",
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

      {/* Header */}
      <View className="bg-white px-6 pt-6 pb-4 border-b border-gray-200 shadow-sm">
        <View className="flex-row justify-between items-center mb-4">
          <View>
            <Text className="text-3xl font-bold text-gray-900">
              {getTimeBasedGreeting()} Admin
            </Text>
            <Text className="text-lg text-gray-600 mt-1">
              Manage your farm efficiently
            </Text>
          </View>
          <Link href="/admin/profile" asChild>
            <TouchableOpacity className="w-12 h-12 rounded-full bg-gray-100 items-center justify-center shadow-sm">
              <User size={24} color="#4B5563" />
            </TouchableOpacity>
          </Link>
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
          <TouchableOpacity
            onPress={onRefresh}
            disabled={weather.loading || loadingStats}
            className="flex-row items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50"
          >
            <RefreshCw
              size={18}
              color="#059669"
              className={weather.loading || loadingStats ? "animate-spin" : ""}
            />
            <Text className="text-sm text-emerald-600 font-medium">
              Refresh
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
            <Text className="text-gray-600">Real-time farm statistics</Text>
          </View>

          {loadingStats ? (
            <View className="mb-6 items-center py-12">
              <ActivityIndicator size="large" color="#059669" />
              <Text className="text-gray-500 mt-3">Loading statistics...</Text>
            </View>
          ) : (
            <View className="mb-6">
              {/* Stats Grid - 2 columns */}
              <View className="flex-row flex-wrap -mx-2">
                {statsCards.map((card) => (
                  <View key={card.id} className="w-1/2 px-2 mb-4">
                    <View className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                      <View className="p-4">
                        {/* Header with icon and arrow */}
                        <View className="flex-row justify-between items-start mb-3">
                          <View
                            className={`${card.iconBgColor} w-12 h-12 rounded-xl items-center justify-center`}
                          >
                            {card.icon}
                          </View>
                        </View>

                        {/* Value */}
                        <Text className="text-2xl font-bold text-gray-900 mb-1">
                          {card.value}
                        </Text>

                        {/* Title */}
                        <Text className="text-gray-700 font-medium">
                          {card.title}
                        </Text>

                        {/* Subtitle if exists */}
                        {card.subtitle && (
                          <Text className="text-xs text-gray-500 mt-1">
                            {card.subtitle}
                          </Text>
                        )}
                      </View>

                      {/* Bottom indicator bar */}
                      <View className="h-1 bg-emerald-500 w-full" />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View className="px-6 mb-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-2xl font-bold text-gray-900">
              Quick Actions
            </Text>
          </View>

          <View className="flex-row flex-wrap -mx-2">
            {quickActions.map((action) => (
              <Link
                key={action.id}
                href={action.route}
                asChild
                className={`px-2 mb-4 ${
                  action.title === "User Management" ? "w-2/3" : "w-1/3"
                }`}
              >
                <TouchableOpacity activeOpacity={0.8}>
                  <View
                    className={`${action.bgColor} rounded-2xl p-4 items-center justify-center ${
                      action.title === "User Management"
                        ? "h-32 flex-row"
                        : "h-32"
                    } shadow-sm`}
                  >
                    <View
                      className={`${action.title === "User Management" ? "mr-3" : "mb-3"}`}
                    >
                      {action.icon}
                    </View>
                    <View
                      className={
                        action.title === "User Management" ? "flex-1" : ""
                      }
                    >
                      <Text className="font-semibold text-gray-900 text-center">
                        {action.title}
                      </Text>
                      <Text className="text-xs text-gray-600 text-center mt-1">
                        {action.description}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </Link>
            ))}
          </View>
        </View>

        {/* Bagged Fruits Pending Assignment Section */}
        <View className="px-6 mb-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-2xl font-bold text-gray-900">
              Pending Assignments
            </Text>
            {loadingFruits && (
              <ActivityIndicator size="small" color="#F97316" />
            )}
          </View>

          {loadingFruits ? (
            <View className="bg-white rounded-2xl p-8 items-center shadow-sm">
              <ActivityIndicator size="large" color="#F97316" />
              <Text className="text-gray-600 mt-3">
                Checking bagged fruits...
              </Text>
            </View>
          ) : fruitsWithoutHarvest.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center border border-orange-100 shadow-sm">
              <View className="w-16 h-16 bg-orange-50 rounded-full items-center justify-center mb-3">
                <Package size={32} color="#F97316" />
              </View>
              <Text className="text-lg font-medium text-gray-900 mb-1">
                All Caught Up! 🎉
              </Text>
              <Text className="text-gray-500 text-center">
                All bagged fruits have been assigned to harvesters.
              </Text>
            </View>
          ) : (
            <View className="bg-white rounded-2xl p-4 border border-orange-100 shadow-sm">
              <View className="flex-row items-center justify-between mb-4 px-2">
                <View className="flex-row items-center">
                  <View className="w-12 h-12 bg-orange-100 rounded-full items-center justify-center mr-3">
                    <Package size={24} color="#F97316" />
                  </View>
                  <View>
                    <Text className="text-2xl font-bold text-gray-900">
                      {fruitsWithoutHarvest.length}
                    </Text>
                    <Text className="text-xs text-gray-500">
                      {fruitsWithoutHarvest.length === 1 ? "Fruit" : "Fruits"}{" "}
                      pending assignment
                    </Text>
                  </View>
                </View>
                <Link href="/admin/assign" asChild>
                  <TouchableOpacity className="bg-orange-50 px-4 py-2 rounded-lg">
                    <Text className="text-orange-600 font-medium text-sm">
                      View All
                    </Text>
                  </TouchableOpacity>
                </Link>
              </View>

              {/* Fruit Cards List */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-3"
              >
                <View className="flex-row gap-3 px-2">
                  {fruitsWithoutHarvest.slice(0, 5).map((fruit) => (
                    <Link key={fruit.id} href={`/admin/assign`} asChild>
                      <TouchableOpacity className="w-72 bg-gray-50 rounded-xl p-3 border border-gray-200">
                        <View className="flex-row justify-between items-start mb-2">
                          <Text
                            className="font-bold text-gray-900 flex-1 mr-2"
                            numberOfLines={1}
                          >
                            {fruit.treeName ||
                              fruit.tree?.description ||
                              `Fruit #${fruit.id.substring(0, 8)}`}
                          </Text>
                          <View className="bg-orange-100 px-2 py-0.5 rounded-full">
                            <Text className="text-xs text-orange-700">
                              Unassigned
                            </Text>
                          </View>
                        </View>

                        <View className="flex-row gap-2 mb-2">
                          {fruit.flower_id && (
                            <View className="bg-blue-50 px-2 py-0.5 rounded-md">
                              <Text className="text-xs text-blue-700">
                                🌸 {fruit.flower_id.substring(0, 6)}
                              </Text>
                            </View>
                          )}
                          {fruit.tree?.type && (
                            <View className="bg-green-50 px-2 py-0.5 rounded-md">
                              <Text className="text-xs text-green-700">
                                🌳 {fruit.tree.type}
                              </Text>
                            </View>
                          )}
                        </View>

                        <View className="flex-row gap-3 mb-2">
                          <View className="flex-row items-center">
                            <Calendar size={12} color="#6B7280" />
                            <Text className="text-xs text-gray-500 ml-1">
                              {fruit.bagged_at
                                ? new Date(fruit.bagged_at).toLocaleDateString(
                                    "en-PH",
                                    {
                                      month: "short",
                                      day: "numeric",
                                    },
                                  )
                                : "N/A"}
                            </Text>
                          </View>
                          <View className="flex-row items-center">
                            <Package size={12} color="#6B7280" />
                            <Text className="text-xs text-gray-500 ml-1">
                              Qty: {fruit.quantity || 1}
                            </Text>
                          </View>
                        </View>

                        {fruit.bagged_at && (
                          <Text className="text-xs text-gray-400">
                            📅{" "}
                            {Math.floor(
                              (new Date().getTime() -
                                new Date(fruit.bagged_at).getTime()) /
                                (1000 * 60 * 60 * 24),
                            )}{" "}
                            days since bagging
                          </Text>
                        )}
                      </TouchableOpacity>
                    </Link>
                  ))}
                </View>
              </ScrollView>

              <Link href="/admin/assign" asChild>
                <TouchableOpacity className="mt-3 bg-orange-600 rounded-xl py-3 flex-row items-center justify-center shadow-sm">
                  <User size={20} color="#FFFFFF" />
                  <Text className="text-white font-medium ml-2">
                    Assign Harvester{fruitsWithoutHarvest.length > 1 ? "s" : ""}{" "}
                    ({fruitsWithoutHarvest.length})
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          )}
        </View>

        {/* Weather & Conditions */}
        <View className="px-6 mb-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-2xl font-bold text-gray-900">
              Weather & Conditions
            </Text>
            {weather.loading && (
              <ActivityIndicator size="small" color="#059669" />
            )}
          </View>

          <View className="bg-gradient-to-r from-blue-50 to-emerald-50 rounded-2xl p-5 border border-blue-100 shadow-sm">
            {weather.loading && (
              <View className="items-center py-6">
                <ActivityIndicator size="large" color="#059669" />
                <Text className="text-gray-600 mt-2">
                  Fetching weather data...
                </Text>
              </View>
            )}

            {!weather.loading && weather.error && (
              <View className="items-center justify-center py-6">
                <AlertTriangle size={48} color="#DC2626" className="mb-4" />
                <Text className="text-xl font-bold text-gray-900 mb-2">
                  Weather Unavailable
                </Text>
                <Text className="text-gray-600 text-center mb-4">
                  {weather.error}
                </Text>
                <TouchableOpacity
                  onPress={fetchLocationAndWeather}
                  className="bg-emerald-600 px-4 py-2 rounded-lg"
                >
                  <Text className="text-white font-medium">Try Again</Text>
                </TouchableOpacity>
              </View>
            )}

            {!weather.loading && !weather.error && (
              <>
                <View className="flex-row justify-between items-center mb-4">
                  <View className="flex-row items-center">
                    <View className="mr-4">
                      {getWeatherIcon(weather.condition)}
                    </View>
                    <View>
                      <Text className="text-5xl font-bold text-gray-900">
                        {weather.temperature}
                      </Text>
                      <Text className="text-lg text-gray-600">
                        {weather.condition}
                      </Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <View className="flex-row items-center mb-2">
                      <Droplets size={18} color="#3B82F6" />
                      <Text className="ml-2 text-gray-700 font-medium">
                        Humidity
                      </Text>
                    </View>
                    <Text className="text-2xl font-bold text-blue-600">
                      {weather.humidity}
                    </Text>
                  </View>
                </View>

                <View className="flex-row justify-between mb-4 bg-white/50 rounded-xl p-3">
                  <View className="items-center">
                    <Thermometer size={20} color="#DC2626" />
                    <Text className="text-sm text-gray-600 mt-1">
                      Feels Like
                    </Text>
                    <Text className="font-bold text-gray-900">
                      {weather.feelsLike}
                    </Text>
                  </View>
                  <View className="items-center">
                    <Wind size={20} color="#059669" />
                    <Text className="text-sm text-gray-600 mt-1">Wind</Text>
                    <Text className="font-bold text-gray-900">
                      {weather.windSpeed}
                    </Text>
                  </View>
                  <View className="items-center">
                    <CloudRain size={20} color="#3B82F6" />
                    <Text className="text-sm text-gray-600 mt-1">Rainfall</Text>
                    <Text className="font-bold text-blue-600">
                      {weather.rainfall}
                    </Text>
                  </View>
                </View>

                <View className="bg-white rounded-xl p-4 shadow-sm">
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

                <Text className="text-sm text-gray-500 text-center mt-4">
                  {weather.forecast}
                </Text>
              </>
            )}
          </View>
        </View>
      </ScrollView>
      <Toast />
    </SafeAreaView>
  );
}
