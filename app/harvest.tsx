// // app/harvest.tsx
// import HarvestService from "@/services/HarvestService";
// import NetInfo from "@react-native-community/netinfo";
// import { useLocalSearchParams, useRouter } from "expo-router";
// import {
//   AlertCircle,
//   ArrowLeft,
//   Package,
//   Plus,
//   Scale,
//   Trash2,
//   Wifi,
//   WifiOff,
//   X,
// } from "lucide-react-native";
// import React, { useCallback, useEffect, useState } from "react";
// import {
//   ActivityIndicator,
//   Alert,
//   Modal,
//   RefreshControl,
//   ScrollView,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   View,
// } from "react-native";
// import Toast from "react-native-toast-message";

// export default function Harvest() {
//   const router = useRouter();
//   const { fruitData } = useLocalSearchParams();

//   const [fruit, setFruit] = useState<any>(null);
//   const [loading, setLoading] = useState(true);
//   const [refreshing, setRefreshing] = useState(false);
//   const [submitting, setSubmitting] = useState(false);
//   const [isOnline, setIsOnline] = useState(false);

//   // Check for existing harvest
//   const [existingHarvest, setExistingHarvest] = useState<any>(null);
//   const [checkingHarvest, setCheckingHarvest] = useState(true);

//   // Form states
//   const [ripeFruits, setRipeFruits] = useState<string[]>([]); // weights ng ripe fruits
//   const [wasteItems, setWasteItems] = useState<
//     { quantity: string; reason: string }[]
//   >([]);

//   // Modal states
//   const [showWasteModal, setShowWasteModal] = useState(false);
//   const [editingWasteIndex, setEditingWasteIndex] = useState<number | null>(
//     null,
//   );
//   const [wasteQuantity, setWasteQuantity] = useState("");
//   const [wasteReason, setWasteReason] = useState("");

//   // View mode modal
//   const [showViewModal, setShowViewModal] = useState(false);

//   // Initialize service and check network
//   useEffect(() => {
//     const init = async () => {
//       await HarvestService.init();

//       const netInfo = await NetInfo.fetch();
//       setIsOnline(netInfo.isConnected ?? false);

//       // Listen for network changes
//       const unsubscribe = NetInfo.addEventListener((state) => {
//         setIsOnline(state.isConnected ?? false);
//       });

//       return () => unsubscribe();
//     };

//     init();
//   }, []);

//   useEffect(() => {
//     if (fruitData) {
//       try {
//         const parsedFruit = JSON.parse(fruitData as string);
//         setFruit(parsedFruit);
//         console.log("Fruit data:", parsedFruit);

//         // Check for existing harvest
//         checkExistingHarvest(parsedFruit.id);
//       } catch (error) {
//         console.error("Error parsing fruitData:", error);
//         setLoading(false);
//         setCheckingHarvest(false);
//       }
//     }
//   }, [fruitData]);

//   const checkExistingHarvest = async (fruitId: string) => {
//     try {
//       setCheckingHarvest(true);
//       const harvestDetails =
//         await HarvestService.getHarvestDetailsByFruitId(fruitId);

//       if (harvestDetails.harvest) {
//         setExistingHarvest(harvestDetails);
//         console.log("Existing harvest found:", harvestDetails);
//       }
//     } catch (error) {
//       console.error("Error checking existing harvest:", error);
//     } finally {
//       setLoading(false);
//       setCheckingHarvest(false);
//     }
//   };

//   const syncUnsyncedHarvests = async () => {
//     try {
//       // Get all unsynced harvests
//       const unsyncedHarvests = await HarvestService.getAllUnsyncedHarvests();

//       if (unsyncedHarvests.length === 0) {
//         console.log("No unsynced harvests to sync");
//         return { synced: 0, failed: 0 };
//       }

//       console.log(`Found ${unsyncedHarvests.length} unsynced harvests to sync`);

//       let syncedCount = 0;
//       let failedCount = 0;

//       // Sync each unsynced harvest
//       for (const harvestData of unsyncedHarvests) {
//         try {
//           const success = await HarvestService.syncCompleteHarvest(
//             harvestData.harvest.id,
//           );
//           if (success) {
//             syncedCount++;
//             console.log(
//               `Successfully synced harvest: ${harvestData.harvest.id}`,
//             );
//           } else {
//             failedCount++;
//             console.log(`Failed to sync harvest: ${harvestData.harvest.id}`);
//           }
//         } catch (error) {
//           failedCount++;
//           console.error(
//             `Error syncing harvest ${harvestData.harvest.id}:`,
//             error,
//           );
//         }
//       }

//       return { synced: syncedCount, failed: failedCount };
//     } catch (error) {
//       console.error("Error in syncUnsyncedHarvests:", error);
//       return { synced: 0, failed: 0 };
//     }
//   };

//   // Refresh function
//   const onRefresh = useCallback(async () => {
//     setRefreshing(true);

//     try {
//       // Check network status
//       const netInfo = await NetInfo.fetch();
//       setIsOnline(netInfo.isConnected ?? false);

//       let syncResults = { synced: 0, failed: 0 };

//       // If online, sync unsynced harvests first
//       if (netInfo.isConnected) {
//         console.log("Online - syncing unsynced harvests...");
//         syncResults = await syncUnsyncedHarvests();
//       }

//       // Refresh existing harvest data if fruit exists
//       if (fruit?.id) {
//         console.log("Refreshing harvest data for fruit:", fruit.id);
//         const harvestDetails = await HarvestService.getHarvestDetailsByFruitId(
//           fruit.id,
//         );

//         if (harvestDetails.harvest) {
//           setExistingHarvest(harvestDetails);
//         }

