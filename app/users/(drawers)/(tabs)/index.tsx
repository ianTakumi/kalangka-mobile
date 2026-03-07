import HarvestService from "@/services/HarvestService";
import { User as UserType } from "@/types/index";
import { getTimeBasedGreeting } from "@/utils/helpers";
import NetInfo from "@react-native-community/netinfo";
import axios from "axios";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cloud,
  CloudOff,
  CloudRain,
  CloudSnow,
  CloudSun,
  Cloudy,
  Droplets,
  Package,
  QrCode,
  RefreshCw,
  Sun,
  Thermometer,
  Trees,
  Umbrella,
  User,
  Wind,
  Zap,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
const { width } = Dimensions.get("window");

export default function FarmerHomeScreen() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const scanButtonScale = new Animated.Value(1);
  const pulseAnim = new Animated.Value(1);
  const [location, setLocation] = useState(null);
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [assignedHarvests, setAssignedHarvests] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const user = useSelector((state) => state.auth.user);

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
    // Pulse animation for QR button
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

    // Get current user and assigned harvests
    fetchCurrentUserAndAssignments();

    return () => unsubscribe();
  }, []);

  const fetchCurrentUserAndAssignments = async () => {
    try {
      if (user) {
        await fetchAssignedHarvests(user.id);
      }
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  };

  const fetchAssignedHarvests = async (userId: string) => {
    setLoadingAssignments(true);
    try {
      // Get harvests assigned to this user that are not yet completed
      const harvests = await HarvestService.getAssignmentsByUserId(userId);
      setAssignedHarvests(harvests);
    } catch (error) {
      console.error("Error fetching assigned harvests:", error);
    } finally {
      setLoadingAssignments(false);
    }
  };

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
  ) => {
    if (temperature > 35) {
      return "Extreme heat: Water trees in early morning or late evening to reduce evaporation loss";
    } else if (temperature < 10) {
      return "Cold weather: Protect young jackfruit trees from frost damage";
    }

    if (weatherCode >= 61 && weatherCode <= 67) {
      // Rain codes
      if (rainfall > 20) {
        return "Heavy rain: Check drainage systems to prevent waterlogging in jackfruit roots";
      }
      return "Rainy weather: Good time for planting and natural watering";
    } else if (weatherCode === 0 || weatherCode === 1) {
      // Clear skies
      if (temperature > 25) {
        return "Sunny day: Perfect for pruning, weeding, and applying organic fertilizers";
      }
      return "Clear weather: Good for general farm maintenance activities";
    } else if (weatherCode === 2 || weatherCode === 3) {
      // Cloudy
      return "Cloudy weather: Ideal for transplanting and soil preparation";
    } else if (weatherCode >= 95 && weatherCode <= 99) {
      // Thunderstorms
      return "Storm warning: Secure farm equipment and avoid field work during thunderstorms";
    }

    return "Good day for routine jackfruit farm inspection and maintenance";
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchLocationAndWeather(),
      fetchCurrentUserAndAssignments(),
    ]);
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

  const renderAssignedHarvestItem = ({ item }) => (
    <TouchableOpacity
      className="bg-white rounded-xl p-4 mb-3 border border-gray-200 flex-row items-center"
      onPress={() => {
        if (item.fruit) {
          router.push({
            pathname: "/harvest",
            params: {
              fruitData: JSON.stringify(item.fruit),
              harvestId: item.id,
            },
          });
        } else {
          Alert.alert("Error", "Fruit details not available");
        }
      }}
      activeOpacity={0.7}
    >
      <View className="w-12 h-12 bg-orange-100 rounded-full items-center justify-center mr-3">
        <Package size={24} color="#F97316" />
      </View>
      <View className="flex-1">
        <Text className="font-bold text-gray-900">
          {item.fruit?.treeName || `Fruit #${item.fruit_id?.substring(0, 8)}`}
        </Text>
        <View className="flex-row items-center mt-1">
          <Clock size={14} color="#6B7280" />
          <Text className="text-xs text-gray-600 ml-1">
            Assigned: {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        <View className="flex-row mt-2">
          <View
            className={`rounded-full px-2 py-1 ${
              item.harvest_at ? "bg-green-100" : "bg-blue-100"
            }`}
          >
            <Text
              className={`text-xs ${
                item.harvest_at ? "text-green-700" : "text-blue-700"
              }`}
            >
              {item.harvest_at ? "Harvested" : "Pending Harvest"}
            </Text>
          </View>
        </View>
      </View>
      <ChevronRight size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );

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
          <TouchableOpacity
            onPress={onRefresh}
            disabled={weather.loading}
            className="flex-row items-center gap-2"
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
        {/* Full Weather & Conditions Section */}
        <View className="px-6 mt-4 mb-6">
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

                <Text className="text-sm text-gray-500 text-center mt-4">
                  {weather.forecast}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* ASSIGNED HARVESTS SECTION - NEW */}
        {user && (
          <View className="px-6 mb-6">
            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-row items-center">
                <Package size={24} color="#F97316" />
                <Text className="text-2xl font-bold text-gray-900 ml-2">
                  My Assigned Harvests
                </Text>
              </View>
              {assignedHarvests.length > 0 && (
                <TouchableOpacity
                  onPress={() => router.push("/users/assigned")}
                >
                  <Text className="text-emerald-600 font-medium">View All</Text>
                </TouchableOpacity>
              )}
            </View>

            {loadingAssignments ? (
              <View className="bg-white rounded-xl p-8 items-center">
                <ActivityIndicator size="large" color="#F97316" />
                <Text className="text-gray-600 mt-3">
                  Loading assignments...
                </Text>
              </View>
            ) : assignedHarvests.length === 0 ? (
              <View className="bg-white rounded-xl p-8 items-center border border-gray-200">
                <View className="w-16 h-16 bg-orange-50 rounded-full items-center justify-center mb-3">
                  <CheckCircle2 size={32} color="#F97316" />
                </View>
                <Text className="text-lg font-medium text-gray-900 mb-1">
                  No Assigned Harvests
                </Text>
                <Text className="text-gray-500 text-center">
                  You don't have any pending harvest assignments.
                </Text>
              </View>
            ) : (
              <View>
                <FlatList
                  data={assignedHarvests.slice(0, 5)}
                  renderItem={renderAssignedHarvestItem}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
                {assignedHarvests.length > 3 && (
                  <TouchableOpacity
                    className="mt-2 bg-orange-50 rounded-xl p-3 items-center"
                    onPress={() => router.push("/users/assigned")}
                  >
                    <Text className="text-orange-700 font-medium">
                      View {assignedHarvests.length - 3} More Assignments
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {/* QR Scan Section - Main Feature */}
        <View className="px-6 pt-2 pb-4">
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
