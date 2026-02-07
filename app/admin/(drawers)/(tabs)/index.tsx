import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Cloud,
  CloudOff,
  Flower2,
  MapPin,
  QrCode,
  RefreshCw,
  Trees,
  User,
  AlertCircle,
  Package,
  Thermometer,
  Droplets,
  Wind,
  CloudRain,
  Sun,
  Cloudy,
  CloudSun,
  Umbrella,
  AlertTriangle,
  CloudSnow,
} from "lucide-react-native";
import NetInfo from "@react-native-community/netinfo";
import * as Location from "expo-location";
import axios from "axios";
import { Link } from "expo-router";
import { getTimeBasedGreeting } from "@/utils/helpers";

const { width } = Dimensions.get("window");

export default function FarmerHomeScreen() {
  const [isOnline, setIsOnline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState(null);

  const [userStats, setUserStats] = useState({
    totalTrees: 24,
    activeTrees: 22,
    flowersToday: 8,
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
      route: "/admin/(drawers)/(tabs)/trees",
    },
    {
      id: 2,
      title: "Log Flowers",
      description: "Record flower count",
      icon: <Flower2 size={28} color="#7C3AED" />,
      bgColor: "bg-violet-50",
      iconColor: "text-violet-600",
      route: "/admin/(drawers)/(tabs)/flowers",
    },
    {
      id: 3,
      title: "Report Harvest",
      description: "Log harvested weight",
      icon: <Package size={28} color="#DC2626" />,
      bgColor: "bg-red-50",
      iconColor: "text-red-600",
      route: "/harvest/(drawers)/(tabs)/harvest",
    },
    {
      id: 4,
      title: "Scan QR",
      description: "Quick tree access",
      icon: <QrCode size={28} color="#2563EB" />,
      bgColor: "bg-blue-50",
      iconColor: "text-blue-600",
      route: "/admin/qrcam",
    },
    {
      id: 5,
      title: "View Map",
      description: "Tree locations",
      icon: <MapPin size={28} color="#059669" />,
      bgColor: "bg-emerald-50",
      iconColor: "text-emerald-600",
      route: "admin/map",
    },
    {
      id: 6,
      title: "User Management",
      description: "Manage farm workers",
      icon: <User size={28} color="#7C3AED" />,
      bgColor: "bg-violet-50",
      iconColor: "text-violet-600",
      route: "/admin/users",
    },
  ]);

  // Weather state with actual data fetching
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

  useEffect(() => {
    // Network check
    const checkNetwork = async () => {
      const state = await NetInfo.fetch();
      setIsOnline(state.isConnected ?? false);
    };

    checkNetwork();

    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? false);
    });

    // Fetch weather data on component mount
    fetchLocationAndWeather();

    return () => unsubscribe();
  }, []);

  const fetchLocationAndWeather = async () => {
    setWeather((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // Request location permission
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

      // Get current location
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLocation(location);

      // Fetch weather data
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
      console.log("Fetching weather from Open-Meteo...");
      console.log("Latitude:", latitude);
      console.log("Longitude:", longitude);

      // Open-Meteo API request
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
          timeout: 10000, // 10 seconds timeout
        },
      );

      console.log("Open-Meteo API response status:", response.status);
      if (response.status !== 200) {
        throw new Error(`Open-Meteo API error: ${response.status}`);
      }

      const data = response.data;
      console.log("Weather data received:", data.current);

      // Convert WMO weather codes to human readable conditions
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

      // Get rainfall data - prefer rain, then precipitation
      const rainfall = data.current.rain || data.current.precipitation || 0;

      // Generate farming recommendation based on weather
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

  // Generate farming recommendations based on weather
  const generateFarmingRecommendation = (
    weatherCode,
    temperature,
    rainfall,
    windSpeed,
  ) => {
    // Jackfruit-specific recommendations
    const recommendations = [];

    // Temperature-based recommendations
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

    // Rainfall-based recommendations
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

    // Weather condition-based recommendations
    if (weatherCode === 0 || weatherCode === 1) {
      recommendations.push("☀️ Sunny day: Ideal for pruning and weeding");
    } else if (weatherCode === 2 || weatherCode === 3) {
      recommendations.push("☁️ Cloudy weather: Good for transplanting");
    } else if (weatherCode >= 95 && weatherCode <= 99) {
      recommendations.push("⚡ Storm warning: Secure farm equipment");
    }

    // Wind-based recommendations
    if (windSpeed > 30) {
      recommendations.push("💨 Strong winds: Check tree supports and staking");
    }

    // General jackfruit care
    if (recommendations.length === 0) {
      recommendations.push("🌱 Good day for routine jackfruit inspection");
    }

    // Add pollination reminder during flowering season
    const currentMonth = new Date().getMonth();
    if (currentMonth >= 2 && currentMonth <= 5) {
      recommendations.push("🌸 Flowering season: Monitor pollination");
    }

    return recommendations.join(" • ");
  };

  const onRefresh = async () => {
    setRefreshing(true);

    // Refresh both weather and stats
    await Promise.all([
      fetchLocationAndWeather(),
      new Promise((resolve) => setTimeout(resolve, 1000)), // Simulate stats update
    ]);

    // Update stats
    setUserStats((prev) => ({
      ...prev,
      flowersToday: Math.floor(Math.random() * 15) + 5,
      harvestThisWeek: Math.floor(Math.random() * 50) + 100,
    }));

    setRefreshing(false);
  };

  // Weather icon based on condition
  const getWeatherIcon = (condition) => {
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

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

      {/* Header */}
      <View className="bg-white px-6 pt-6 pb-4 border-b border-gray-200">
        <View className="flex-row justify-between items-center mb-4">
          <View>
            <Text className="text-3xl font-bold text-gray-900">
              {getTimeBasedGreeting()},
            </Text>
            <Text className="text-lg text-gray-600">Welcome to Kalangka</Text>
          </View>
          <Link href="/admin/profile" asChild>
            <TouchableOpacity className="w-12 h-12 rounded-full bg-gray-100 items-center justify-center">
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
            disabled={weather.loading}
            className="flex-row items-center"
          >
            <RefreshCw
              size={18}
              color="#059669"
              className={`mr-1 ${weather.loading ? "animate-spin" : ""}`}
            />
            <Text className="text-sm text-emerald-600">Refresh</Text>
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
          </View>

          <View className="flex-row flex-wrap -mx-2">
            {quickActions.map((action) => (
              <Link
                key={action.id}
                href={action.route}
                asChild
                className="w-1/3 px-2 mb-4"
              >
                <TouchableOpacity>
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
              </Link>
            ))}
          </View>
        </View>

        {/* Weather & Conditions with REAL DATA */}
        <View className="px-6 mb-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-2xl font-bold text-gray-900">
              Weather & Conditions
            </Text>
            {weather.loading && (
              <ActivityIndicator size="small" color="#059669" />
            )}
          </View>

          <View className="bg-gradient-to-r from-blue-50 to-emerald-50 rounded-2xl p-5 border border-blue-100">
            {/* Loading State */}
            {weather.loading && (
              <View className="items-center py-6">
                <ActivityIndicator size="large" color="#059669" />
                <Text className="text-gray-600 mt-2">
                  Fetching weather data...
                </Text>
              </View>
            )}

            {/* Error State */}
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

            {/* Success State */}
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

                {/* Additional Weather Info */}
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
                    <Text className="text-sm text-gray-600 mt-1">Rain</Text>
                    <Text className="font-bold text-blue-600">
                      {weather.rainfall}
                    </Text>
                  </View>
                </View>

                {/* Farming Recommendation */}
                <View className="bg-white rounded-xl p-4">
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

                {/* Location Info */}
                {location && (
                  <View className="mt-4 bg-blue-50 rounded-xl p-3">
                    <View className="flex-row items-center mb-1">
                      <MapPin size={16} color="#3B82F6" />
                      <Text className="ml-2 text-sm font-medium text-gray-900">
                        Your Location
                      </Text>
                    </View>
                    <Text className="text-xs text-gray-600">
                      {location.coords.latitude.toFixed(4)},{" "}
                      {location.coords.longitude.toFixed(4)}
                    </Text>
                  </View>
                )}

                <Text className="text-sm text-gray-500 text-center mt-4">
                  {weather.forecast}
                </Text>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