//         // Show toast based on online status and sync results
//         if (netInfo.isConnected) {
//           if (syncResults.synced > 0) {
//             Toast.show({
//               type: "success",
//               text1: "Sync Complete",
//               text2: `Synced ${syncResults.synced} harvest${syncResults.synced > 1 ? "s" : ""} to server`,
//               position: "bottom",
//               visibilityTime: 3000,
//             });
//           } else if (syncResults.failed > 0) {
//             Toast.show({
//               type: "warning",
//               text1: "Sync Partial",
//               text2: `${syncResults.synced} synced, ${syncResults.failed} failed`,
//               position: "bottom",
//               visibilityTime: 3000,
//             });
//           } else {
//             Toast.show({
//               type: "success",
//               text1: "Refreshed",
//               text2: "All data is up to date",
//               position: "bottom",
//               visibilityTime: 2000,
//             });
//           }
//         } else {
//           Toast.show({
//             type: "info",
//             text1: "Offline Mode",
//             text2: "Showing locally saved data",
//             position: "bottom",
//             visibilityTime: 2000,
//           });
//         }
//       }
//     } catch (error) {
//       console.error("Error refreshing harvest:", error);
//       Toast.show({
//         type: "error",
//         text1: "Refresh Failed",
//         text2: "Could not refresh harvest data",
//         position: "bottom",
//       });
//     } finally {
//       setRefreshing(false);
//     }
//   }, [fruit?.id, isOnline]);

//   // Compute days remaining for harvest
//   const getHarvestStatus = () => {
//     const baggedDate = new Date(fruit?.bagged_at);
//     const harvestDate = new Date(baggedDate);
//     harvestDate.setDate(harvestDate.getDate() + 115);
//     const today = new Date();
//     const daysLeft = Math.ceil(
//       (harvestDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
//     );

//     return {
//       isReady: today >= harvestDate,
//       daysLeft: daysLeft > 0 ? daysLeft : 0,
//       harvestDate: harvestDate.toLocaleDateString(),
//     };
//   };

//   const handleAddRipeFruit = () => {
//     setRipeFruits([...ripeFruits, ""]);
//   };

//   const handleRipeWeightChange = (index: number, value: string) => {
//     if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
//       const newRipeFruits = [...ripeFruits];
//       newRipeFruits[index] = value;
//       setRipeFruits(newRipeFruits);
//     }
//   };

//   const handleRemoveRipeFruit = (index: number) => {
//     Alert.alert("Remove Fruit", "Remove this ripe fruit?", [
//       { text: "Cancel", style: "cancel" },
//       {
//         text: "Remove",
//         style: "destructive",
//         onPress: () => {
//           const newRipeFruits = ripeFruits.filter((_, i) => i !== index);
//           setRipeFruits(newRipeFruits);
//         },
//       },
//     ]);
//   };

//   // Waste handlers
//   const handleAddWaste = () => {
//     setEditingWasteIndex(null);
//     setWasteQuantity("");
//     setWasteReason("");
//     setShowWasteModal(true);
//   };

//   const handleEditWaste = (index: number) => {
//     setEditingWasteIndex(index);
//     setWasteQuantity(wasteItems[index].quantity);
//     setWasteReason(wasteItems[index].reason);
//     setShowWasteModal(true);
//   };

//   const handleSaveWaste = () => {
//     if (!wasteQuantity || parseInt(wasteQuantity) <= 0) {
//       Toast.show({
//         type: "error",
//         text1: "Invalid",
//         text2: "Please enter valid waste quantity",
//       });
//       return;
//     }

//     if (!wasteReason.trim()) {
//       Toast.show({
//         type: "error",
//         text1: "Invalid",
//         text2: "Please enter reason for waste",
//       });
//       return;
//     }

//     const totalWaste = wasteItems.reduce(
//       (sum, item) => sum + parseInt(item.quantity || "0"),
//       0,
//     );
//     const newTotalWaste =
//       totalWaste -
//       (editingWasteIndex !== null
//         ? parseInt(wasteItems[editingWasteIndex]?.quantity || "0")
//         : 0) +
//       parseInt(wasteQuantity);

//     if (ripeFruits.length + newTotalWaste > fruit.quantity) {
//       Toast.show({
//         type: "error",
//         text1: "Exceeds Limit",
//         text2: `Total (${ripeFruits.length} ripe + ${newTotalWaste} waste) exceeds ${fruit.quantity} fruits`,
//       });
//       return;
//     }

//     if (editingWasteIndex !== null) {
//       // Edit existing
//       const newWasteItems = [...wasteItems];
//       newWasteItems[editingWasteIndex] = {
//         quantity: wasteQuantity,
//         reason: wasteReason,
//       };
//       setWasteItems(newWasteItems);
//     } else {
//       // Add new
//       setWasteItems([
//         ...wasteItems,
//         { quantity: wasteQuantity, reason: wasteReason },
//       ]);
//     }

//     setShowWasteModal(false);
//   };

//   const handleRemoveWaste = (index: number) => {
//     Alert.alert("Remove Waste", "Remove this waste entry?", [
//       { text: "Cancel", style: "cancel" },
//       {
//         text: "Remove",
//         style: "destructive",
//         onPress: () => {
//           const newWasteItems = wasteItems.filter((_, i) => i !== index);
//           setWasteItems(newWasteItems);
//         },
//       },
//     ]);
//   };

//   const handleSubmitHarvest = async () => {
//     if (!fruit) return;

//     // Validate
//     if (ripeFruits.length === 0 && wasteItems.length === 0) {
//       Toast.show({
//         type: "error",
//         text1: "Invalid",
//         text2: "Please add at least one fruit",
//       });
//       return;
//     }

