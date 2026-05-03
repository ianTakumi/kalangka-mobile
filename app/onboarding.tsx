import { updateOnboardingStatus } from "@/redux/slices/authSlice";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bug,
  Check,
  Leaf,
  MapPin,
  PackageX,
  QrCode,
  Trash2,
  Trees,
  TrendingUp,
  Truck,
  WifiOff,
} from "lucide-react-native";
import { useRef, useState } from "react";
import {
  Dimensions,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useDispatch } from "react-redux";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function OnboardingScreen() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const router = useRouter();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();

  const slides = [
    {
      title: "Welcome to WrapCrop",
      description: "Your Digital Farming Companion for Jackfruit Farm",
      icon: <Trees size={64} color="#059669" />,
      color: "bg-emerald-50",
      iconColor: "#059669",
      textColor: "text-emerald-700",
    },
    {
      title: "QR-per-Tree Tracking",
      description:
        "Scan unique QR codes to register and monitor individual jackfruit trees with GPS mapping",
      icon: <QrCode size={64} color="#2563EB" />,
      color: "bg-blue-50",
      iconColor: "#2563EB",
      textColor: "text-blue-700",
      features: [
        "QR Code per tree",
        "GPS location mapping",
        "Photo documentation",
      ],
    },
    {
      title: "Yield & Wastage Reporting",
      description:
        "Log harvested weight per tree and track losses with categorized reasons",
      icon: <BarChart3 size={64} color="#EA580C" />,
      color: "bg-orange-50",
      iconColor: "#EA580C",
      textColor: "text-orange-700",
      lossReasons: [
        "Pest & Disease",
        "Theft",
        "Quality Rejection",
        "Harvest Damage",
      ],
    },
    {
      title: "Work Offline, Sync Online",
      description:
        "Full functionality without internet. Data automatically syncs when connection is restored",
      icon: <WifiOff size={64} color="#9333EA" />,
      color: "bg-purple-50",
      iconColor: "#9333EA",
      textColor: "text-purple-700",
    },
    {
      title: "Real-Time Analytics",
      description:
        "Access dashboards with yield predictions, loss reports, and financial insights",
      icon: <TrendingUp size={64} color="#DC2626" />,
      color: "bg-red-50",
      iconColor: "#DC2626",
      textColor: "text-red-700",
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
    console.log("Onboarding completed!");
    dispatch(updateOnboardingStatus(true));
    router.push("/login");
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    scrollRef.current?.scrollTo({
      x: index * width,
      animated: true,
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View className="pt-6 px-6 items-center">
        <View className="flex-row items-center gap-2">
          <Leaf size={24} color="#059669" />
          <Text className="text-2xl font-bold text-emerald-700">IMYV</Text>
        </View>
        <Text className="text-sm text-gray-500 mt-1">
          Farm Management Solution for Jackfruit Farm
        </Text>
      </View>

      {/* Progress Dots */}
      <View className="flex-row justify-center mt-8">
        {slides.map((_, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => goToSlide(index)}
            className={`mx-1.5 rounded-full ${
              currentSlide === index
                ? "bg-emerald-600 w-6"
                : "bg-gray-300 w-2.5"
            } h-2.5`}
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
        className="flex-1 mt-6"
      >
        {slides.map((slide, index) => (
          <View key={index} style={{ width }} className="px-6 items-center">
            {/* Icon Circle */}
            <View
              className={`w-56 h-56 rounded-full ${slide.color} justify-center items-center mb-8 shadow-sm`}
            >
              {slide.icon}
            </View>

            {/* Title */}
            <Text
              className={`text-3xl font-bold text-center text-gray-800 mb-3 ${slide.textColor}`}
            >
              {slide.title}
            </Text>

            {/* Description */}
            <Text className="text-base text-gray-500 text-center px-6 leading-relaxed">
              {slide.description}
            </Text>

            {/* Feature Highlights */}
            {slide.features && (
              <View className="mt-8 bg-white p-5 rounded-xl w-full max-w-sm border border-gray-100 shadow-sm">
                <Text className="text-gray-700 font-semibold mb-3">
                  Key Features:
                </Text>
                {slide.features.map((feature, idx) => (
                  <View key={idx} className="flex-row items-center gap-2 mt-2">
                    <Check size={16} color="#059669" />
                    <Text className="text-gray-600 text-sm">{feature}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Loss Reasons */}
            {slide.lossReasons && (
              <View className="mt-8 bg-white p-5 rounded-xl w-full max-w-sm border border-gray-100 shadow-sm">
                <Text className="text-gray-700 font-semibold mb-3">
                  Track Loss Reasons:
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {slide.lossReasons.map((reason, idx) => {
                    const reasonIcons = {
                      "Pest & Disease": <Bug size={14} color="#DC2626" />,
                      Theft: <PackageX size={14} color="#DC2626" />,
                      "Quality Rejection": <Truck size={14} color="#DC2626" />,
                      "Harvest Damage": <Trash2 size={14} color="#DC2626" />,
                    };
                    return (
                      <View
                        key={idx}
                        className="flex-row items-center gap-1 bg-gray-50 px-3 py-2 rounded-lg"
                      >
                        {reasonIcons[reason as keyof typeof reasonIcons]}
                        <Text className="text-gray-600 text-xs">{reason}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Ready to Start Section */}
            {index === slides.length - 1 && (
              <View className="mt-8 bg-emerald-50 p-6 rounded-xl w-full max-w-sm border border-emerald-100">
                <Text className="text-emerald-800 font-bold text-lg mb-2 text-center">
                  Ready to Start?
                </Text>
                <Text className="text-gray-600 text-center text-sm mb-5">
                  Begin tracking your jackfruit trees and optimize your harvest!
                </Text>
                <View className="flex-row flex-wrap justify-center gap-2">
                  <View className="bg-white px-3 py-2 rounded-lg flex-row items-center gap-1">
                    <QrCode size={12} color="#059669" />
                    <Text className="text-emerald-700 text-xs">
                      QR Scanning
                    </Text>
                  </View>
                  <View className="bg-white px-3 py-2 rounded-lg flex-row items-center gap-1">
                    <MapPin size={12} color="#059669" />
                    <Text className="text-emerald-700 text-xs">
                      GPS Mapping
                    </Text>
                  </View>
                  <View className="bg-white px-3 py-2 rounded-lg flex-row items-center gap-1">
                    <WifiOff size={12} color="#059669" />
                    <Text className="text-emerald-700 text-xs">
                      Offline Mode
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Navigation Buttons */}
      <View
        className="flex-row justify-between items-center px-6 py-4 bg-white border-t border-gray-100"
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        {/* Back Button */}
        <TouchableOpacity
          onPress={prevSlide}
          className={`px-5 py-3 rounded-xl flex-row items-center gap-2 ${
            currentSlide === 0 ? "opacity-0" : "bg-gray-100"
          }`}
          disabled={currentSlide === 0}
        >
          <ArrowLeft size={18} color="#6B7280" />
          <Text className="text-gray-600 font-medium">Back</Text>
        </TouchableOpacity>

        {/* Skip Button */}
        {currentSlide < slides.length - 1 && (
          <TouchableOpacity onPress={skipToEnd} className="px-4 py-3">
            <Text className="text-gray-400 font-medium">Skip</Text>
          </TouchableOpacity>
        )}

        {/* Next/Get Started Button */}
        <TouchableOpacity
          onPress={nextSlide}
          className={`px-6 py-3 rounded-xl flex-row items-center gap-2 ${
            currentSlide === slides.length - 1
              ? "bg-emerald-600"
              : "bg-emerald-700"
          } shadow-sm`}
        >
          <Text className="text-white font-medium">
            {currentSlide === slides.length - 1 ? "Get Started" : "Next"}
          </Text>
          {currentSlide < slides.length - 1 ? (
            <ArrowRight size={18} color="#FFFFFF" />
          ) : null}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
