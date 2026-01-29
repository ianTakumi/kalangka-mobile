import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { useRef, useState } from "react";
import { useRouter } from "expo-router"; // or your navigation library
import { useDispatch } from "react-redux";
import { updateOnboardingStatus } from "@/redux/slices/authSlice";

export default function OnboardingScreen() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollRef = useRef(null);
  const { width } = useWindowDimensions();
  const router = useRouter(); // Initialize router
  const dispatch = useDispatch(); // Initialize dispatch

  const slides = [
    {
      title: "Welcome to Kalangka",
      description: "Your Smart Farming Companion for Jackfruit Plantations",
      icon: "🌳",
      color: "bg-green-700",
      textColor: "text-green-700",
    },
    {
      title: "QR-per-Tree Tracking",
      description:
        "Scan unique QR codes to register and monitor individual jackfruit trees with GPS mapping",
      icon: "📱",
      color: "bg-blue-600",
      textColor: "text-blue-600",
    },
    {
      title: "Yield & Wastage Reporting",
      description:
        "Log harvested weight per tree and track losses with categorized reasons (pest, theft, quality)",
      icon: "📊",
      color: "bg-orange-600",
      textColor: "text-orange-600",
    },
    {
      title: "Work Offline, Sync Online",
      description:
        "Full functionality without internet. Data automatically syncs when connection is restored",
      icon: "🌐",
      color: "bg-purple-600",
      textColor: "text-purple-600",
    },
    {
      title: "Real-Time Analytics",
      description:
        "Access dashboards with yield predictions, loss reports, and financial insights",
      icon: "📈",
      color: "bg-red-600",
      textColor: "text-red-600",
    },
  ];

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      const nextIndex = currentSlide + 1;
      setCurrentSlide(nextIndex);
      scrollRef.current?.scrollTo({
        x: nextIndex * width,
        animated: true,
      });
    } else {
      // Handle "Get Started" - Navigate to main app
      handleGetStarted();
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      const prevIndex = currentSlide - 1;
      setCurrentSlide(prevIndex);
      scrollRef.current?.scrollTo({
        x: prevIndex * width,
        animated: true,
      });
    }
  };

  const skipToEnd = () => {
    const lastIndex = slides.length - 1;
    setCurrentSlide(lastIndex);
    scrollRef.current?.scrollTo({
      x: lastIndex * width,
      animated: true,
    });
  };

  const handleGetStarted = () => {
    // Handle what happens when onboarding is complete
    console.log("Onboarding completed!");

    // Dispatch action to update onboarding status in Redux store
    dispatch(updateOnboardingStatus(true));
    router.push("/login");
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="pt-16 px-6 items-center">
        <Text className="text-2xl font-bold text-green-700">Kalangka</Text>
        <Text className="text-sm text-gray-600 mt-2">
          Smart Farming Platform
        </Text>
      </View>

      {/* Progress Dots */}
      <View className="flex-row justify-center mt-8">
        {slides.map((_, index) => (
          <View
            key={index}
            className={`w-3 h-3 rounded-full mx-1 ${
              currentSlide === index ? "bg-green-600" : "bg-gray-300"
            }`}
          />
        ))}
      </View>

      {/* Scrollable Content */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(event) => {
          const scrollX = event.nativeEvent.contentOffset.x;
          const index = Math.round(scrollX / width);
          setCurrentSlide(index);
        }}
        className="flex-1 mt-10"
      >
        {slides.map((slide, index) => (
          <View
            key={index}
            style={{ width }}
            className="px-8 items-center justify-center"
          >
            {/* Icon Circle */}
            <View
              className={`w-60 h-60 rounded-full ${slide.color} bg-opacity-20 justify-center items-center mb-10`}
            >
              <Text className="text-7xl">{slide.icon}</Text>
            </View>

            {/* Title */}
            <Text
              className={`text-3xl font-bold text-center text-gray-800 mb-4 ${slide.textColor}`}
            >
              {slide.title}
            </Text>

            {/* Description */}
            <Text className="text-lg text-gray-600 text-center px-4 leading-relaxed">
              {slide.description}
            </Text>

            {/* Feature Highlights (for specific slides) */}
            {index === 1 && (
              <View className="mt-8 bg-blue-50 p-4 rounded-lg w-full max-w-xs">
                <Text className="text-blue-800 font-semibold mb-2">
                  Key Features:
                </Text>
                <Text className="text-gray-700">
                  • QR Code per tree identification
                </Text>
                <Text className="text-gray-700">
                  • GPS mapping for tree location
                </Text>
                <Text className="text-gray-700">
                  • Photo documentation per tree
                </Text>
              </View>
            )}

            {index === 2 && (
              <View className="mt-8 bg-orange-50 p-4 rounded-lg w-full max-w-xs">
                <Text className="text-orange-800 font-semibold mb-2">
                  Track Loss Reasons:
                </Text>
                <Text className="text-gray-700">
                  • Pest/Disease • Theft • Quality Rejection
                </Text>
                <Text className="text-gray-700">
                  • Harvest Damage • Natural Wastage
                </Text>
              </View>
            )}

            {/* Show additional content on last slide */}
            {index === slides.length - 1 && (
              <View className="mt-8 bg-green-50 p-6 rounded-xl w-full max-w-xs border border-green-200">
                <Text className="text-green-800 font-bold text-lg mb-3 text-center">
                  Ready to Start?
                </Text>
                <Text className="text-gray-700 text-center mb-4">
                  Begin tracking your jackfruit trees and optimize your harvest!
                </Text>
                <View className="flex-row flex-wrap justify-center gap-2">
                  <View className="bg-white px-3 py-2 rounded-lg">
                    <Text className="text-green-700 text-sm">
                      ✓ QR Scanning
                    </Text>
                  </View>
                  <View className="bg-white px-3 py-2 rounded-lg">
                    <Text className="text-green-700 text-sm">
                      ✓ GPS Mapping
                    </Text>
                  </View>
                  <View className="bg-white px-3 py-2 rounded-lg">
                    <Text className="text-green-700 text-sm">
                      ✓ Offline Mode
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Navigation Buttons */}
      <View className="flex-row justify-between items-center px-6 pb-10 pt-6">
        {/* Back Button */}
        <TouchableOpacity
          onPress={prevSlide}
          className={`px-6 py-3 rounded-lg ${currentSlide === 0 ? "opacity-0" : "bg-gray-200"}`}
          disabled={currentSlide === 0}
        >
          <Text className="text-gray-700 font-medium">Back</Text>
        </TouchableOpacity>

        {/* Skip Button - Hide on last slide */}
        {currentSlide < slides.length - 1 && (
          <TouchableOpacity onPress={skipToEnd}>
            <Text className="text-gray-500 font-medium">Skip</Text>
          </TouchableOpacity>
        )}

        {/* Next/Get Started Button */}
        <TouchableOpacity
          onPress={nextSlide}
          className={`px-8 py-3 rounded-lg ${currentSlide === slides.length - 1 ? "bg-green-600" : "bg-green-700"}`}
        >
          <Text className="text-white font-medium">
            {currentSlide === slides.length - 1 ? "Get Started" : "Next"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Offline Badge */}
      <View className="absolute bottom-24 right-6 bg-gray-800 px-3 py-1 rounded-full">
        <Text className="text-white text-xs font-medium">✓ Works Offline</Text>
      </View>
    </View>
  );
}