//     // Validate weights
//     for (let i = 0; i < ripeFruits.length; i++) {
//       if (!ripeFruits[i] || parseFloat(ripeFruits[i]) <= 0) {
//         Toast.show({
//           type: "error",
//           text1: "Invalid",
//           text2: `Please enter weight for ripe fruit #${i + 1}`,
//         });
//         return;
//       }
//     }

//     try {
//       setSubmitting(true);

//       // Convert data for service
//       const weightNumbers = ripeFruits.map((w) => parseFloat(w));

//       // Prepare wastes data as array
//       const wastesData = wasteItems.map((item) => ({
//         quantity: parseInt(item.quantity),
//         reason: item.reason,
//       }));

//       console.log("Wastes data to save:", wastesData); // Debug log

//       const ripeQuantity = ripeFruits.length;

//       const result = await HarvestService.completeHarvest(
//         fruit.id,
//         ripeQuantity,
//         weightNumbers,
//         wastesData, // Pass the array directly
//       );

//       console.log("Harvest result:", result); // Debug log

//       Toast.show({
//         type: "success",
//         text1: "Success",
//         text2: `Harvest recorded successfully${!result.synced ? " (offline mode)" : ""}`,
//       });

//       // Navigate back after success
//       setTimeout(() => {
//         router.back();
//       }, 1500);
//     } catch (error: any) {
//       console.error("Error saving harvest:", error);
//       Toast.show({
//         type: "error",
//         text1: "Failed",
//         text2: error.response?.data?.message || "Could not save harvest",
//       });
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const totalRipe = ripeFruits.length;
//   const totalWaste = wasteItems.reduce(
//     (sum, item) => sum + parseInt(item.quantity || "0"),
//     0,
//   );
//   const totalNow = totalRipe + totalWaste;
//   const remaining = fruit ? fruit.quantity - totalNow : 0;
//   const harvestStatus = fruit
//     ? getHarvestStatus()
//     : { isReady: false, daysLeft: 0, harvestDate: "" };

//   if (loading || checkingHarvest) {
//     return (
//       <View className="flex-1 justify-center items-center bg-gray-50">
//         <ActivityIndicator size="large" color="#059669" />
//         <Text className="mt-4 text-gray-600">
//           {checkingHarvest
//             ? "Checking existing harvest..."
//             : "Loading fruit data..."}
//         </Text>
//       </View>
//     );
//   }

//   if (!fruit) {
//     return (
//       <View className="flex-1 justify-center items-center bg-gray-50 p-4">
//         <AlertCircle size={48} color="#ef4444" />
//         <Text className="text-red-500 text-lg mt-2">No fruit data found</Text>
//         <TouchableOpacity
//           onPress={() => router.back()}
//           className="mt-4 bg-green-600 px-6 py-3 rounded-xl"
//         >
//           <Text className="text-white font-semibold">Go Back</Text>
//         </TouchableOpacity>
//       </View>
//     );
//   }

//   // If harvest already exists, show view-only mode
//   if (existingHarvest?.harvest) {
//     const {
//       harvest,
//       fruitWeights,
//       wastes,
//       totalWeight,
//       averageWeight,
//       totalWaste,
//     } = existingHarvest;

//     const allFruitWeightsSynced = fruitWeights.every(
//       (fw: any) => fw.is_synced === 1,
//     );
//     const allWastesSynced = wastes.every((w: any) => w.is_synced === 1);
//     const harvestSynced = harvest.is_synced === 1;
//     const allSynced = allFruitWeightsSynced && allWastesSynced && harvestSynced;

//     return (
//       <View className="flex-1 bg-gray-50">
//         {/* Header */}
//         <View className="bg-white pt-12 pb-4 px-4 shadow-sm border-b border-gray-200">
//           <View className="flex-row items-center justify-between">
//             <View className="flex-row items-center">
//               <TouchableOpacity
//                 onPress={() => router.back()}
//                 className="mr-3 p-2"
//               >
//                 <ArrowLeft size={24} color="#4b5563" />
//               </TouchableOpacity>
//               <View>
//                 <Text className="text-2xl font-bold text-gray-800">
//                   Harvest
//                 </Text>
//                 <Text className="text-gray-500 text-sm">
//                   View harvest record
//                 </Text>
//               </View>
//             </View>

//             {/* Status Badges - Online/Offline + Sync Status */}
//             <View className="flex-row items-center gap-2">
//               {/* Online/Offline Status */}
//               <View className="flex-row items-center bg-gray-100 px-3 py-1 rounded-full">
//                 {isOnline ? (
//                   <>
//                     <Wifi size={16} color="#059669" />
//                     <Text className="text-green-600 text-xs ml-1">Online</Text>
//                   </>
//                 ) : (
//                   <>
//                     <WifiOff size={16} color="#6b7280" />
//                     <Text className="text-gray-500 text-xs ml-1">Offline</Text>
//                   </>
//                 )}
//               </View>

//               {/* Sync Status Badge */}
//               <View
//                 className={`px-3 py-1 rounded-full ${allSynced ? "bg-green-100" : "bg-yellow-100"}`}
//               >
//                 <Text
//                   className={`text-xs font-medium ${allSynced ? "text-green-700" : "text-yellow-700"}`}
//                 >
//                   {allSynced ? "✓ All Synced" : "⏳ Pending Sync"}
//                 </Text>
//               </View>
//             </View>
//           </View>
//         </View>

