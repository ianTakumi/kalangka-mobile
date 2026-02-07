import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from "react-native";
import {
  Cloud,
  CloudOff,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Thermometer,
  Droplets,
  Wind,
  CloudRain,
  Sun,
  Cloudy,
  CloudSun,
  Umbrella,
} from "lucide-react-native";
import * as Location from "expo-location";
import axios from "axios";

export default function Fruits() {
  const [weather, setWeather] = useState({
    condition: "Loading...",
    temperature: "--°C",
    humidity: "--%",
    feelsLike: "--°C",
    windSpeed: "-- km/h",
    rainfall: "0 mm",
    forecast: "Fetching weather data...",
    loading: true,
    error: null,
  });

  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [location, setLocation] = useState(null);

  useEffect(() => {
    fetchLocationAndWeather();
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

      setWeather({
        condition: condition,
        temperature: `${Math.round(data.current.temperature_2m)}°C`,
        humidity: `${data.current.relative_humidity_2m}%`,
        feelsLike: `${Math.round(data.current.apparent_temperature)}°C`,
        windSpeed: `${(data.current.wind_speed_10m * 3.6).toFixed(1)} km/h`,
        rainfall: `${rainfall.toFixed(1)} mm`,
        forecast: "Real-time weather (Open-Meteo)",
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
        loading: false,
        error: error.message,
      });
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLocationAndWeather();
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
    } else {
      return <Cloud size={32} color="#6B7280" />;
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={["#059669"]}
          tintColor="#059669"
        />
      }
    >
      <View className="p-6">
        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-2xl font-bold text-gray-900">Weather Data</Text>
          <TouchableOpacity
            onPress={fetchLocationAndWeather}
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

        <View className="bg-white rounded-2xl p-5 border border-gray-200">
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
              <View className="flex-row justify-between items-center mb-6">
                <View className="flex-row items-center">
                  <View className="mr-4">
                    {getWeatherIcon(weather.condition)}
                  </View>
                  <View>
                    <Text className="text-4xl font-bold text-gray-900">
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
              <View className="flex-row justify-between bg-gray-50 rounded-xl p-4">
                <View className="items-center">
                  <Thermometer size={20} color="#DC2626" />
                  <Text className="text-sm text-gray-600 mt-1">Feels Like</Text>
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

              {/* Location Info */}
              {location && (
                <View className="mt-6 bg-emerald-50 rounded-xl p-4">
                  <View className="flex-row items-center mb-2">
                    <AlertCircle size={20} color="#059669" />
                    <Text className="ml-2 font-medium text-gray-900">
                      Location
                    </Text>
                  </View>
                  <Text className="text-gray-600">
                    Latitude: {location.coords.latitude.toFixed(4)}
                  </Text>
                  <Text className="text-gray-600">
                    Longitude: {location.coords.longitude.toFixed(4)}
                  </Text>
                </View>
              )}
            </>
          )}

          <Text className="text-sm text-gray-500 text-center mt-4">
            {weather.forecast}
          </Text>
        </View>

        {/* Simple Fruits Info */}
        <View className="mt-6 bg-white rounded-2xl p-5 border border-gray-200">
          <Text className="text-xl font-bold text-gray-900 mb-4">
            Fruits Information
          </Text>
          <Text className="text-gray-600">
            This screen demonstrates weather data fetching. The weather
            information can be useful for:
          </Text>
          <View className="mt-3">
            <Text className="text-gray-600">• Planning harvest schedules</Text>
            <Text className="text-gray-600">• Irrigation management</Text>
            <Text className="text-gray-600">• Pest control timing</Text>
            <Text className="text-gray-600">
              • Protecting crops from extreme weather
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
