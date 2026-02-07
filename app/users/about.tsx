import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";

export default function About() {
  const [language, setLanguage] = useState("english");

  const content = {
    english: {
      title: "About Kalangka",
      description:
        "Kalangka is a smart farming platform designed specifically for jackfruit farmers in the Philippines. Our system helps you track each jackfruit tree individually using QR codes, monitor yields, and report losses to improve your harvest and reduce waste.",
      features: [
        "Track each tree with QR codes and GPS",
        "Log harvested weight per tree",
        "Report losses with specific reasons",
        "Works offline - syncs when online",
        "View analytics and generate reports",
      ],
      mission:
        "To help jackfruit farmers increase yield and reduce losses through technology.",
      team: "Developed by Group 6 - Students passionate about agricultural innovation.",
    },
    tagalog: {
      title: "Tungkol sa Kalangka",
      description:
        "Ang Kalangka ay isang smart farming platform na dinisenyo para sa mga magsasaka ng langka sa Pilipinas. Tinutulungan ka ng sistema na subaybayan ang bawat puno ng langka gamit ang QR codes, masubaybayan ang ani, at iulat ang mga pagkalugi para mapabuti ang iyong ani at mabawasan ang nasasayang.",
      features: [
        "Subaybayan ang bawat puno gamit ang QR codes at GPS",
        "Itala ang timbang ng ani bawat puno",
        "I-ulat ang mga pagkalugi kasama ang mga dahilan",
        "Gumagana kahit walang internet - nag-sync kapag online",
        "Tingnan ang analytics at gumawa ng mga report",
      ],
      mission:
        "Tulungan ang mga magsasaka ng langka na madagdagan ang ani at mabawasan ang pagkalugi sa pamamagitan ng teknolohiya.",
      team: "Binuo ng Group 6 - Mga mag-aaral na passionate tungkol sa agricultural innovation.",
    },
  };

  const current = content[language];

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Language Toggle */}
      <View className="flex-row justify-center my-5 bg-white mx-5 rounded-xl p-1">
        <TouchableOpacity
          className={`flex-1 py-3 items-center rounded-lg ${language === "english" ? "bg-green-600" : ""}`}
          onPress={() => setLanguage("english")}
        >
          <Text
            className={`text-base font-medium ${language === "english" ? "text-white font-bold" : "text-gray-600"}`}
          >
            English
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`flex-1 py-3 items-center rounded-lg ${language === "tagalog" ? "bg-green-600" : ""}`}
          onPress={() => setLanguage("tagalog")}
        >
          <Text
            className={`text-base font-medium ${language === "tagalog" ? "text-white font-bold" : "text-gray-600"}`}
          >
            Tagalog
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View className="bg-white mx-5 p-5 rounded-xl shadow-sm border border-gray-100">
        <Text className="text-2xl font-bold text-green-800 mb-4 text-center">
          {current.title}
        </Text>

        <Text className="text-base text-gray-800 leading-relaxed mb-6">
          {current.description}
        </Text>

        <Text className="text-lg font-bold text-green-600 mt-5 mb-3">
          {language === "english"
            ? "Main Features:"
            : "Mga Pangunahing Tampok:"}
        </Text>

        {current.features.map((feature, index) => (
          <View key={index} className="flex-row items-start mb-2">
            <Text className="text-green-600 text-base mr-2 mt-1">•</Text>
            <Text className="text-base text-gray-800 flex-1 leading-relaxed">
              {feature}
            </Text>
          </View>
        ))}

        <Text className="text-lg font-bold text-green-600 mt-6 mb-3">
          {language === "english" ? "Our Mission:" : "Ang Aming Misyon:"}
        </Text>
        <Text className="text-base text-gray-800 leading-relaxed mb-4">
          {current.mission}
        </Text>

        <Text className="text-lg font-bold text-green-600 mt-6 mb-3">
          {language === "english" ? "About the Team:" : "Tungkol sa Grupo:"}
        </Text>
        <Text className="text-base text-gray-800 leading-relaxed mb-4">
          {current.team}
        </Text>

        <View className="mt-6 p-4 bg-green-50 rounded-lg border-l-4 border-green-600">
          <Text className="text-base text-green-900 italic">
            {language === "english"
              ? "📍 Currently being piloted in Leyte, Philippines"
              : "📍 Kasalukuyang pilot testing sa Leyte, Pilipinas"}
          </Text>
        </View>
      </View>

      {/* Footer Note */}
      <View className="mx-5 mt-6 mb-8 p-4 bg-blue-50 rounded-lg border border-blue-100">
        <Text className="text-sm text-blue-800 text-center">
          {language === "english"
            ? "Kalangka v1.0 • January 2026 • For jackfruit farmers"
            : "Kalangka v1.0 • Enero 2026 • Para sa mga magsasaka ng langka"}
        </Text>
      </View>
    </ScrollView>
  );
}