//         <ScrollView
//           className="flex-1 p-4"
//           refreshControl={
//             <RefreshControl
//               refreshing={refreshing}
//               onRefresh={onRefresh}
//               colors={["#059669"]} // Android
//               tintColor="#059669" // iOS
//               title="Pull to refresh" // iOS
//               titleColor="#059669" // iOS
//             />
//           }
//         >
//           {/* Fruit Info Card */}
//           <View className="bg-white rounded-xl p-5 mb-4 shadow-sm border border-gray-100">
//             <Text className="text-gray-500 text-sm mb-3">FRUIT DETAILS</Text>

//             <View className="flex-row items-center mb-3">
//               <View className="bg-green-100 p-3 rounded-full">
//                 <Package size={24} color="#059669" />
//               </View>
//               <View className="ml-3 flex-1">
//                 <Text className="text-gray-800 font-semibold text-lg">
//                   {fruit.quantity} Fruit{fruit.quantity !== 1 ? "s" : ""}
//                 </Text>
//                 <Text className="text-gray-500 text-xs">
//                   Bagged: {new Date(fruit.bagged_at).toLocaleDateString()}
//                 </Text>
//               </View>
//             </View>

//             <View className="bg-gray-50 p-4 rounded-xl mt-2">
//               <View className="flex-row justify-between mb-2">
//                 <Text className="text-gray-600">Harvest ID:</Text>
//                 <Text className="text-gray-800 font-mono text-xs">
//                   {harvest.id.substring(0, 8)}...
//                 </Text>
//               </View>
//               <View className="flex-row justify-between mb-2">
//                 <Text className="text-gray-600">Harvest Date:</Text>
//                 <Text className="text-gray-800">
//                   {new Date().toLocaleDateString()}
//                 </Text>
//               </View>
//               <View className="flex-row justify-between items-center">
//                 <Text className="text-gray-600">Synced:</Text>
//                 <View
//                   className={`px-3 py-1 rounded-full ${harvest.is_synced ? "bg-green-100" : "bg-red-100"}`}
//                 >
//                   <Text
//                     className={`text-sm font-medium ${harvest.is_synced ? "text-green-800" : "text-red-800"}`}
//                   >
//                     {harvest.is_synced ? "Yes" : "No"}
//                   </Text>
//                 </View>
//               </View>
//             </View>
//           </View>

//           {/* Summary Card */}
//           <View className="bg-white rounded-xl p-5 mb-4 shadow-sm border border-gray-100">
//             <Text className="text-gray-500 text-sm mb-3">HARVEST SUMMARY</Text>

//             <View className="flex-row justify-between mb-2">
//               <Text className="text-gray-600">Total Fruits:</Text>
//               <Text className="font-semibold">{fruit.quantity}</Text>
//             </View>
//             <View className="flex-row justify-between mb-2">
//               <Text className="text-gray-600">Ripe Fruits:</Text>
//               <Text className="font-medium text-green-600">
//                 {fruitWeights.length}
//               </Text>
//             </View>
//             <View className="flex-row justify-between mb-2">
//               <Text className="text-gray-600">Total Weight:</Text>
//               <Text className="font-medium text-blue-600">
//                 {totalWeight.toFixed(2)} kg
//               </Text>
//             </View>
//             <View className="flex-row justify-between mb-2">
//               <Text className="text-gray-600">Average Weight:</Text>
//               <Text className="font-medium text-purple-600">
//                 {averageWeight.toFixed(2)} kg
//               </Text>
//             </View>

//             <View className="flex-row justify-between pt-2 border-t border-gray-200">
//               <Text className="text-gray-800 font-medium">Waste:</Text>
//               <Text className="font-bold text-red-600">{totalWaste}</Text>
//             </View>
//           </View>

//           {/* Ripe Fruits List */}
//           <View className="bg-white rounded-xl p-5 mb-4 shadow-sm border border-gray-100">
//             <View className="flex-row items-center mb-4">
//               <View className="bg-green-100 p-2 rounded-full mr-2">
//                 <Scale size={18} color="#059669" />
//               </View>
//               <Text className="text-gray-800 font-semibold">
//                 Ripe Fruits ({fruitWeights.length})
//               </Text>
//             </View>

//             {fruitWeights.map((weight: any, index: number) => (
//               <View
//                 key={`view-ripe-${index}`}
//                 className="flex-row items-center mb-3 p-2 bg-gray-50 rounded-xl"
//               >
//                 <View className="bg-green-100 w-8 h-8 rounded-full items-center justify-center mr-2">
//                   <Text className="text-green-700 font-medium text-xs">
//                     {index + 1}
//                   </Text>
//                 </View>
//                 <View className="flex-1 flex-row justify-between">
//                   <Text className="text-gray-700">Weight:</Text>
//                   <Text className="font-medium">{weight.weight} kg</Text>
//                 </View>
//                 <View className="ml-2 px-2 py-1 bg-gray-200 rounded-full">
//                   <Text className="text-xs">{weight.status}</Text>
//                 </View>
//               </View>
//             ))}
//           </View>

//           {/* Wastes List */}
//           {wastes.length > 0 && (
//             <View className="bg-white rounded-xl p-5 mb-4 shadow-sm border border-gray-100">
//               <View className="flex-row items-center mb-4">
//                 <View className="bg-red-100 p-2 rounded-full mr-2">
//                   <AlertCircle size={18} color="#ef4444" />
//                 </View>
//                 <Text className="text-gray-800 font-semibold">
//                   Wastes ({wastes.length})
//                 </Text>
//               </View>

