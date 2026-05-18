import FruitService from "@/services/FruitService";
import HarvestService from "@/services/HarvestService";
import NetInfo from "@react-native-community/netinfo";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  ChevronDown,
  Package,
  Plus,
  Scale,
  Trash2,
  User,
  Wifi,
  WifiOff,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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

  // Accessibility constants
  const TOUCH_TARGET = 56;
  const ICON_SIZE_XL = 36;
  const ICON_SIZE_LG = 28;
  const ICON_SIZE_MD = 24;
  const ICON_SIZE_SM = 18;
  const FONT_SIZE_TITLE = 28;
  const FONT_SIZE_HEADING = 22;
  const FONT_SIZE_BODY = 18;
  const FONT_SIZE_CAPTION = 16;
  const FONT_SIZE_SMALL = 15;

  // Form states
  const [ripeFruits, setRipeFruits] = useState<string[]>([]);
  const [wasteItems, setWasteItems] = useState<
    { quantity: string; reason: string; image_uri?: string | null }[]
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

  // Camera states
  const [showCamera, setShowCamera] = useState(false);
  const [wasteImage, setWasteImage] = useState<string | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Modal states
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [editingWasteIndex, setEditingWasteIndex] = useState<number | null>(
    null,
  );
  const [wasteQuantity, setWasteQuantity] = useState("");
  const [wasteReason, setWasteReason] = useState("");

  // Check if harvest is completed
  const isHarvestCompleted = harvestRecord?.harvest?.status === "harvested";
  const [showReasonDropdown, setShowReasonDropdown] = useState(false);
  const [customReason, setCustomReason] = useState("");

  const wasteReasonOptions = [
    { label: "Rotten", value: "rotten" },
    { label: "Pest Infestation", value: "pest_infestation" },
    { label: "Disease", value: "disease" },
    { label: "Animal Damage", value: "animal_damage" },
    { label: "Weather Damage", value: "weather_damage" },
    { label: "Overripe", value: "overripe" },
    { label: "Physical Damage", value: "physical_damage" },
    { label: "Other", value: "other" },
  ];

  // Camera functions
  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
          skipProcessing: false,
        });
        setWasteImage(photo.uri);
        setShowCamera(false);
        Toast.show({
          type: "success",
          text1: "Photo Captured",
          text2: "Waste photo has been taken successfully",
        });
      } catch (error) {
        console.error("Error taking picture:", error);
        Toast.show({
          type: "error",
          text1: "Failed",
          text2: "Could not capture image. Please try again.",
        });
      }
    }
  };

  const openCamera = async () => {
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        Toast.show({
          type: "error",
          text1: "Permission Denied",
          text2: "Camera permission is required to take waste photos",
        });
        return;
      }
    }
    setShowCamera(true);
  };

  const removeImage = () => {
    Alert.alert("Remove Photo", "Are you sure you want to remove this photo?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => setWasteImage(null),
      },
    ]);
  };

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
        console.log("Merong parsed fruit data", parsedFruit);
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
        console.log("Fetched harvest:", JSON.stringify(harvest));
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
            image_uri: w.image_uri || null,
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
    if (!isHarvestCompleted) {
      setRipeFruits([...ripeFruits, ""]);
    }
  };

  const handleRipeWeightChange = (index: number, value: string) => {
    if (
      !isHarvestCompleted &&
      (value === "" || /^\d*\.?\d{0,2}$/.test(value))
    ) {
      const newRipeFruits = [...ripeFruits];
      newRipeFruits[index] = value;
      setRipeFruits(newRipeFruits);
    }
  };

  const handleRemoveRipeFruit = (index: number) => {
    if (!isHarvestCompleted) {
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
    }
  };

  const handleAddWaste = () => {
    if (!isHarvestCompleted) {
      setEditingWasteIndex(null);
      setWasteQuantity("");
      setWasteReason("");
      setWasteImage(null);
      setShowWasteModal(true);
    }
  };

  const handleEditWaste = (index: number) => {
    if (!isHarvestCompleted) {
      setEditingWasteIndex(index);
      setWasteQuantity(wasteItems[index].quantity);
      const reason = wasteItems[index].reason;
      setWasteReason(reason);
      setWasteImage(wasteItems[index].image_uri || null);

      const isCustomReason = !wasteReasonOptions.some(
        (opt) => opt.value === reason,
      );
      if (isCustomReason) {
        setWasteReason("other");
        setCustomReason(reason);
      } else {
        setCustomReason("");
      }
      setShowWasteModal(true);
    }
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

    if (!wasteReason) {
      Toast.show({
        type: "error",
        text1: "Invalid",
        text2: "Please select a reason for waste",
      });
      return;
    }

    if (wasteReason === "other" && !customReason.trim()) {
      Toast.show({
        type: "error",
        text1: "Invalid",
        text2: "Please specify the reason",
      });
      return;
    }

    // Check if image is provided (required na)
    if (!wasteImage) {
      Toast.show({
        type: "error",
        text1: "Photo Required",
        text2: "Please take a photo of the waste for documentation",
      });
      return;
    }

    const finalReason = wasteReason === "other" ? customReason : wasteReason;

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
        reason: finalReason,
        image_uri: wasteImage, // Save local URI directly - i-upload later during sync
      };
      setWasteItems(newWasteItems);
    } else {
      setWasteItems([
        ...wasteItems,
        {
          quantity: wasteQuantity,
          reason: finalReason,
          image_uri: wasteImage, // Save local URI directly - i-upload later during sync
        },
      ]);
    }

    setShowWasteModal(false);
    setWasteQuantity("");
    setWasteReason("");
    setCustomReason("");
    setWasteImage(null);
    setShowReasonDropdown(false);
  };

  const handleRemoveWaste = (index: number) => {
    if (!isHarvestCompleted) {
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
    }
  };

  const getAvailableQuantity = () => {
    if (isHarvestCompleted) {
      return 0;
    }
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
    if (!fruit || isHarvestCompleted) return;

    const currentWeights = ripeFruits.map((w) => parseFloat(w));
    const currentWastes = wasteItems.map((item) => ({
      quantity: parseInt(item.quantity),
      reason: item.reason,
      image_uri: item.image_uri || null,
    }));

    let allWeights = [...currentWeights];
    let allWastes = [...currentWastes];

    if (hasBacklog && existingFruitWeights.length > 0) {
      existingFruitWeights.forEach((fw) => {
        allWeights.push(parseFloat(fw.weight));
      });
    }

    if (hasBacklog && existingWastes.length > 0) {
      existingWastes.forEach((w) => {
        allWastes.push({
          quantity: parseInt(w.waste_quantity),
          reason: w.reason,
          image_uri: w.image_uri || null,
        });
      });
    }

    if (allWeights.length === 0 && allWastes.length === 0) {
      Toast.show({
        type: "error",
        text1: "Invalid",
        text2: "Please add at least one fruit",
      });
      return;
    }

    for (let i = 0; i < currentWeights.length; i++) {
      if (!ripeFruits[i] || currentWeights[i] <= 0) {
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

      const totalProcessed =
        allWeights.length + allWastes.reduce((sum, w) => sum + w.quantity, 0);

      const availableQuantity = getAvailableQuantity();
      const remaining = availableQuantity - totalProcessed;
      setRemainingAfterHarvest(remaining);
      let result = null;
      if (harvestRecord?.harvest) {
        result = await HarvestService.updateHarvest(
          harvestRecord.harvest.id,
          allWeights.length,
          allWeights,
          allWastes,
        );

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

      await updateFruitRemainingQuantity(fruit.id, remaining);

      if (remaining > 0 && result.harvest.status !== "harvested") {
        setShowBacklogModal(true);
      } else {
        router.back();
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
      await FruitService.updateFruit(fruit.id, {
        farmer_extra_days: parseInt(backlogDays),
        farmer_assessed_at: new Date().toISOString(),
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
      router.push("/users/assigned");
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
          onPress={() => router.push("/users/assigned")}
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
      <View className="bg-white pt-12 pb-5 px-5 shadow-sm border-b border-gray-200">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 mr-4">
            <TouchableOpacity
              onPress={() => router.back()}
              className="mr-4 w-12 h-12 rounded-full items-center justify-center bg-gray-100 active:bg-gray-200"
              style={{ minWidth: TOUCH_TARGET, minHeight: TOUCH_TARGET }}
            >
              <ArrowLeft size={ICON_SIZE_MD} color="#4b5563" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text
                className="font-bold text-gray-800"
                style={{ fontSize: FONT_SIZE_HEADING }}
              >
                {harvestRecord ? "Update Harvest" : "New Harvest"}
              </Text>
              <Text
                className="text-gray-500"
                style={{ fontSize: FONT_SIZE_SMALL }}
              >
                {harvestRecord ? "Edit harvest record" : "Record fruit harvest"}
              </Text>
            </View>
          </View>

          {/* Online/Offline Status */}
          <View className="flex-row items-center bg-gray-100 px-4 py-2 rounded-full">
            {isOnline ? (
              <>
                <Wifi size={ICON_SIZE_SM} color="#059669" />
                <Text
                  className="text-green-600 font-medium ml-2"
                  style={{ fontSize: FONT_SIZE_SMALL }}
                >
                  Online
                </Text>
              </>
            ) : (
              <>
                <WifiOff size={ICON_SIZE_SM} color="#6b7280" />
                <Text
                  className="text-gray-500 font-medium ml-2"
                  style={{ fontSize: FONT_SIZE_SMALL }}
                >
                  Offline
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Assignment Info - if exists */}
        {harvestRecord?.harvest?.user_id && (
          <View className="mt-4 bg-blue-50 p-4 rounded-2xl border border-blue-200">
            <View className="flex-row items-center">
              <User size={ICON_SIZE_SM} color="#3b82f6" />
              <Text
                className="text-blue-700 font-semibold ml-3"
                style={{ fontSize: FONT_SIZE_SMALL }}
              >
                Assigned Harvest
              </Text>
            </View>
            <Text
              className="text-gray-600 mt-2"
              style={{ fontSize: FONT_SIZE_SMALL }}
            >
              You are harvesting this fruit
            </Text>
          </View>
        )}

        {/* Harvest Complete Banner */}
        {isHarvestCompleted && (
          <View className="mt-4 bg-green-50 p-4 rounded-2xl border-2 border-green-200">
            <View className="flex-row items-center">
              <Package size={ICON_SIZE_SM} color="#059669" />
              <Text
                className="text-green-700 font-semibold ml-3"
                style={{ fontSize: FONT_SIZE_SMALL }}
              >
                ✓ Harvest Complete
              </Text>
            </View>
            <Text
              className="text-green-600 mt-2"
              style={{ fontSize: FONT_SIZE_SMALL }}
            >
              All fruits have been harvested. No further changes can be made.
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
        {/* Progress Card */}
        <View className="bg-white rounded-2xl p-6 mb-5 shadow-sm border-2 border-gray-100">
          <Text
            className="text-gray-500 mb-4 font-semibold"
            style={{ fontSize: 15 }}
          >
            HARVEST PROGRESS
          </Text>

          {/* Backlog Banner */}
          {hasBacklog &&
            fruit.remaining_quantity > 0 &&
            !isHarvestCompleted && (
              <View className="bg-yellow-50 p-4 rounded-2xl mb-4 border-2 border-yellow-200">
                <View className="flex-row items-center">
                  <AlertCircle size={24} color="#D97706" />
                  <Text
                    className="text-yellow-700 font-semibold ml-3"
                    style={{ fontSize: 16 }}
                  >
                    📋 Backlog Harvest
                  </Text>
                </View>
                <Text className="text-yellow-600 mt-2" style={{ fontSize: 15 }}>
                  This fruit has {fruit.remaining_quantity} pending item(s) from
                  previous harvest
                </Text>
                {existingFruitWeights.length > 0 && (
                  <Text
                    className="text-yellow-600 mt-1"
                    style={{ fontSize: 15 }}
                  >
                    Previously harvested: {existingFruitWeights.length} fruits
                  </Text>
                )}
              </View>
            )}

          <View className="flex-row justify-between mb-3">
            <Text className="text-gray-600" style={{ fontSize: 16 }}>
              {isHarvestCompleted
                ? "Total Fruits:"
                : hasBacklog
                  ? "Remaining from backlog:"
                  : "Total Fruits:"}
            </Text>
            <Text className="font-bold" style={{ fontSize: 16 }}>
              {isHarvestCompleted ? fruit.quantity : availableQuantity}
            </Text>
          </View>

          {hasBacklog &&
            existingFruitWeights.length > 0 &&
            !isHarvestCompleted && (
              <View className="flex-row justify-between mb-3">
                <Text className="text-gray-600" style={{ fontSize: 16 }}>
                  Previously harvested:
                </Text>
                <Text
                  className="font-semibold text-blue-600"
                  style={{ fontSize: 16 }}
                >
                  {existingFruitWeights.length}
                </Text>
              </View>
            )}

          {!isHarvestCompleted && (
            <>
              <View className="flex-row justify-between mb-3">
                <Text className="text-gray-600" style={{ fontSize: 16 }}>
                  Ripe Fruits :
                </Text>
                <Text
                  className="font-semibold text-green-600"
                  style={{ fontSize: 16 }}
                >
                  {totalRipe}
                </Text>
              </View>
              <View className="flex-row justify-between mb-3">
                <Text className="text-gray-600" style={{ fontSize: 16 }}>
                  Wasted Fruits :
                </Text>
                <Text
                  className="font-semibold text-red-600"
                  style={{ fontSize: 16 }}
                >
                  {totalWaste}
                </Text>
              </View>
            </>
          )}

          <View className="flex-row justify-between pt-3 border-t-2 border-gray-200 mt-3">
            <Text
              className="text-gray-800 font-semibold"
              style={{ fontSize: 16 }}
            >
              Overall harvested:
            </Text>
            <Text
              className="font-bold text-purple-600"
              style={{ fontSize: 16 }}
            >
              {isHarvestCompleted
                ? fruit.quantity
                : (hasBacklog ? existingFruitWeights.length : 0) + totalNow}
            </Text>
          </View>

          {!isHarvestCompleted && (
            <>
              <View className="flex-row justify-between pt-3 border-t-2 border-gray-200">
                <Text
                  className="text-gray-800 font-semibold"
                  style={{ fontSize: 16 }}
                >
                  Remaining after this:
                </Text>
                <Text
                  className={`font-bold ${remaining > 0 ? "text-blue-600" : "text-gray-400"}`}
                  style={{ fontSize: 16 }}
                >
                  {remaining}
                </Text>
              </View>

              <View className="h-3 bg-gray-200 rounded-full mt-4 overflow-hidden">
                <View
                  className="h-full bg-green-500"
                  style={{
                    width: `${(((hasBacklog ? existingFruitWeights.length : 0) + totalNow) / fruit.quantity) * 100}%`,
                  }}
                />
              </View>
            </>
          )}
        </View>

        {/* Ripe Fruits Section */}
        <View className="bg-white rounded-2xl p-6 mb-5 shadow-sm border-2 border-gray-100">
          <View className="flex-row justify-between items-center mb-5">
            <View className="flex-row items-center">
              <View className="bg-green-100 p-3 rounded-2xl mr-3">
                <Scale size={24} color="#059669" />
              </View>
              <Text
                className="text-gray-800 font-bold"
                style={{ fontSize: 18 }}
              >
                Ripe Fruits
              </Text>
            </View>
            {!isHarvestCompleted && (
              <TouchableOpacity
                onPress={handleAddRipeFruit}
                disabled={remaining <= 0}
                className={`flex-row items-center px-5 py-3 rounded-2xl ${
                  remaining > 0 ? "bg-green-600" : "bg-gray-300"
                }`}
                style={{ minHeight: 56 }}
              >
                <Plus size={18} color="white" />
                <Text
                  className="text-white font-semibold ml-2"
                  style={{ fontSize: 16 }}
                >
                  Add
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Combine existing and new ripe fruits */}
          {existingFruitWeights.length === 0 && ripeFruits.length === 0 ? (
            <View className="border-2 border-dashed border-gray-200 rounded-2xl p-8 items-center">
              <Scale size={40} color="#9ca3af" />
              <Text className="text-gray-500 mt-3" style={{ fontSize: 16 }}>
                {isHarvestCompleted
                  ? "No ripe fruits recorded"
                  : "No ripe fruits recorded"}
              </Text>
              <Text className="text-gray-400 mt-2" style={{ fontSize: 15 }}>
                {isHarvestCompleted
                  ? "Harvest is complete"
                  : "Tap Add to record ripe fruits"}
              </Text>
            </View>
          ) : (
            <>
              {/* Show existing ripe fruits (non-editable but visible) */}
              {existingFruitWeights.map((weight, index) => (
                <View
                  key={`existing-ripe-${index}`}
                  className="flex-row items-center mb-4 bg-gray-50 p-4 rounded-2xl"
                >
                  <View className="bg-gray-200 w-10 h-10 rounded-full items-center justify-center mr-3">
                    <Text
                      className="text-gray-600 font-semibold"
                      style={{ fontSize: 15 }}
                    >
                      {index + 1}
                    </Text>
                  </View>
                  <Text
                    className="flex-1 text-gray-700 font-medium"
                    style={{ fontSize: 16 }}
                  >
                    {weight.weight} kg
                  </Text>
                  <Text className="text-gray-500 ml-2" style={{ fontSize: 14 }}>
                    (harvested{" "}
                    {new Date(weight.created_at).toLocaleDateString()})
                  </Text>
                </View>
              ))}

              {/* Show new ripe fruits (editable) */}
              {!isHarvestCompleted &&
                ripeFruits.map((weight, index) => (
                  <View
                    key={`new-ripe-${index}`}
                    className="flex-row items-center mb-4"
                  >
                    <View className="bg-green-100 w-10 h-10 rounded-full items-center justify-center mr-3">
                      <Text
                        className="text-green-700 font-semibold"
                        style={{ fontSize: 15 }}
                      >
                        {existingFruitWeights.length + index + 1}
                      </Text>
                    </View>
                    <TextInput
                      className="flex-1 border-2 border-green-300 rounded-2xl px-5 py-4 bg-white"
                      style={{ fontSize: 18, minHeight: 56 }}
                      placeholder="Weight (kg)"
                      value={weight}
                      onChangeText={(value) =>
                        handleRipeWeightChange(index, value)
                      }
                      keyboardType="numeric"
                      editable={!isHarvestCompleted}
                      placeholderTextColor="#9ca3af"
                    />
                    <Text
                      className="mx-3 text-gray-600 font-medium"
                      style={{ fontSize: 16 }}
                    >
                      kg
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveRipeFruit(index)}
                      className="p-3"
                      style={{ minWidth: 56, minHeight: 56 }}
                      disabled={isHarvestCompleted}
                    >
                      <Trash2
                        size={22}
                        color={isHarvestCompleted ? "#9ca3af" : "#ef4444"}
                      />
                    </TouchableOpacity>
                  </View>
                ))}
            </>
          )}
        </View>

        {/* Waste Section */}
        <View className="bg-white rounded-2xl p-6 mb-5 shadow-sm border-2 border-gray-100">
          <View className="flex-row justify-between items-center mb-5">
            <View className="flex-row items-center">
              <View className="bg-red-100 p-3 rounded-2xl mr-3">
                <AlertCircle size={24} color="#ef4444" />
              </View>
              <Text
                className="text-gray-800 font-bold"
                style={{ fontSize: 18 }}
              >
                Wasted Fruits
              </Text>
            </View>
            {!isHarvestCompleted && (
              <TouchableOpacity
                onPress={handleAddWaste}
                disabled={remaining <= 0}
                className={`flex-row items-center px-5 py-3 rounded-2xl ${
                  remaining > 0 ? "bg-red-500" : "bg-gray-300"
                }`}
                style={{ minHeight: 56 }}
              >
                <Plus size={18} color="white" />
                <Text
                  className="text-white font-semibold ml-2"
                  style={{ fontSize: 16 }}
                >
                  Add
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Combine existing and new wastes */}
          {existingWastes.length === 0 && wasteItems.length === 0 ? (
            <View className="border-2 border-dashed border-red-200 rounded-2xl p-8 items-center">
              <AlertCircle size={40} color="#9ca3af" />
              <Text className="text-gray-500 mt-3" style={{ fontSize: 16 }}>
                No waste recorded
              </Text>
              <Text className="text-gray-400 mt-2" style={{ fontSize: 15 }}>
                {isHarvestCompleted
                  ? "Harvest is complete"
                  : "Tap Add to record wasted fruits"}
              </Text>
            </View>
          ) : (
            <>
              {/* Show existing wastes (non-editable but visible) */}
              {existingWastes.map((waste, index) => (
                <View
                  key={`existing-waste-${index}`}
                  className="mb-4 p-4 bg-gray-50 rounded-2xl"
                >
                  <View className="flex-row justify-between items-center">
                    <View className="flex-row items-center flex-1">
                      <View className="bg-gray-200 w-8 h-8 rounded-full items-center justify-center mr-3">
                        <Text
                          className="text-gray-600 font-semibold"
                          style={{ fontSize: 14 }}
                        >
                          {index + 1}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text
                          className="text-gray-800 font-semibold"
                          style={{ fontSize: 16 }}
                        >
                          {waste.waste_quantity} fruit
                          {waste.waste_quantity !== "1" ? "s" : ""}
                        </Text>
                        <Text
                          className="text-gray-600 mt-1"
                          style={{ fontSize: 15 }}
                          numberOfLines={1}
                        >
                          {waste.reason}
                        </Text>
                        <Text
                          className="text-gray-400 mt-1"
                          style={{ fontSize: 14 }}
                        >
                          Recorded:{" "}
                          {new Date(waste.created_at).toLocaleDateString()}
                        </Text>
                        {waste.image_uri && (
                          <View className="flex-row items-center mt-2">
                            <Image
                              source={{ uri: waste.image_uri }}
                              className="w-16 h-16 rounded-lg"
                              resizeMode="cover"
                            />
                            <View className="ml-2 bg-green-100 px-2 py-1 rounded-full">
                              <Text
                                className="text-green-700"
                                style={{ fontSize: 12 }}
                              >
                                📸 Photo
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              ))}

              {/* Show new wastes (editable) */}
              {!isHarvestCompleted &&
                wasteItems.map((item, index) => (
                  <View
                    key={`new-waste-${index}`}
                    className="mb-4 p-4 bg-red-50 rounded-2xl"
                  >
                    <View className="flex-row justify-between items-center">
                      <View className="flex-row items-center flex-1">
                        <View className="bg-red-200 w-8 h-8 rounded-full items-center justify-center mr-3">
                          <Text
                            className="text-red-700 font-semibold"
                            style={{ fontSize: 14 }}
                          >
                            {existingWastes.length + index + 1}
                          </Text>
                        </View>
                        <View className="flex-1">
                          <Text
                            className="text-gray-800 font-semibold"
                            style={{ fontSize: 16 }}
                          >
                            {item.quantity} fruit
                            {item.quantity !== "1" ? "s" : ""}
                          </Text>
                          <Text
                            className="text-gray-600 mt-1"
                            style={{ fontSize: 15 }}
                            numberOfLines={1}
                          >
                            {item.reason}
                          </Text>
                          {item.image_uri && (
                            <View className="flex-row items-center mt-2">
                              <Image
                                source={{ uri: item.image_uri }}
                                className="w-16 h-16 rounded-lg"
                                resizeMode="cover"
                              />
                              <View className="ml-2 bg-green-100 px-2 py-1 rounded-full">
                                <Text
                                  className="text-green-700"
                                  style={{ fontSize: 12 }}
                                >
                                  📸 Photo
                                </Text>
                              </View>
                            </View>
                          )}
                        </View>
                      </View>
                      <View className="flex-row gap-2">
                        <TouchableOpacity
                          onPress={() => handleEditWaste(index)}
                          className="px-4 py-2"
                          style={{ minHeight: 44 }}
                          disabled={isHarvestCompleted}
                        >
                          <Text
                            className={`font-semibold ${isHarvestCompleted ? "text-gray-400" : "text-blue-500"}`}
                            style={{ fontSize: 16 }}
                          >
                            Edit
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleRemoveWaste(index)}
                          className="px-4 py-2"
                          style={{ minHeight: 44 }}
                          disabled={isHarvestCompleted}
                        >
                          <Text
                            className={`font-semibold ${isHarvestCompleted ? "text-gray-400" : "text-red-500"}`}
                            style={{ fontSize: 16 }}
                          >
                            Remove
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
            </>
          )}
        </View>

        {/* Update Button */}
        {!isHarvestCompleted ? (
          <TouchableOpacity
            onPress={handleSubmitHarvest}
            disabled={submitting || totalNow === 0}
            className={`py-5 rounded-2xl mt-3 ${
              totalNow > 0 ? "bg-green-600" : "bg-gray-400"
            }`}
            style={{ minHeight: TOUCH_TARGET }}
          >
            {submitting ? (
              <View className="flex-row items-center justify-center">
                <ActivityIndicator size="large" color="white" />
                <Text
                  className="text-white font-bold ml-3"
                  style={{ fontSize: FONT_SIZE_BODY }}
                >
                  {harvestRecord ? "Updating..." : "Saving..."}
                </Text>
              </View>
            ) : (
              <Text
                className="text-center font-bold text-white"
                style={{ fontSize: FONT_SIZE_BODY }}
              >
                ✓ {harvestRecord ? "Update Harvest" : "Record Harvest"}
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <View className="py-5 rounded-2xl mt-3 bg-green-100 border-2 border-green-300">
            <Text
              className="text-center font-bold text-green-700"
              style={{ fontSize: FONT_SIZE_BODY }}
            >
              ✓ Harvest Complete
            </Text>
            <Text
              className="text-center text-green-600 mt-2"
              style={{ fontSize: FONT_SIZE_SMALL }}
            >
              All fruits have been harvested
            </Text>
          </View>
        )}

        {/* Info Note */}
        {!isHarvestCompleted && (
          <View className="mt-5 px-3 mb-8">
            <Text
              className="text-gray-500 text-center"
              style={{ fontSize: FONT_SIZE_SMALL }}
            >
              Total ripe + waste should not exceed {availableQuantity} fruits
              this session. Overall progress:{" "}
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
        )}
      </ScrollView>

      {/* Waste Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showWasteModal}
        onRequestClose={() => setShowWasteModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-2xl p-6 w-11/12 max-w-md">
            <View className="flex-row justify-between items-center mb-5">
              <Text
                className="font-bold text-gray-800"
                style={{ fontSize: FONT_SIZE_HEADING }}
              >
                {editingWasteIndex !== null ? "Edit Waste" : "Add Waste"}
              </Text>
              <TouchableOpacity
                onPress={() => setShowWasteModal(false)}
                className="w-12 h-12 items-center justify-center rounded-full active:bg-gray-100"
                style={{ minWidth: TOUCH_TARGET, minHeight: TOUCH_TARGET }}
              >
                <X size={ICON_SIZE_MD} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <Text
              className="text-gray-700 font-semibold mb-2"
              style={{ fontSize: FONT_SIZE_CAPTION }}
            >
              Quantity <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              className="border-2 border-gray-300 rounded-2xl px-5 py-4 mb-5"
              style={{ fontSize: FONT_SIZE_BODY, minHeight: TOUCH_TARGET }}
              placeholder="Number of wasted fruits"
              value={wasteQuantity}
              onChangeText={setWasteQuantity}
              keyboardType="numeric"
              editable={!isHarvestCompleted}
              placeholderTextColor="#9ca3af"
            />

            <Text
              className="text-gray-700 font-semibold mb-2"
              style={{ fontSize: FONT_SIZE_CAPTION }}
            >
              Reason <Text className="text-red-500">*</Text>
            </Text>
            <TouchableOpacity
              onPress={() => setShowReasonDropdown(!showReasonDropdown)}
              className="border-2 border-gray-300 rounded-2xl px-5 py-4 mb-5 bg-white flex-row justify-between items-center"
              style={{ minHeight: TOUCH_TARGET }}
              disabled={isHarvestCompleted}
            >
              <Text
                style={{ fontSize: FONT_SIZE_BODY }}
                className={wasteReason ? "text-gray-800" : "text-gray-400"}
              >
                {wasteReason
                  ? wasteReasonOptions.find((opt) => opt.value === wasteReason)
                      ?.label || wasteReason
                  : "Select reason"}
              </Text>
              <ChevronDown size={ICON_SIZE_MD} color="#6b7280" />
            </TouchableOpacity>

            {/* Dropdown Options */}
            {showReasonDropdown && !isHarvestCompleted && (
              <View className="border-2 border-gray-200 rounded-2xl mb-5 max-h-48 bg-white shadow-lg">
                <ScrollView nestedScrollEnabled={true}>
                  {wasteReasonOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => {
                        setWasteReason(option.value);
                        setShowReasonDropdown(false);
                        if (option.value !== "other") {
                          setCustomReason("");
                        }
                      }}
                      className="px-5 py-4 border-b border-gray-100 active:bg-gray-50"
                      style={{ minHeight: TOUCH_TARGET }}
                    >
                      <Text
                        className="text-gray-800"
                        style={{ fontSize: FONT_SIZE_BODY }}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Custom Reason Input - Show only when "Other" is selected */}
            {wasteReason === "other" && !isHarvestCompleted && (
              <View className="mb-5">
                <Text
                  className="text-gray-700 font-semibold mb-2"
                  style={{ fontSize: FONT_SIZE_CAPTION }}
                >
                  Please specify <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  className="border-2 border-gray-300 rounded-2xl px-5 py-4 bg-white"
                  style={{ fontSize: FONT_SIZE_BODY, minHeight: TOUCH_TARGET }}
                  placeholder="Enter specific reason..."
                  value={customReason}
                  onChangeText={setCustomReason}
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            )}

            {/* Camera Section */}
            {!isHarvestCompleted && (
              <View className="mb-5">
                <Text
                  className="text-gray-700 font-semibold mb-2"
                  style={{ fontSize: FONT_SIZE_CAPTION }}
                >
                  Waste Photo <Text className="text-red-500">*</Text>
                </Text>

                {wasteImage ? (
                  <View className="relative">
                    <Image
                      source={{ uri: wasteImage }}
                      className="w-full h-48 rounded-2xl mb-2"
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      onPress={removeImage}
                      className="absolute top-2 right-2 bg-red-500 w-8 h-8 rounded-full items-center justify-center"
                    >
                      <X size={16} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={openCamera}
                      className="mt-2 bg-blue-500 py-3 rounded-xl active:bg-blue-600"
                    >
                      <Text
                        className="text-center text-white font-semibold"
                        style={{ fontSize: FONT_SIZE_SMALL }}
                      >
                        📸 Retake Photo
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={openCamera}
                    className="border-2 border-dashed border-red-300 rounded-2xl p-6 items-center justify-center bg-red-50 active:bg-red-100"
                    style={{ minHeight: 120 }}
                  >
                    <Camera size={40} color="#ef4444" />
                    <Text
                      className="text-red-600 font-semibold mt-2"
                      style={{ fontSize: FONT_SIZE_CAPTION }}
                    >
                      Take Photo of Waste *
                    </Text>
                    <Text
                      className="text-red-400 mt-1"
                      style={{ fontSize: FONT_SIZE_SMALL }}
                    >
                      Photo is required for documentation
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {!isHarvestCompleted && (
              <TouchableOpacity
                className="bg-red-500 py-5 rounded-2xl active:bg-red-600"
                style={{ minHeight: TOUCH_TARGET }}
                onPress={handleSaveWaste}
              >
                <Text
                  className="text-center font-bold text-white"
                  style={{ fontSize: FONT_SIZE_BODY }}
                >
                  {editingWasteIndex !== null ? "Update" : "Add"} Waste
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Camera Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={showCamera}
        onRequestClose={() => setShowCamera(false)}
      >
        <View className="flex-1 bg-black">
          {showCamera && (
            <CameraView
              ref={cameraRef}
              style={{ flex: 1 }}
              facing="back"
              flash="auto"
            >
              {/* Camera overlay controls */}
              <View className="absolute bottom-0 left-0 right-0 p-6 bg-black/50">
                <View className="flex-row justify-between items-center">
                  {/* Close button */}
                  <TouchableOpacity
                    onPress={() => setShowCamera(false)}
                    className="w-12 h-12 rounded-full bg-white/20 items-center justify-center"
                  >
                    <X size={24} color="white" />
                  </TouchableOpacity>

                  {/* Capture button */}
                  <TouchableOpacity
                    onPress={takePicture}
                    className="w-20 h-20 rounded-full bg-white border-4 border-gray-300 items-center justify-center"
                  >
                    <View className="w-16 h-16 rounded-full bg-white" />
                  </TouchableOpacity>

                  {/* Spacer for layout balance */}
                  <View className="w-12" />
                </View>

                {/* Instructions */}
                <Text
                  className="text-white text-center mt-4"
                  style={{ fontSize: FONT_SIZE_SMALL }}
                >
                  Position the waste clearly in frame
                </Text>
              </View>
            </CameraView>
          )}
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
          <View className="bg-white rounded-2xl p-6 w-11/12 max-w-md">
            <View className="flex-row justify-between items-center mb-5">
              <Text
                className="font-bold text-gray-800"
                style={{ fontSize: FONT_SIZE_HEADING }}
              >
                Backlog Harvest
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowBacklogModal(false);
                  router.back();
                }}
                className="w-12 h-12 items-center justify-center rounded-full active:bg-gray-100"
                style={{ minWidth: TOUCH_TARGET, minHeight: TOUCH_TARGET }}
              >
                <X size={ICON_SIZE_MD} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <Text
              className="text-gray-600 mb-5"
              style={{ fontSize: FONT_SIZE_CAPTION }}
            >
              You have {remainingAfterHarvest} fruit
              {remainingAfterHarvest !== 1 ? "s" : ""} left to harvest. When
              should we remind you to check them again?
            </Text>

            <Text
              className="text-gray-700 font-semibold mb-2"
              style={{ fontSize: FONT_SIZE_CAPTION }}
            >
              Days until next check <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              className="border-2 border-gray-300 rounded-2xl px-5 py-4 mb-6"
              style={{ fontSize: FONT_SIZE_BODY, minHeight: TOUCH_TARGET }}
              placeholder="e.g., 7"
              value={backlogDays}
              onChangeText={setBacklogDays}
              keyboardType="numeric"
              placeholderTextColor="#9ca3af"
            />

            <View className="flex-row space-x-3">
              <TouchableOpacity
                className="flex-1 bg-orange-500 py-5 rounded-2xl ml-2 active:bg-orange-600"
                style={{ minHeight: TOUCH_TARGET }}
                onPress={handleBacklogSubmit}
              >
                <Text
                  className="text-center font-bold text-white"
                  style={{ fontSize: FONT_SIZE_BODY }}
                >
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
