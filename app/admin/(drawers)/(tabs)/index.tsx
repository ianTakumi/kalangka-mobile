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
  Thermometer,
  Droplets,
  Wind,
  CloudRain,
  Sun,
  Cloudy,
  CloudSun,
  Umbrella,
  AlertTriangle,
} from "lucide-react-native";
import NetInfo from "@react-native-community/netinfo";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import axios from "axios";
const { width } = Dimensions.get("window");

export default function FarmerHomeScreen() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState(null);

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
      route: "/map",
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

  // Default weather data (offline/loading)
  const [weather, setWeather] = useState({
    condition: "Loading...",
    temperature: "--°C",
    humidity: "--%",
    feelsLike: "--°C",
    windSpeed: "-- km/h",
    rainfall: "0 mm",
    forecast: "Fetching weather data...",
    recommendation: "Weather information loading...",
    loading: true,
    error: null,
  });

  useEffect(() => {
    checkNetworkStatus();

    const unsubscribe = NetInfo.addEventListener((state) => {
      const newStatus = state.isConnected ?? false;
      setIsOnline(newStatus);

      // Kung nag-online, fetch weather
      if (newStatus) {
        fetchLocationAndWeather();
      }
    });

    // Initial fetch after checking network
    checkNetworkStatus().then(() => {
      fetchLocationAndWeather();
    });

    return () => unsubscribe();
  }, []);

  const checkNetworkStatus = async () => {
    const state = await NetInfo.fetch();
    setIsOnline(state.isConnected ?? false);
  };

  const fetchLocationAndWeather = async () => {
    setWeatherLoading(true);
    setWeatherError(null);

    try {
      // Kung offline, set offline weather
      if (!isOnline) {
        setWeather({
          condition: "Offline",
          temperature: "--°C",
          humidity: "--%",
          feelsLike: "--°C",
          windSpeed: "-- km/h",
          rainfall: "-- mm",
          forecast: "No internet connection",
          recommendation: "Connect to get weather updates",
          loading: false,
          error: "No internet connection",
        });
        setWeatherLoading(false);
        return;
      }

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
          recommendation: "Allow location access for accurate weather",
          loading: false,
          error: "Location permission denied",
        });
        setWeatherLoading(false);
        return;
      }

      // Get current location
      setLocationLoading(true);
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
        forecast: "Failed to get weather",
        recommendation: "Try refreshing or check connection",
        loading: false,
        error: error.message,
      });
    } finally {
      setLocationLoading(false);
      setWeatherLoading(false);
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
            hourly: "temperature_2m,precipitation_probability",
            daily:
              "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum",
            timezone: "auto",
            forecast_days: 1,
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

      // Get farming recommendations based on weather
      const getFarmingRecommendation = (
        weatherCondition,
        temp,
        humidity,
        rain,
      ) => {
        const conditions = weatherCondition.toLowerCase();
        const temperature = temp;
        const rainfall = rain || 0;

        if (rainfall > 10) {
          return "Heavy rain expected. Postpone fieldwork. Check drainage systems.";
        } else if (rainfall > 2) {
          return "Light to moderate rain. Good for irrigation but postpone spraying.";
        } else if (
          conditions.includes("thunderstorm") ||
          conditions.includes("storm")
        ) {
          return "Storm warning! Stay indoors. Secure farm equipment and structures.";
        } else if (temperature > 35) {
          return "Extreme heat. Avoid midday work. Water plants early morning.";
        } else if (temperature < 15) {
          return "Cool temperatures. Protect sensitive crops. Good for transplanting.";
        } else if (humidity > 85) {
          return "High humidity - monitor for fungal diseases. Prune for better airflow.";
        } else if (humidity < 40 && temperature > 28) {
          return "Dry conditions. Increase irrigation frequency. Good for harvesting.";
        } else if (
          conditions.includes("sunny") &&
          temperature >= 22 &&
          temperature <= 30
        ) {
          return "Perfect farming weather! Ideal for planting, weeding, and harvesting.";
        } else if (conditions.includes("cloudy")) {
          return "Cloudy day - good for transplanting and soil work. Reduced water stress.";
        } else {
          return "Normal farming conditions. Continue regular farm maintenance.";
        }
      };

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
      const recommendation = getFarmingRecommendation(
        condition,
        data.current.temperature_2m,
        data.current.relative_humidity_2m,
        data.current.rain || data.current.precipitation,
      );

      // Get rainfall data - prefer rain, then precipitation
      const rainfall = data.current.rain || data.current.precipitation || 0;

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
        recommendation: "Try again later",
        loading: false,
        error: error.message,
      });
    }
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
    await fetchLocationAndWeather();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleQuickAction = (route) => {
    try {
      router.push(route);
    } catch (error) {
      console.log("Router not ready:", error);
      // Pwedeng gumamit ng alternative navigation
    }
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
    } else if (cond.includes("offline") || cond.includes("error")) {
      return <CloudOff size={32} color="#9CA3AF" />;
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
              Good morning
            </Text>
            <Text className="text-lg text-gray-600">Welcome to Kalangka</Text>
          </View>
          <TouchableOpacity
            className="w-12 h-12 rounded-full bg-gray-100 items-center justify-center"
            onPress={() => router.push("/admin/profile")}
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
        {/* Weather & Conditions */}
        <View className="px-6 mb-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-2xl font-bold text-gray-900">
              Weather & Conditions
            </Text>
            <TouchableOpacity
              onPress={fetchLocationAndWeather}
              disabled={weatherLoading || !isOnline}
              className="flex-row items-center"
            >
              <RefreshCw
                size={18}
                color={isOnline ? "#059669" : "#9CA3AF"}
                className={`mr-1 ${weatherLoading ? "animate-spin" : ""}`}
              />
              <Text
                className={`text-sm ${isOnline ? "text-emerald-600" : "text-gray-400"}`}
              >
                Refresh
              </Text>
            </TouchableOpacity>
          </View>

          <View
            className={`rounded-2xl p-5 border ${
              weather.loading || !isOnline || weather.error
                ? "bg-gray-50 border-gray-200"
                : "bg-gradient-to-r from-blue-50 to-emerald-50 border-blue-100"
            }`}
          >
            {/* Loading State */}
            {(weather.loading || weatherLoading) && (
              <View className="items-center py-6">
                <ActivityIndicator size="large" color="#059669" />
                <Text className="text-gray-600 mt-2">
                  Fetching weather data...
                </Text>
              </View>
            )}

            {/* Offline State */}
            {!weather.loading && !weatherLoading && !isOnline && (
              <View className="items-center justify-center py-6">
                <CloudOff size={48} color="#9CA3AF" className="mb-4" />
                <Text className="text-xl font-bold text-gray-900 mb-2">
                  Offline Mode
                </Text>
                <Text className="text-gray-600 text-center mb-4">
                  Connect to internet for weather updates
                </Text>
                <View className="bg-white rounded-xl p-4 w-full">
                  <View className="flex-row items-center mb-2">
                    <AlertCircle size={20} color="#D97706" />
                    <Text className="ml-2 font-medium text-gray-900">Note</Text>
                  </View>
                  <Text className="text-gray-600">
                    Farm operations can continue. Weather data will sync when
                    online.
                  </Text>
                </View>
              </View>
            )}

            {/* Error State (online pero nag-error) */}
            {!weather.loading &&
              !weatherLoading &&
              isOnline &&
              weather.error && (
                <View className="items-center justify-center py-6">
                  <AlertTriangle size={48} color="#DC2626" className="mb-4" />
                  <Text className="text-xl font-bold text-gray-900 mb-2">
                    Weather Unavailable
                  </Text>
                  <Text className="text-gray-600 text-center mb-4">
                    {weather.error || "Failed to fetch weather data"}
                  </Text>
                  <TouchableOpacity
                    onPress={fetchLocationAndWeather}
                    className="bg-emerald-600 px-4 py-2 rounded-lg"
                  >
                    <Text className="text-white font-medium">Try Again</Text>
                  </TouchableOpacity>
                </View>
              )}

            {/* Success State - May weather data */}
            {!weather.loading &&
              !weatherLoading &&
              isOnline &&
              !weather.error && (
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
                    <View className="items-center">
                      <Cloud size={20} color="#6B7280" />
                      <Text className="text-sm text-gray-600 mt-1">Status</Text>
                      <Text className="font-bold text-emerald-600">Live</Text>
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
                </>
              )}

            <Text className="text-sm text-gray-500 text-center mt-4">
              {weather.forecast}
              {location &&
                isOnline &&
                !weather.error &&
                ` • Location: ${location.coords.latitude.toFixed(2)}, ${location.coords.longitude.toFixed(2)}`}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