//               {wastes.map((waste: any, index: number) => (
//                 <View
//                   key={`view-waste-${index}`}
//                   className="mb-3 p-3 bg-red-50 rounded-xl"
//                 >
//                   <View className="flex-row justify-between items-center">
//                     <View className="flex-row items-center flex-1">
//                       <View className="bg-red-200 w-6 h-6 rounded-full items-center justify-center mr-2">
//                         <Text className="text-red-700 font-medium text-xs">
//                           {index + 1}
//                         </Text>
//                       </View>
//                       <View className="flex-1">
//                         <Text className="text-gray-800 font-medium">
//                           {waste.waste_quantity} fruit
//                           {waste.waste_quantity !== 1 ? "s" : ""}
//                         </Text>
//                         <Text
//                           className="text-gray-600 text-xs"
//                           numberOfLines={1}
//                         >
//                           {waste.reason}
//                         </Text>
//                       </View>
//                     </View>
//                   </View>
//                 </View>
//               ))}
//             </View>
//           )}

//           {/* Back Button */}
//           <TouchableOpacity
//             onPress={() => router.back()}
//             className="py-4 rounded-xl mt-2 bg-gray-600 mb-6"
//           >
//             <Text className="text-center font-semibold text-white text-lg">
//               Go Back
//             </Text>
//           </TouchableOpacity>
//         </ScrollView>
//       </View>
//     );
//   }

//   // If no existing harvest, show the harvest form
//   return (
//     <View className="flex-1 bg-gray-50">
//       {/* Header */}
//       <View className="bg-white pt-12 pb-4 px-4 shadow-sm border-b border-gray-200">
//         <View className="flex-row items-center justify-between">
//           <View className="flex-row items-center">
//             <TouchableOpacity
//               onPress={() => router.back()}
//               className="mr-3 p-2"
//             >
//               <ArrowLeft size={24} color="#4b5563" />
//             </TouchableOpacity>
//             <View>
//               <Text className="text-2xl font-bold text-gray-800">Harvest</Text>
//               <Text className="text-gray-500 text-sm">
//                 Record fruit harvest
//               </Text>
//             </View>
//           </View>

//           {/* Online/Offline Status */}
//           <View className="flex-row items-center bg-gray-100 px-3 py-1 rounded-full">
//             {isOnline ? (
//               <>
//                 <Wifi size={16} color="#059669" />
//                 <Text className="text-green-600 text-xs ml-1">Online</Text>
//               </>
//             ) : (
//               <>
//                 <WifiOff size={16} color="#6b7280" />
//                 <Text className="text-gray-500 text-xs ml-1">Offline</Text>
//               </>
//             )}
//           </View>
//         </View>
//       </View>

//       <ScrollView
//         className="flex-1 p-4"
//         refreshControl={
//           <RefreshControl
//             refreshing={refreshing}
//             onRefresh={onRefresh}
//             colors={["#059669"]} // Android
//             tintColor="#059669" // iOS
//             title="Pull to refresh" // iOS
//             titleColor="#059669" // iOS
//           />
//         }
//       >
//         {/* Fruit Info Card */}
//         <View className="bg-white rounded-xl p-5 mb-4 shadow-sm border border-gray-100">
//           <Text className="text-gray-500 text-sm mb-3">FRUIT DETAILS</Text>

//           <View className="flex-row items-center mb-3">
//             <View className="bg-green-100 p-3 rounded-full">
//               <Package size={24} color="#059669" />
//             </View>
//             <View className="ml-3 flex-1">
//               <Text className="text-gray-800 font-semibold text-lg">
//                 {fruit.quantity} Fruit{fruit.quantity !== 1 ? "s" : ""}
//               </Text>
//               <Text className="text-gray-500 text-xs">
//                 Bagged: {new Date(fruit.bagged_at).toLocaleDateString()}
//               </Text>
//             </View>
//           </View>

//           <View className="bg-gray-50 p-4 rounded-xl mt-2">
//             <View className="flex-row justify-between mb-2">
//               <Text className="text-gray-600">Fruit ID:</Text>
//               <Text className="text-gray-800 font-mono text-xs">
//                 {fruit.id.substring(0, 8)}...
//               </Text>
//             </View>
//             <View className="flex-row justify-between">
//               <Text className="text-gray-600">Status:</Text>
//               <View
//                 className={`px-2 py-0.5 rounded-full ${harvestStatus.isReady ? "bg-green-100" : "bg-yellow-100"}`}
//               >
//                 <Text
//                   className={`text-xs font-medium ${harvestStatus.isReady ? "text-green-700" : "text-yellow-700"}`}
//                 >
//                   {harvestStatus.isReady
//                     ? "Ready to Harvest"
//                     : `${harvestStatus.daysLeft} days remaining`}
//                 </Text>
//               </View>
//             </View>
//             <View className="flex-row justify-between mt-2 pt-2 border-t border-gray-200">
//               <Text className="text-gray-600">Expected Harvest:</Text>
//               <Text className="text-gray-800">{harvestStatus.harvestDate}</Text>
//             </View>
//           </View>
//         </View>

//         {/* Progress Card */}
//         <View className="bg-white rounded-xl p-5 mb-4 shadow-sm border border-gray-100">
//           <Text className="text-gray-500 text-sm mb-3">HARVEST PROGRESS</Text>

//           <View className="flex-row justify-between mb-2">
//             <Text className="text-gray-600">Total Fruits:</Text>
//             <Text className="font-semibold">{fruit.quantity}</Text>
//           </View>
//           <View className="flex-row justify-between mb-2">
//             <Text className="text-gray-600">Ripe Fruits:</Text>
//             <Text className="font-medium text-green-600">{totalRipe}</Text>
//           </View>
//           <View className="flex-row justify-between mb-2">
//             <Text className="text-gray-600">Wasted Fruits:</Text>
//             <Text className="font-medium text-red-600">{totalWaste}</Text>
//           </View>
//           <View className="flex-row justify-between pt-2 border-t border-gray-200">
//             <Text className="text-gray-800 font-medium">Remaining:</Text>
//             <Text
//               className={`font-bold ${remaining > 0 ? "text-blue-600" : "text-gray-400"}`}
//             >
//               {remaining}
//             </Text>
//           </View>

