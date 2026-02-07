import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";

export default function _layout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { display: "none" },
        tabBarActiveTintColor: "#4CAF50",
        tabBarInactiveTintColor: "#9CA3AF",
        // tabBarStyle: {
        //   height: 60,
        //   borderTopWidth: 0.3,
        //   borderTopColor: "#E5E7EB",
        //   backgroundColor: "#fff",
        //   paddingBottom: 5,
        // },
        tabBarIcon: ({ color, size }) => {
          switch (route.name) {
            case "index":
              return <Ionicons name="home-outline" size={22} color={color} />;

            default:
              return null;
          }
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
    </Tabs>
  );
}
