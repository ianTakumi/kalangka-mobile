import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
export default function _layout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#4CAF50",
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarStyle: {
          display: "none",
          // height: 60,
          // borderTopWidth: 0.3,
          // borderTopColor: "#E5E7EB",
          // backgroundColor: "#fff",
          // paddingBottom: 5,
        },
        tabBarIcon: ({ color, size }) => {
          switch (route.name) {
            case "index":
              return <FontAwesome5 name="home" size={22} color={color} />;

            case "trees":
              return <FontAwesome5 name="tree" size={22} color={color} />;

            case "flowers":
              return <Ionicons name="flower" size={22} color={color} />;

            case "harvest":
              return <FontAwesome5 name="seedling" size={22} color={color} />;

            case "fruits":
              return (
                <MaterialCommunityIcons
                  name="fruit-pear"
                  size={22}
                  color={color}
                />
              );

            default:
              return null;
          }
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="trees" options={{ title: "Trees" }} />
      <Tabs.Screen name="flowers" options={{ title: "Flowers" }} />
      <Tabs.Screen name="fruits" options={{ title: "Fruits" }} />
      <Tabs.Screen name="harvest" options={{ title: "Harvest" }} />

      {/* <Tabs.Screen name="profile" options={{ title: "Profile" }} /> */}
    </Tabs>
  );
}