//           {/* Progress Bar */}
//           <View className="h-2 bg-gray-200 rounded-full mt-3 overflow-hidden">
//             <View
//               className="h-full bg-green-500"
//               style={{ width: `${(totalNow / fruit.quantity) * 100}%` }}
//             />
//           </View>
//         </View>

//         {/* Ripe Fruits Section */}
//         <View className="bg-white rounded-xl p-5 mb-4 shadow-sm border border-gray-100">
//           <View className="flex-row justify-between items-center mb-4">
//             <View className="flex-row items-center">
//               <View className="bg-green-100 p-2 rounded-full mr-2">
//                 <Scale size={18} color="#059669" />
//               </View>
//               <Text className="text-gray-800 font-semibold">
//                 Ripe Fruits (with weights)
//               </Text>
//             </View>
//             <TouchableOpacity
//               onPress={handleAddRipeFruit}
//               disabled={remaining <= 0}
//               className={`flex-row items-center px-3 py-1.5 rounded-full ${
//                 remaining > 0 ? "bg-green-600" : "bg-gray-300"
//               }`}
//             >
//               <Plus size={16} color="white" />
//               <Text className="text-white text-xs ml-1">Add</Text>
//             </TouchableOpacity>
//           </View>

//           {ripeFruits.length === 0 ? (
//             <View className="border-2 border-dashed border-gray-200 rounded-xl p-6 items-center">
//               <Scale size={32} color="#9ca3af" />
//               <Text className="text-gray-500 mt-2">No ripe fruits added</Text>
//               <Text className="text-gray-400 text-xs mt-1">
//                 Tap Add to record ripe fruits
//               </Text>
//             </View>
//           ) : (
//             ripeFruits.map((weight, index) => (
//               <View
//                 key={`ripe-${index}`}
//                 className="flex-row items-center mb-3"
//               >
//                 <View className="bg-green-100 w-8 h-8 rounded-full items-center justify-center mr-2">
//                   <Text className="text-green-700 font-medium text-xs">
//                     R{index + 1}
//                   </Text>
//                 </View>
//                 <TextInput
//                   className="flex-1 border border-gray-300 rounded-xl px-4 py-3 bg-gray-50"
//                   placeholder="Weight (kg)"
//                   value={weight}
//                   onChangeText={(value) => handleRipeWeightChange(index, value)}
//                   keyboardType="numeric"
//                 />
//                 <Text className="mx-2 text-gray-600">kg</Text>
//                 <TouchableOpacity
//                   onPress={() => handleRemoveRipeFruit(index)}
//                   className="p-2"
//                 >
//                   <Trash2 size={18} color="#ef4444" />
//                 </TouchableOpacity>
//               </View>
//             ))
//           )}
//         </View>

//         {/* Waste Section */}
//         <View className="bg-white rounded-xl p-5 mb-4 shadow-sm border border-gray-100">
//           <View className="flex-row justify-between items-center mb-4">
//             <View className="flex-row items-center">
//               <View className="bg-red-100 p-2 rounded-full mr-2">
//                 <AlertCircle size={18} color="#ef4444" />
//               </View>
//               <Text className="text-gray-800 font-semibold">Wasted Fruits</Text>
//             </View>
//             <TouchableOpacity
//               onPress={handleAddWaste}
//               disabled={remaining <= 0}
//               className={`flex-row items-center px-3 py-1.5 rounded-full ${
//                 remaining > 0 ? "bg-red-500" : "bg-gray-300"
//               }`}
//             >
//               <Plus size={16} color="white" />
//               <Text className="text-white text-xs ml-1">Add</Text>
//             </TouchableOpacity>
//           </View>

//           {wasteItems.length === 0 ? (
//             <View className="border-2 border-dashed border-red-200 rounded-xl p-6 items-center">
//               <AlertCircle size={32} color="#9ca3af" />
//               <Text className="text-gray-500 mt-2">No waste recorded</Text>
//               <Text className="text-gray-400 text-xs mt-1">
//                 Tap Add to record wasted fruits
//               </Text>
//             </View>
//           ) : (
//             wasteItems.map((item, index) => (
//               <View
//                 key={`waste-${index}`}
//                 className="mb-3 p-3 bg-red-50 rounded-xl"
//               >
//                 <View className="flex-row justify-between items-center">
//                   <View className="flex-row items-center flex-1">
//                     <View className="bg-red-200 w-6 h-6 rounded-full items-center justify-center mr-2">
//                       <Text className="text-red-700 font-medium text-xs">
//                         W{index + 1}
//                       </Text>
//                     </View>
//                     <View className="flex-1">
//                       <Text className="text-gray-800 font-medium">
//                         {item.quantity} fruit{item.quantity !== "1" ? "s" : ""}
//                       </Text>
//                       <Text className="text-gray-600 text-xs" numberOfLines={1}>
//                         {item.reason}
//                       </Text>
//                     </View>
//                   </View>
//                   <View className="flex-row">
//                     <TouchableOpacity
//                       onPress={() => handleEditWaste(index)}
//                       className="px-2"
//                     >
//                       <Text className="text-blue-500 text-xs">Edit</Text>
//                     </TouchableOpacity>
//                     <TouchableOpacity
//                       onPress={() => handleRemoveWaste(index)}
//                       className="px-2"
//                     >
//                       <Text className="text-red-500 text-xs">Remove</Text>
//                     </TouchableOpacity>
//                   </View>
//                 </View>
//               </View>
//             ))
//           )}
//         </View>

