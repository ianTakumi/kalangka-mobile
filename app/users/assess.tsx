// app/assess.tsx
import NotificationService from "@/services/NotificationService";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SQLite from "expo-sqlite";
import { Calendar, Clock, Save } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const db = SQLite.openDatabaseSync("kalangka.db");

export default function AssessScreen() {
  const { fruitId, days } = useLocalSearchParams();
  const router = useRouter();
  const [extraDays, setExtraDays] = useState("");
  const [fruit, setFruit] = useState<any>(null);

  useEffect(() => {
    loadFruitDetails();
  }, []);

  const loadFruitDetails = async () => {
    const result = await db.getFirstAsync(
      `
      SELECT 
        f.*,
        t.description as tree_name,
        julianday('now') - julianday(f.bagged_at) as current_days
      FROM fruits f
      LEFT JOIN trees t ON f.tree_id = t.id
      WHERE f.id = ?
    `,
      [fruitId],
    );

    setFruit(result);
  };

  const handleSubmit = async () => {
    if (!extraDays || parseInt(extraDays) <= 0) {
      Alert.alert("Error", "Please enter valid number of days");
      return;
    }

    try {
      const result = await NotificationService.saveFarmerAssessment(
        fruitId as string,
        parseInt(extraDays),
      );

      Alert.alert(
        "✅ Success",
        `We'll check again on ${result.nextCheckDate}`,
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ],
      );
    } catch (error) {
      Alert.alert("Error", "Failed to save assessment");
    }
  };

  if (!fruit) return <Text>Loading...</Text>;

  const currentDays = Math.floor(fruit.current_days);

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="bg-white p-6">
        <Text className="text-2xl font-bold text-gray-800 mb-2">
          Fruit Assessment
        </Text>
        <Text className="text-gray-600">
          Tree: {fruit.tree_name || "Unknown"}
        </Text>
      </View>

      <View className="p-4">
        <View className="bg-white rounded-xl p-5 mb-4 shadow-sm">
          <Text className="text-gray-500 text-sm mb-4">FRUIT STATUS</Text>

          <View className="flex-row justify-between mb-3">
            <Text className="text-gray-600">Days since bagged:</Text>
            <Text className="font-bold text-orange-500">
              {currentDays} days
            </Text>
          </View>

          <View className="flex-row justify-between mb-3">
            <Text className="text-gray-600">Status:</Text>
            <View className="bg-yellow-100 px-3 py-1 rounded-full">
              <Text className="text-yellow-700 text-xs">
                {currentDays > 120 ? "Overdue" : "Pending"}
              </Text>
            </View>
          </View>

          <View className="bg-orange-50 p-4 rounded-xl mt-2">
            <Text className="text-orange-700 font-medium mb-1">
              ⏰ Time for Assessment
            </Text>
            <Text className="text-orange-600 text-sm">
              Your fruit is {currentDays} days old. When should we check again?
            </Text>
          </View>
        </View>

        <View className="bg-white rounded-xl p-5 mb-4 shadow-sm">
          <Text className="text-gray-700 font-medium mb-3">
            When to check again?
          </Text>

          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 mb-2"
            placeholder="Enter number of days"
            value={extraDays}
            onChangeText={setExtraDays}
            keyboardType="numeric"
          />

          <Text className="text-xs text-gray-500 mb-4">
            Example: 7 = we'll notify you again in 7 days
          </Text>

          <View className="bg-gray-50 p-3 rounded-lg mb-4">
            <View className="flex-row items-center mb-2">
              <Calendar size={16} color="#6B7280" />
              <Text className="text-sm text-gray-600 ml-2">
                Current: Day {currentDays}
              </Text>
            </View>
            {extraDays ? (
              <View className="flex-row items-center">
                <Clock size={16} color="#F97316" />
                <Text className="text-sm text-orange-600 ml-2">
                  Next check: Day {currentDays + parseInt(extraDays)}
                </Text>
              </View>
            ) : null}
          </View>

          <TouchableOpacity
            className="bg-orange-500 py-4 rounded-xl flex-row items-center justify-center"
            onPress={handleSubmit}
          >
            <Save size={20} color="white" />
            <Text className="text-white font-semibold ml-2">
              Save Assessment
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
