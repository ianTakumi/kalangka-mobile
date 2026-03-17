import FruitService from "@/services/FruitService";
import HarvestService from "@/services/HarvestService";
import NetInfo from "@react-native-community/netinfo";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertCircle,
  ArrowLeft,
  Package,
  Plus,
  Scale,
  Trash2,
  User,
  Wifi,
  WifiOff,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

export default function HarvestScreen() {
  const router = useRouter();
  const { fruitData, harvestId } = useLocalSearchParams();

  const [fruit, setFruit] = useState<any>(null);
  const [harvestRecord, setHarvestRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  // Form states
  const [ripeFruits, setRipeFruits] = useState<string[]>([]);
  const [wasteItems, setWasteItems] = useState<
    { quantity: string; reason: string }[]
  >([]);

  // For tracking existing data
  const [existingFruitWeights, setExistingFruitWeights] = useState<any[]>([]);
  const [existingWastes, setExistingWastes] = useState<any[]>([]);

  // Backlog states
  const [showBacklogModal, setShowBacklogModal] = useState(false);
  const [backlogDays, setBacklogDays] = useState("");
  const [backlogReason, setBacklogReason] = useState("");
  const [remainingAfterHarvest, setRemainingAfterHarvest] = useState(0);
  const [hasBacklog, setHasBacklog] = useState(false);

  // Modal states
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [editingWasteIndex, setEditingWasteIndex] = useState<number | null>(
    null,
  );
  const [wasteQuantity, setWasteQuantity] = useState("");
  const [wasteReason, setWasteReason] = useState("");

  // Initialize service and check network
  useEffect(() => {
    const init = async () => {
      await HarvestService.init();

      const netInfo = await NetInfo.fetch();
      setIsOnline(netInfo.isConnected ?? false);

      const unsubscribe = NetInfo.addEventListener((state) => {
        setIsOnline(state.isConnected ?? false);
      });

      return () => unsubscribe();
    };

    init();
  }, []);

  useEffect(() => {
    if (fruitData) {
      try {
        const parsedFruit = JSON.parse(fruitData as string);
        setFruit(parsedFruit);

        // Check if this fruit has backlog
        if (
          parsedFruit.remaining_quantity &&
          parsedFruit.remaining_quantity > 0
        ) {
          setHasBacklog(true);
        }

        checkExistingHarvest(parsedFruit.id);
      } catch (error) {
        console.error("Error parsing fruitData:", error);
        setLoading(false);
      }
    } else if (harvestId) {
      fetchHarvestById(harvestId as string);
    }
  }, [fruitData, harvestId]);

  const fetchHarvestById = async (id: string) => {
    try {
      setLoading(true);
      const harvest = await HarvestService.getAssignedHarvestById(id);

      if (harvest) {
        setHarvestRecord(harvest);
        setFruit(harvest.fruit);

        if (
          harvest.fruit?.remaining_quantity &&
          harvest.fruit.remaining_quantity > 0
        ) {
          setHasBacklog(true);
        }

        await loadExistingHarvestData(harvest.id);
      }
    } catch (error) {
      console.error("Error fetching harvest:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkExistingHarvest = async (fruitId: string) => {
    try {
      const harvestDetails =
        await HarvestService.getHarvestDetailsByFruitId(fruitId);

      if (harvestDetails.harvest) {
        setHarvestRecord(harvestDetails);
        await loadExistingHarvestData(harvestDetails.harvest.id);
      } else {
        // No existing harvest, create one?
        console.log("No existing harvest found for this fruit");
      }
    } catch (error) {
      console.error("Error checking existing harvest:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingHarvestData = async (harvestId: string) => {
    try {
      const fruitWeights =
        await HarvestService.getFruitWeightsByHarvestId(harvestId);
      setExistingFruitWeights(fruitWeights);

      if (fruitWeights.length > 0) {
        setRipeFruits(fruitWeights.map((fw: any) => fw.weight.toString()));
      }

      const wastes = await HarvestService.getWastesByHarvestId(harvestId);
      setExistingWastes(wastes);

      if (wastes.length > 0) {
        setWasteItems(
          wastes.map((w: any) => ({
            quantity: w.waste_quantity.toString(),
            reason: w.reason,
          })),
        );
      }
    } catch (error) {
      console.error("Error loading existing harvest data:", error);
    }
  };

  const syncUnsyncedHarvests = async () => {
    try {
      const unsyncedHarvests = await HarvestService.getAllUnsyncedHarvests();

      if (unsyncedHarvests.length === 0) {
        return { synced: 0, failed: 0 };
      }

      let syncedCount = 0;
      let failedCount = 0;

      for (const harvestData of unsyncedHarvests) {
        try {
          const success = await HarvestService.syncCompleteHarvest(
            harvestData.harvest.id,
          );
          if (success) {
            syncedCount++;
          } else {
            failedCount++;
          }
        } catch (error) {
          failedCount++;
        }
      }

      return { synced: syncedCount, failed: failedCount };
    } catch (error) {
      return { synced: 0, failed: 0 };
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      const netInfo = await NetInfo.fetch();
      setIsOnline(netInfo.isConnected ?? false);

      if (netInfo.isConnected) {
        await syncUnsyncedHarvests();
      }

      if (harvestRecord?.harvest?.id) {
        const harvestDetails = await HarvestService.getHarvestDetailsByFruitId(
          fruit.id,
        );

        if (harvestDetails.harvest) {
          setHarvestRecord(harvestDetails);
          await loadExistingHarvestData(harvestDetails.harvest.id);
        }
      }
    } catch (error) {
      console.error("Error refreshing harvest:", error);
    } finally {
      setRefreshing(false);
    }
  }, [fruit?.id, harvestRecord]);

  const getHarvestStatus = () => {
    const baggedDate = new Date(fruit?.bagged_at);
    const harvestDate = new Date(baggedDate);
    harvestDate.setDate(harvestDate.getDate() + 115);
    const today = new Date();
    const daysLeft = Math.ceil(
      (harvestDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      isReady: today >= harvestDate,
      daysLeft: daysLeft > 0 ? daysLeft : 0,
      harvestDate: harvestDate.toLocaleDateString(),
    };
  };

  const handleAddRipeFruit = () => {
    setRipeFruits([...ripeFruits, ""]);
  };

  const handleRipeWeightChange = (index: number, value: string) => {
    if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
      const newRipeFruits = [...ripeFruits];
      newRipeFruits[index] = value;
      setRipeFruits(newRipeFruits);
    }
  };

  const handleRemoveRipeFruit = (index: number) => {
    Alert.alert("Remove Fruit", "Remove this ripe fruit?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          const newRipeFruits = ripeFruits.filter((_, i) => i !== index);
          setRipeFruits(newRipeFruits);
        },
      },
    ]);
  };

  const handleAddWaste = () => {
    setEditingWasteIndex(null);
    setWasteQuantity("");
    setWasteReason("");
    setShowWasteModal(true);
  };

  const handleEditWaste = (index: number) => {
    setEditingWasteIndex(index);
    setWasteQuantity(wasteItems[index].quantity);
    setWasteReason(wasteItems[index].reason);
    setShowWasteModal(true);
  };

  const handleSaveWaste = () => {
    if (!wasteQuantity || parseInt(wasteQuantity) <= 0) {
      Toast.show({
        type: "error",
        text1: "Invalid",
        text2: "Please enter valid waste quantity",
      });
      return;
    }

    if (!wasteReason.trim()) {
      Toast.show({
        type: "error",
        text1: "Invalid",
        text2: "Please enter reason for waste",
      });
      return;
    }

    const totalWaste = wasteItems.reduce(
      (sum, item) => sum + parseInt(item.quantity || "0"),
      0,
    );

    const availableQuantity = getAvailableQuantity();
    const newTotalWaste =
      totalWaste -
      (editingWasteIndex !== null
        ? parseInt(wasteItems[editingWasteIndex]?.quantity || "0")
        : 0) +
      parseInt(wasteQuantity);

    if (ripeFruits.length + newTotalWaste > availableQuantity) {
      Toast.show({
        type: "error",
        text1: "Exceeds Limit",
        text2: `Total (${ripeFruits.length} ripe + ${newTotalWaste} waste) exceeds ${availableQuantity} fruits`,
      });
      return;
    }

    if (editingWasteIndex !== null) {
      const newWasteItems = [...wasteItems];
      newWasteItems[editingWasteIndex] = {
        quantity: wasteQuantity,
        reason: wasteReason,
      };
      setWasteItems(newWasteItems);
    } else {
      setWasteItems([
        ...wasteItems,
        { quantity: wasteQuantity, reason: wasteReason },
      ]);
    }

    setShowWasteModal(false);
  };

  const handleRemoveWaste = (index: number) => {
    Alert.alert("Remove Waste", "Remove this waste entry?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          const newWasteItems = wasteItems.filter((_, i) => i !== index);
          setWasteItems(newWasteItems);
        },
      },
    ]);
  };

  const getAvailableQuantity = () => {
    if (hasBacklog && fruit?.remaining_quantity) {
      return fruit.remaining_quantity;
    }
    return fruit?.quantity || 0;
  };

  const updateFruitRemainingQuantity = async (
    fruitId: string,
    remaining: number,
  ) => {
    try {
      const currentFruit = await FruitService.getFruit(fruitId);

      if (currentFruit) {
        await FruitService.updateFruit(fruitId, {
          remaining_quantity: remaining,
        });
        console.log(
          `Updated fruit ${fruitId} remaining quantity to ${remaining}`,
        );
      }
    } catch (error) {
      console.error("Error updating fruit remaining quantity:", error);
    }
  };

  const handleSubmitHarvest = async () => {
    if (!fruit) return;

    if (ripeFruits.length === 0 && wasteItems.length === 0) {
      Toast.show({
        type: "error",
        text1: "Invalid",
        text2: "Please add at least one fruit",
      });
      return;
    }

    // Validate weights
    for (let i = 0; i < ripeFruits.length; i++) {
      if (!ripeFruits[i] || parseFloat(ripeFruits[i]) <= 0) {
        Toast.show({
          type: "error",
          text1: "Invalid",
          text2: `Please enter weight for ripe fruit #${i + 1}`,
        });
        return;
      }
    }

    try {
      setSubmitting(true);

      // Kunin lahat ng weights at wastes (kung ano nasa UI, yun lang)
      const allWeights = ripeFruits.map((w) => parseFloat(w));
      const allWastes = wasteItems.map((item) => ({
        quantity: parseInt(item.quantity),
        reason: item.reason,
      }));

      const totalProcessed =
        allWeights.length + allWastes.reduce((sum, w) => sum + w.quantity, 0);

      const availableQuantity = getAvailableQuantity();
      const remaining = availableQuantity - totalProcessed;
      setRemainingAfterHarvest(remaining);

      if (harvestRecord?.harvest) {
        // I-pasa lahat ng nasa UI (i-replace ang old data)
        const result = await HarvestService.updateHarvest(
          harvestRecord.harvest.id,
          allWeights.length, // Total ripe fruits
          allWeights, // Lahat ng weights
          allWastes, // Lahat ng wastes
        );

        // Show different messages based on status
        let statusMessage = "";
        switch (result.harvest.status) {
          case "partial":
            statusMessage = `${remaining} fruit(s) remaining`;
            break;
          case "harvested":
            statusMessage = "All fruits harvested!";
            break;
          case "wasted":
            statusMessage = "All fruits marked as waste";
            break;
        }

        Toast.show({
          type: "success",
          text1: "Success",
          text2: `Harvest updated - ${statusMessage}${!result.synced ? " (offline mode)" : ""}`,
        });
      }

      // Update fruit's remaining quantity
      await updateFruitRemainingQuantity(fruit.id, remaining);

      // If there are remaining fruits, show backlog modal
      if (remaining > 0) {
        setShowBacklogModal(true);
      } else {
        setTimeout(() => {
          router.back();
        }, 1500);
      }
    } catch (error: any) {
      console.error("Error saving harvest:", error);
      Toast.show({
        type: "error",
        text1: "Failed",
        text2: error.response?.data?.message || "Could not save harvest",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBacklogSubmit = async () => {
    if (!backlogDays || parseInt(backlogDays) <= 0) {
      Toast.show({
        type: "error",
        text1: "Invalid",
        text2: "Please enter valid number of days",
      });
      return;
    }

    try {
      // Update fruit with next check date
      await FruitService.updateFruit(fruit.id, {
        farmer_extra_days: parseInt(backlogDays),
        farmer_notes: backlogReason,
        next_check_date: new Date(
          Date.now() + parseInt(backlogDays) * 24 * 60 * 60 * 1000,
        ).toISOString(),
      });

      Toast.show({
        type: "success",
        text1: "Reminder Set",
        text2: `We'll remind you in ${backlogDays} days to check remaining fruits`,
      });

      setShowBacklogModal(false);
      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (error) {
      console.error("Error setting backlog reminder:", error);
      Toast.show({
        type: "error",
        text1: "Failed",
        text2: "Could not set reminder",
      });
    }
  };

  const totalRipe = ripeFruits.length;
  const totalWaste = wasteItems.reduce(
    (sum, item) => sum + parseInt(item.quantity || "0"),
    0,
  );
  const totalNow = totalRipe + totalWaste;
  const availableQuantity = getAvailableQuantity();
  const remaining = availableQuantity - totalNow;
  const harvestStatus = fruit
    ? getHarvestStatus()
    : { isReady: false, daysLeft: 0, harvestDate: "" };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#059669" />
        <Text className="mt-4 text-gray-600">Loading harvest data...</Text>
      </View>
    );
  }

  if (!fruit) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50 p-4">
        <AlertCircle size={48} color="#ef4444" />
        <Text className="text-red-500 text-lg mt-2">No fruit data found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 bg-green-600 px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white pt-12 pb-4 px-4 shadow-sm border-b border-gray-200">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="mr-3 p-2"
            >
              <ArrowLeft size={24} color="#4b5563" />
            </TouchableOpacity>
            <View>
              <Text className="text-2xl font-bold text-gray-800">
                {harvestRecord ? "Update Harvest" : "New Harvest"}
              </Text>
              <Text className="text-gray-500 text-sm">
                {harvestRecord ? "Edit harvest record" : "Record fruit harvest"}
              </Text>
            </View>
          </View>

          {/* Online/Offline Status */}
          <View className="flex-row items-center bg-gray-100 px-3 py-1 rounded-full">
            {isOnline ? (
              <>
                <Wifi size={16} color="#059669" />
                <Text className="text-green-600 text-xs ml-1">Online</Text>
              </>
            ) : (
              <>
                <WifiOff size={16} color="#6b7280" />
                <Text className="text-gray-500 text-xs ml-1">Offline</Text>
              </>
            )}
          </View>
        </View>

        {/* Assignment Info - if exists */}
        {harvestRecord?.harvest?.user_id && (
          <View className="mt-3 bg-blue-50 p-3 rounded-xl">
            <View className="flex-row items-center">
              <User size={16} color="#3b82f6" />
              <Text className="text-blue-700 text-sm ml-2 font-medium">
                Assigned Harvest
              </Text>
            </View>
            <Text className="text-gray-600 text-xs mt-1">
              You are harvesting this fruit
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        className="flex-1 p-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#059669"]}
            tintColor="#059669"
          />
        }
      >
        {/* Fruit Info Card */}
        <View className="bg-white rounded-xl p-5 mb-4 shadow-sm border border-gray-100">
          <Text className="text-gray-500 text-sm mb-3">FRUIT DETAILS</Text>

          <View className="flex-row items-center mb-3">
            <View className="bg-green-100 p-3 rounded-full">
              <Package size={24} color="#059669" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-gray-800 font-semibold text-lg">
                {fruit.quantity} Fruit{fruit.quantity !== 1 ? "s" : ""}
              </Text>
              <Text className="text-gray-500 text-xs">
                Bagged: {new Date(fruit.bagged_at).toLocaleDateString()}
              </Text>
            </View>
          </View>

          <View className="bg-gray-50 p-4 rounded-xl mt-2">
            <View className="flex-row justify-between mb-2">
              <Text className="text-gray-600">Fruit ID:</Text>
              <Text className="text-gray-800 font-mono text-xs">
                {fruit.id.substring(0, 8)}...
              </Text>
            </View>

            {fruit.tree && (
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-600">Tree:</Text>
                <Text className="text-gray-800">
                  {fruit.tree.description ||
                    `Tree #${fruit.tree_id.substring(0, 6)}`}
                </Text>
              </View>
            )}

            <View className="flex-row justify-between">
              <Text className="text-gray-600">Status:</Text>
              <View
                className={`px-2 py-0.5 rounded-full ${harvestStatus.isReady ? "bg-green-100" : "bg-yellow-100"}`}
              >
                <Text
                  className={`text-xs font-medium ${harvestStatus.isReady ? "text-green-700" : "text-yellow-700"}`}
                >
                  {harvestStatus.isReady
                    ? "Ready to Harvest"
                    : `${harvestStatus.daysLeft} days remaining`}
                </Text>
              </View>
            </View>
            <View className="flex-row justify-between mt-2 pt-2 border-t border-gray-200">
              <Text className="text-gray-600">Expected Harvest:</Text>
              <Text className="text-gray-800">{harvestStatus.harvestDate}</Text>
            </View>
          </View>
        </View>

        {/* Progress Card */}
        <View className="bg-white rounded-xl p-5 mb-4 shadow-sm border border-gray-100">
          <Text className="text-gray-500 text-sm mb-3">HARVEST PROGRESS</Text>

          {/* Backlog Banner */}
          {hasBacklog && fruit.remaining_quantity > 0 && (
            <View className="bg-yellow-50 p-3 rounded-lg mb-3 border border-yellow-200">
              <View className="flex-row items-center">
                <AlertCircle size={18} color="#D97706" />
                <Text className="text-yellow-700 font-medium ml-2">
                  📋 Backlog Harvest
                </Text>
              </View>
              <Text className="text-yellow-600 text-sm mt-1">
                This fruit has {fruit.remaining_quantity} pending item(s) from
                previous harvest
              </Text>
              {existingFruitWeights.length > 0 && (
                <Text className="text-yellow-600 text-xs mt-1">
                  Previously harvested: {existingFruitWeights.length} fruits
                </Text>
              )}
            </View>
          )}

          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-600">
              {hasBacklog ? "Remaining from backlog:" : "Total Fruits:"}
            </Text>
            <Text className="font-semibold">{availableQuantity}</Text>
          </View>

          {/* Show total harvested including previous */}
          {hasBacklog && existingFruitWeights.length > 0 && (
            <View className="flex-row justify-between mb-2">
              <Text className="text-gray-600">Previously harvested:</Text>
              <Text className="font-medium text-blue-600">
                {existingFruitWeights.length}
              </Text>
            </View>
          )}

          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-600">Ripe Fruits :</Text>
            <Text className="font-medium text-green-600">{totalRipe}</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            {/* (this session) */}
            <Text className="text-gray-600">Wasted Fruits :</Text>
            <Text className="font-medium text-red-600">{totalWaste}</Text>
          </View>

          {/* Total this session */}
          {/* <View className="flex-row justify-between pt-2 border-t border-gray-200">
            <Text className="text-gray-800 font-medium">
              Total this session:
            </Text>
            <Text className="font-bold text-orange-600">{totalNow}</Text>
          </View> */}

          {/* Overall total */}
          <View className="flex-row justify-between pt-2 border-t border-gray-200 mt-2">
            <Text className="text-gray-800 font-medium">
              Overall harvested:
            </Text>
            <Text className="font-bold text-purple-600">
              {(hasBacklog ? existingFruitWeights.length : 0) + totalNow}
            </Text>
          </View>

          <View className="flex-row justify-between pt-2 border-t border-gray-200">
            <Text className="text-gray-800 font-medium">
              Remaining after this:
            </Text>
            <Text
              className={`font-bold ${remaining > 0 ? "text-blue-600" : "text-gray-400"}`}
            >
              {remaining}
            </Text>
          </View>

          {/* Progress Bar */}
          <View className="h-2 bg-gray-200 rounded-full mt-3 overflow-hidden">
            <View
              className="h-full bg-green-500"
              style={{
                width: `${(((hasBacklog ? existingFruitWeights.length : 0) + totalNow) / fruit.quantity) * 100}%`,
              }}
            />
          </View>
        </View>

        {/* Ripe Fruits Section */}
        <View className="bg-white rounded-xl p-5 mb-4 shadow-sm border border-gray-100">
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-row items-center">
              <View className="bg-green-100 p-2 rounded-full mr-2">
                <Scale size={18} color="#059669" />
              </View>
              <Text className="text-gray-800 font-semibold">
                Ripe Fruits (this session)
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleAddRipeFruit}
              disabled={remaining <= 0}
              className={`flex-row items-center px-3 py-1.5 rounded-full ${
                remaining > 0 ? "bg-green-600" : "bg-gray-300"
              }`}
            >
              <Plus size={16} color="white" />
              <Text className="text-white text-xs ml-1">Add</Text>
            </TouchableOpacity>
          </View>

          {/* Show previous harvests */}
          {hasBacklog && existingFruitWeights.length > 0 && (
            <View className="mb-3 p-2 bg-blue-50 rounded-lg">
              <Text className="text-blue-700 font-medium text-sm mb-2">
                Previously harvested fruits:
              </Text>
              {existingFruitWeights.map((weight, index) => (
                <View
                  key={`prev-${index}`}
                  className="flex-row items-center mb-1"
                >
                  <View className="bg-blue-100 w-6 h-6 rounded-full items-center justify-center mr-2">
                    <Text className="text-blue-700 font-medium text-xs">
                      {index + 1}
                    </Text>
                  </View>
                  <Text className="text-gray-700">{weight.weight} kg</Text>
                  <Text className="text-xs text-gray-500 ml-2">
                    ({weight.status})
                  </Text>
                </View>
              ))}
            </View>
          )}

          {ripeFruits.length === 0 ? (
            <View className="border-2 border-dashed border-gray-200 rounded-xl p-6 items-center">
              <Scale size={32} color="#9ca3af" />
              <Text className="text-gray-500 mt-2">
                No ripe fruits added this session
              </Text>
              <Text className="text-gray-400 text-xs mt-1">
                Tap Add to record ripe fruits
              </Text>
            </View>
          ) : (
            ripeFruits.map((weight, index) => (
              <View
                key={`ripe-${index}`}
                className="flex-row items-center mb-3"
              >
                <View className="bg-green-100 w-8 h-8 rounded-full items-center justify-center mr-2">
                  <Text className="text-green-700 font-medium text-xs">
                    {index + 1}
                  </Text>
                </View>
                <TextInput
                  className="flex-1 border border-gray-300 rounded-xl px-4 py-3 bg-gray-50"
                  placeholder="Weight (kg)"
                  value={weight}
                  onChangeText={(value) => handleRipeWeightChange(index, value)}
                  keyboardType="numeric"
                />
                <Text className="mx-2 text-gray-600">kg</Text>
                <TouchableOpacity
                  onPress={() => handleRemoveRipeFruit(index)}
                  className="p-2"
                >
                  <Trash2 size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Waste Section */}
        <View className="bg-white rounded-xl p-5 mb-4 shadow-sm border border-gray-100">
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-row items-center">
              <View className="bg-red-100 p-2 rounded-full mr-2">
                <AlertCircle size={18} color="#ef4444" />
              </View>
              <Text className="text-gray-800 font-semibold">
                Wasted Fruits (this session)
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleAddWaste}
              disabled={remaining <= 0}
              className={`flex-row items-center px-3 py-1.5 rounded-full ${
                remaining > 0 ? "bg-red-500" : "bg-gray-300"
              }`}
            >
              <Plus size={16} color="white" />
              <Text className="text-white text-xs ml-1">Add</Text>
            </TouchableOpacity>
          </View>

          {/* Show previous wastes */}
          {hasBacklog && existingWastes.length > 0 && (
            <View className="mb-3 p-2 bg-red-50 rounded-lg">
              <Text className="text-red-700 font-medium text-sm mb-2">
                Previously recorded waste:
              </Text>
              {existingWastes.map((waste, index) => (
                <View key={`prev-waste-${index}`} className="mb-1">
                  <Text className="text-gray-700">
                    {waste.waste_quantity} fruit(s) - {waste.reason}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {wasteItems.length === 0 ? (
            <View className="border-2 border-dashed border-red-200 rounded-xl p-6 items-center">
              <AlertCircle size={32} color="#9ca3af" />
              <Text className="text-gray-500 mt-2">
                No waste recorded this session
              </Text>
              <Text className="text-gray-400 text-xs mt-1">
                Tap Add to record wasted fruits
              </Text>
            </View>
          ) : (
            wasteItems.map((item, index) => (
              <View
                key={`waste-${index}`}
                className="mb-3 p-3 bg-red-50 rounded-xl"
              >
                <View className="flex-row justify-between items-center">
                  <View className="flex-row items-center flex-1">
                    <View className="bg-red-200 w-6 h-6 rounded-full items-center justify-center mr-2">
                      <Text className="text-red-700 font-medium text-xs">
                        {index + 1}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-gray-800 font-medium">
                        {item.quantity} fruit{item.quantity !== "1" ? "s" : ""}
                      </Text>
                      <Text className="text-gray-600 text-xs" numberOfLines={1}>
                        {item.reason}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row">
                    <TouchableOpacity
                      onPress={() => handleEditWaste(index)}
                      className="px-2"
                    >
                      <Text className="text-blue-500 text-xs">Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleRemoveWaste(index)}
                      className="px-2"
                    >
                      <Text className="text-red-500 text-xs">Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Update Button */}
        {harvestRecord?.harvest?.status !== "harvested" ? (
          <TouchableOpacity
            onPress={handleSubmitHarvest}
            disabled={submitting || totalNow === 0}
            className={`py-4 rounded-xl mt-2 ${
              totalNow > 0 ? "bg-green-600" : "bg-gray-400"
            }`}
          >
            {submitting ? (
              <View className="flex-row items-center justify-center">
                <ActivityIndicator size="small" color="white" />
                <Text className="text-white font-semibold ml-2">
                  {harvestRecord ? "Updating..." : "Saving..."}
                </Text>
              </View>
            ) : (
              <Text className="text-center font-semibold text-white text-lg">
                ✓ {harvestRecord ? "Update Harvest" : "Record Harvest"}
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          // Show a message or alternative when harvested
          <View className="py-4 rounded-xl mt-2 bg-green-100 border border-green-300">
            <Text className="text-center font-semibold text-green-700 text-lg">
              ✓ Harvest Complete
            </Text>
            <Text className="text-center text-green-600 text-sm mt-1">
              All fruits have been harvested
            </Text>
          </View>
        )}

        {/* Info Note */}
        <View className="mt-4 px-2 mb-6">
          <Text className="text-xs text-gray-500 text-center">
            Total ripe + waste should not exceed {availableQuantity} fruits this
            session. Overall progress:{" "}
            {(
              (((hasBacklog ? existingFruitWeights.length : 0) + totalNow) /
                fruit.quantity) *
              100
            ).toFixed(0)}
            % complete.
            {remaining > 0
              ? ` ${remaining} fruit(s) will remain for later harvest.`
              : ""}
          </Text>
        </View>
      </ScrollView>

      {/* Waste Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showWasteModal}
        onRequestClose={() => setShowWasteModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-xl p-6 w-11/12 max-w-md">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-gray-800">
                {editingWasteIndex !== null ? "Edit Waste" : "Add Waste"}
              </Text>
              <TouchableOpacity onPress={() => setShowWasteModal(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <Text className="text-gray-700 font-medium mb-2">
              Quantity <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 mb-4"
              placeholder="Number of wasted fruits"
              value={wasteQuantity}
              onChangeText={setWasteQuantity}
              keyboardType="numeric"
            />

            <Text className="text-gray-700 font-medium mb-2">
              Reason <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 mb-6"
              placeholder="e.g., damaged, rotten, pest"
              value={wasteReason}
              onChangeText={setWasteReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <TouchableOpacity
              className="bg-red-500 py-3 rounded-xl"
              onPress={handleSaveWaste}
            >
              <Text className="text-center font-semibold text-white">
                {editingWasteIndex !== null ? "Update" : "Add"} Waste
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Backlog Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showBacklogModal}
        onRequestClose={() => setShowBacklogModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-xl p-6 w-11/12 max-w-md">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-gray-800">
                Backlog Harvest
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowBacklogModal(false);
                  router.back();
                }}
              >
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <Text className="text-gray-600 mb-4">
              You have {remainingAfterHarvest} fruit
              {remainingAfterHarvest !== 1 ? "s" : ""} left to harvest. When
              should we remind you to check them again?
            </Text>

            <Text className="text-gray-700 font-medium mb-2">
              Days until next check <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 mb-4"
              placeholder="e.g., 7"
              value={backlogDays}
              onChangeText={setBacklogDays}
              keyboardType="numeric"
            />

            <Text className="text-gray-700 font-medium mb-2">
              Reason (Optional)
            </Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 mb-6"
              placeholder="e.g., Still developing, weather condition"
              value={backlogReason}
              onChangeText={setBacklogReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View className="flex-row space-x-3">
              <TouchableOpacity
                className="flex-1 bg-gray-300 py-3 rounded-xl mr-2"
                onPress={() => {
                  setShowBacklogModal(false);
                  router.back();
                }}
              >
                <Text className="text-center font-semibold text-gray-700">
                  Skip
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-orange-500 py-3 rounded-xl ml-2"
                onPress={handleBacklogSubmit}
              >
                <Text className="text-center font-semibold text-white">
                  Set Reminder
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Toast />
    </View>
  );
}