//         {/* Submit Button */}
//         <TouchableOpacity
//           onPress={handleSubmitHarvest}
//           disabled={submitting || totalNow === 0}
//           className={`py-4 rounded-xl mt-2 ${
//             totalNow > 0 ? "bg-green-600" : "bg-gray-400"
//           }`}
//         >
//           {submitting ? (
//             <View className="flex-row items-center justify-center">
//               <ActivityIndicator size="small" color="white" />
//               <Text className="text-white font-semibold ml-2">Saving...</Text>
//             </View>
//           ) : (
//             <Text className="text-center font-semibold text-white text-lg">
//               ✓ Record Harvest
//             </Text>
//           )}
//         </TouchableOpacity>

//         {/* Info Note */}
//         <View className="mt-4 px-2 mb-6">
//           <Text className="text-xs text-gray-500 text-center">
//             Total ripe + waste should not exceed {fruit.quantity} fruits.
//             Remaining fruits can be harvested later.
//           </Text>
//         </View>
//       </ScrollView>

//       {/* Waste Modal */}
//       <Modal
//         animationType="slide"
//         transparent={true}
//         visible={showWasteModal}
//         onRequestClose={() => setShowWasteModal(false)}
//       >
//         <View className="flex-1 justify-center items-center bg-black/50">
//           <View className="bg-white rounded-xl p-6 w-11/12 max-w-md">
//             <View className="flex-row justify-between items-center mb-4">
//               <Text className="text-xl font-bold text-gray-800">
//                 {editingWasteIndex !== null ? "Edit Waste" : "Add Waste"}
//               </Text>
//               <TouchableOpacity onPress={() => setShowWasteModal(false)}>
//                 <X size={24} color="#6b7280" />
//               </TouchableOpacity>
//             </View>

//             <Text className="text-gray-700 font-medium mb-2">
//               Quantity <Text className="text-red-500">*</Text>
//             </Text>
//             <TextInput
//               className="border border-gray-300 rounded-xl px-4 py-3 mb-4"
//               placeholder="Number of wasted fruits"
//               value={wasteQuantity}
//               onChangeText={setWasteQuantity}
//               keyboardType="numeric"
//             />

//             <Text className="text-gray-700 font-medium mb-2">
//               Reason <Text className="text-red-500">*</Text>
//             </Text>
//             <TextInput
//               className="border border-gray-300 rounded-xl px-4 py-3 mb-6"
//               placeholder="e.g., damaged, rotten, pest"
//               value={wasteReason}
//               onChangeText={setWasteReason}
//               multiline
//               numberOfLines={3}
//               textAlignVertical="top"
//             />

//             <TouchableOpacity
//               className="bg-red-500 py-3 rounded-xl"
//               onPress={handleSaveWaste}
//             >
//               <Text className="text-center font-semibold text-white">
//                 {editingWasteIndex !== null ? "Update" : "Add"} Waste
//               </Text>
//             </TouchableOpacity>
//           </View>
//         </View>
//       </Modal>

//       <Toast />
//     </View>
//   );
// }

// app/harvest.tsx
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

