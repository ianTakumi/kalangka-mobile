import { useEffect, useState, useRef } from "react";
import { View, Text, Animated } from "react-native";
import { useSelector } from "react-redux";
import { RootState } from "../redux/store";
import { Redirect } from "expo-router";
import { Leaf, Loader2 } from "lucide-react-native";

export default function Index() {
  const [isChecking, setIsChecking] = useState(true);
  const spinValue = useRef(new Animated.Value(0)).current;
  const user = useSelector((state: RootState) => state.auth.user);
  const isOnboardingCompleted = useSelector(
    (state: RootState) => state.auth?.isOnboardingCompleted,
  );
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth?.isAuthenticated,
  );

  // Animate spinner
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    ).start();
  }, []);

  // Simulate checking process
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsChecking(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // Loading screen
  if (isChecking) {
    return (
      <View className="flex-1 justify-center items-center bg-gradient-to-b from-emerald-50 to-white px-6">
        {/* Logo/Icon Section */}
        <View className="items-center mb-12">
          <View className="bg-emerald-100 p-6 rounded-2xl mb-6">
            <Leaf size={64} color="#059669" />
          </View>
          <Text className="text-4xl font-bold text-emerald-900">Kalangka</Text>
          <Text className="text-emerald-600 text-lg mt-2">
            Smart Jackfruit Farming
          </Text>
        </View>

        {/* Spinner Section */}
        <View className="items-center mb-10">
          <Animated.View
            style={{ transform: [{ rotate: spin }] }}
            className="mb-6"
          >
            <Loader2 size={40} color="#059669" />
          </Animated.View>

          <View className="items-center">
            <Text className="text-emerald-800 font-semibold text-xl mb-2">
              Loading Application
            </Text>
            <Text className="text-gray-500 text-center max-w-xs">
              Preparing the application...
            </Text>
          </View>
        </View>

        {/* Loading Dots Animation */}
        <View className="flex-row space-x-2 mt-8">
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              className="w-2 h-2 bg-emerald-400 rounded-full"
              style={{
                opacity:
                  0.3 + Math.abs(Math.sin(Date.now() / 500 + i * 0.5)) * 0.7,
              }}
            />
          ))}
        </View>
      </View>
    );
  }

  // Guard logic after loading
  if (!isOnboardingCompleted) {
    return <Redirect href="/onboarding" />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  // All checks passed
  if (user?.role === "admin") {
    return <Redirect href="/admin/" />;
  } else {
    return <Redirect href="/users/" />;
  }
}