export default function Harvest() {
  const router = useRouter();
  const { fruitData, harvestId } = useLocalSearchParams();

  const [fruit, setFruit] = useState<any>(null);
  const [harvestRecord, setHarvestRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  // Form states - for editing existing or creating new
  const [ripeFruits, setRipeFruits] = useState<string[]>([]); // weights ng ripe fruits
  const [wasteItems, setWasteItems] = useState<
    { quantity: string; reason: string }[]
  >([]);

  // For tracking existing data
  const [existingFruitWeights, setExistingFruitWeights] = useState<any[]>([]);
  const [existingWastes, setExistingWastes] = useState<any[]>([]);

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

      // Listen for network changes
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
        console.log("Fruit data:", parsedFruit);

        // Check for existing harvest
        checkExistingHarvest(parsedFruit.id);
      } catch (error) {
        console.error("Error parsing fruitData:", error);
        setLoading(false);
      }
    } else if (harvestId) {
      // If harvestId is provided directly, fetch harvest details
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

        // Load existing data into form
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
        console.log("Existing harvest found:", harvestDetails);

        // Load existing data into form
        await loadExistingHarvestData(harvestDetails.harvest.id);
      }
    } catch (error) {
      console.error("Error checking existing harvest:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingHarvestData = async (harvestId: string) => {
    try {
      // Get fruit weights
      const fruitWeights =
        await HarvestService.getFruitWeightsByHarvestId(harvestId);
      setExistingFruitWeights(fruitWeights);

      // Convert to form format
      if (fruitWeights.length > 0) {
        setRipeFruits(fruitWeights.map((fw: any) => fw.weight.toString()));
      }

      // Get wastes
      const wastes = await HarvestService.getWastesByHarvestId(harvestId);
      setExistingWastes(wastes);

      // Convert to form format
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
        console.log("No unsynced harvests to sync");
        return { synced: 0, failed: 0 };
      }

      console.log(`Found ${unsyncedHarvests.length} unsynced harvests to sync`);

      let syncedCount = 0;
      let failedCount = 0;

      for (const harvestData of unsyncedHarvests) {
        try {
          const success = await HarvestService.syncCompleteHarvest(
            harvestData.harvest.id,
          );
          if (success) {
            syncedCount++;
            console.log(
              `Successfully synced harvest: ${harvestData.harvest.id}`,
            );
          } else {
            failedCount++;
            console.log(`Failed to sync harvest: ${harvestData.harvest.id}`);
          }
        } catch (error) {
          failedCount++;
          console.error(
            `Error syncing harvest ${harvestData.harvest.id}:`,
            error,
          );
        }
      }

      return { synced: syncedCount, failed: failedCount };
    } catch (error) {
      console.error("Error in syncUnsyncedHarvests:", error);
      return { synced: 0, failed: 0 };
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      const netInfo = await NetInfo.fetch();
      setIsOnline(netInfo.isConnected ?? false);

      let syncResults = { synced: 0, failed: 0 };

      if (netInfo.isConnected) {
        console.log("Online - syncing unsynced harvests...");
        syncResults = await syncUnsyncedHarvests();
      }

      // Refresh current harvest data
      if (harvestRecord?.harvest?.id) {
        const harvestDetails = await HarvestService.getHarvestDetailsByFruitId(
          fruit.id,
        );

        if (harvestDetails.harvest) {
          setHarvestRecord(harvestDetails);
          await loadExistingHarvestData(harvestDetails.harvest.id);
        }
      }

      if (netInfo.isConnected) {
        if (syncResults.synced > 0) {
          Toast.show({
            type: "success",
            text1: "Sync Complete",
            text2: `Synced ${syncResults.synced} harvest${syncResults.synced > 1 ? "s" : ""} to server`,
            position: "bottom",
            visibilityTime: 3000,
          });
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
    const newTotalWaste =
      totalWaste -
      (editingWasteIndex !== null
        ? parseInt(wasteItems[editingWasteIndex]?.quantity || "0")
        : 0) +
      parseInt(wasteQuantity);

    if (ripeFruits.length + newTotalWaste > fruit.quantity) {
      Toast.show({
        type: "error",
        text1: "Exceeds Limit",
        text2: `Total (${ripeFruits.length} ripe + ${newTotalWaste} waste) exceeds ${fruit.quantity} fruits`,
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

  const handleUpdateHarvest = async () => {
    if (!fruit || !harvestRecord?.harvest) return;

    if (ripeFruits.length === 0 && wasteItems.length === 0) {
      Toast.show({
        type: "error",
        text1: "Invalid",
        text2: "Please add at least one fruit",
      });
      return;
    }

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

      const weightNumbers = ripeFruits.map((w) => parseFloat(w));
      const wastesData = wasteItems.map((item) => ({
        quantity: parseInt(item.quantity),
        reason: item.reason,
      }));

      const ripeQuantity = ripeFruits.length;

      // Use the new updateHarvest method
      const result = await HarvestService.updateHarvest(
        harvestRecord.harvest.id, // Pass the existing harvest ID
        ripeQuantity,
        weightNumbers,
        wastesData,
      );

      console.log("Harvest update result:", result);

      Toast.show({
        type: "success",
        text1: "Success",
        text2: `Harvest updated successfully${!result.synced ? " (offline mode)" : ""}`,
      });

      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (error: any) {
      console.error("Error updating harvest:", error);
      Toast.show({
        type: "error",
        text1: "Failed",
        text2: error.response?.data?.message || "Could not update harvest",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const totalRipe = ripeFruits.length;
  const totalWaste = wasteItems.reduce(
    (sum, item) => sum + parseInt(item.quantity || "0"),
    0,
  );
  const totalNow = totalRipe + totalWaste;
  const remaining = fruit ? fruit.quantity - totalNow : 0;
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
            title="Pull to refresh"
            titleColor="#059669"
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

          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-600">Total Fruits:</Text>
            <Text className="font-semibold">{fruit.quantity}</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-600">Ripe Fruits:</Text>
            <Text className="font-medium text-green-600">{totalRipe}</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-600">Wasted Fruits:</Text>
            <Text className="font-medium text-red-600">{totalWaste}</Text>
          </View>
          <View className="flex-row justify-between pt-2 border-t border-gray-200">
            <Text className="text-gray-800 font-medium">Remaining:</Text>
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
              style={{ width: `${(totalNow / fruit.quantity) * 100}%` }}
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
                Ripe Fruits (with weights)
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

          {ripeFruits.length === 0 ? (
            <View className="border-2 border-dashed border-gray-200 rounded-xl p-6 items-center">
              <Scale size={32} color="#9ca3af" />
              <Text className="text-gray-500 mt-2">No ripe fruits added</Text>
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
                    R{index + 1}
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
              <Text className="text-gray-800 font-semibold">Wasted Fruits</Text>
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

          {wasteItems.length === 0 ? (
            <View className="border-2 border-dashed border-red-200 rounded-xl p-6 items-center">
              <AlertCircle size={32} color="#9ca3af" />
              <Text className="text-gray-500 mt-2">No waste recorded</Text>
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
                        W{index + 1}
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
        <TouchableOpacity
          onPress={handleUpdateHarvest}
          disabled={submitting || totalNow === 0}
          className={`py-4 rounded-xl mt-2 ${
            totalNow > 0 ? "bg-green-600" : "bg-gray-400"
          }`}
        >
          {submitting ? (
            <View className="flex-row items-center justify-center">
              <ActivityIndicator size="small" color="white" />
              <Text className="text-white font-semibold ml-2">Updating...</Text>
            </View>
          ) : (
            <Text className="text-center font-semibold text-white text-lg">
              ✓ Update Harvest
            </Text>
          )}
        </TouchableOpacity>

        {/* Info Note */}
        <View className="mt-4 px-2 mb-6">
          <Text className="text-xs text-gray-500 text-center">
            Total ripe + waste should not exceed {fruit.quantity} fruits.
            Remaining fruits can be harvested later.
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

      <Toast />
    </View>
  );
}
