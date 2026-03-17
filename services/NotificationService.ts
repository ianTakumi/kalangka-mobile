// // services/NotificationService.ts
// import { CREATE_NOTIFICATIONS_TABLE } from "@/database/schema";
// import * as BackgroundFetch from "expo-background-fetch";
// import * as Notifications from "expo-notifications";
// import { router } from "expo-router";
// import * as SQLite from "expo-sqlite";
// import * as TaskManager from "expo-task-manager";

// const CHECK_TASK = "harvest-notification-check";
// const db = SQLite.openDatabaseSync("kalangka.db");

// class NotificationService {
//   // Generate UUID for primary keys
//   private generateUUID(): string {
//     return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
//       /[xy]/g,
//       function (c) {
//         const r = (Math.random() * 16) | 0;
//         const v = c === "x" ? r : (r & 0x3) | 0x8;
//         return v.toString(16);
//       },
//     );
//   }

//   private async createTables() {
//     try {
//       await db.execAsync(CREATE_NOTIFICATIONS_TABLE);
//       console.log("📁 Notifications table created/verified");
//     } catch (error) {
//       console.error("Error creating notifications table:", error);
//       throw error;
//     }
//   }

//   // Initialize everything
//   async init() {
//     await this.createTables();
//     await this.setupNotifications();
//     await this.registerBackgroundTask();
//     this.setupNotificationListeners();
//     console.log("✅ NotificationService ready");
//   }

//   // Setup notification settings
//   private async setupNotifications() {
//     await Notifications.requestPermissionsAsync();

//     Notifications.setNotificationHandler({
//       handleNotification: async () => ({
//         shouldShowAlert: true,
//         shouldPlaySound: true,
//       }),
//     });
//   }

//   // Register background task (every 6 hours)
//   private async registerBackgroundTask() {
//     try {
//       await BackgroundFetch.registerTaskAsync(CHECK_TASK, {
//         minimumInterval: 60,
//         // minimumInterval: 6 * 60 * 60, // Every 6 hours
//         stopOnTerminate: false,
//         startOnBoot: true,
//       });
//       console.log("🔄 Background task registered (every 6 hours)");
//     } catch (error) {
//       console.error("Failed to register background task:", error);
//     }
//   }

//   // Listen for notification taps
//   private setupNotificationListeners() {
//     Notifications.addNotificationResponseReceivedListener(
//       this.handleNotificationOpened.bind(this),
//     );
//   }

//   // Handle notification tap
//   private async handleNotificationOpened(response) {
//     const data = response.notification.request.content.data;

//     // Update notification as read
//     if (data?.notificationId) {
//       await db.runAsync(
//         `UPDATE notifications
//          SET is_read = 1, updated_at = datetime('now')
//          WHERE id = ?`,
//         [data.notificationId],
//       );
//     }

//     // Navigate based on type
//     if (
//       data?.type === "approaching" ||
//       data?.type === "ready" ||
//       data?.type === "overdue"
//     ) {
//       router.push({
//         pathname: "/users/tree",
//         params: { treeId: data.treeId },
//       });
//     }
//   }

//   // Helper function to calculate days between two dates (accurate)
//   private calculateDaysBetween(date1: string, date2: Date): number {
//     const d1 = new Date(date1);
//     // Set both to midnight UTC para consistent
//     const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
//     const utc2 = Date.UTC(
//       date2.getFullYear(),
//       date2.getMonth(),
//       date2.getDate(),
//     );

//     const diffTime = Math.abs(utc2 - utc1);
//     const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

//     return diffDays;
//   }

//   // MAIN FUNCTION: Check all fruits grouped by tree
//   async checkHarvests() {
//     console.log("🔍 Checking harvests at:", new Date().toLocaleString());

//     const today = new Date();
//     today.setHours(0, 0, 0, 0); // Midnight today

//     // Get all fruits with their tree info (raw data, no calculations)
//     const fruits = await db.getAllAsync(`
//       SELECT
//         f.id as fruit_id,
//         f.bagged_at,
//         f.quantity,
//         f.farmer_extra_days,
//         f.farmer_assessed_at,
//         f.next_check_date,
//         t.id as tree_id,
//         t.description as tree_name
//       FROM fruits f
//       LEFT JOIN trees t ON f.tree_id = t.id
//       WHERE f.deleted_at IS NULL
//         AND f.status != 'harvested'
//     `);

//     // Group fruits by tree
//     const treeMap = new Map();

//     for (const fruit of fruits) {
//       // Calculate days in JavaScript (accurate)
//       const days = this.calculateDaysBetween(fruit.bagged_at, today);

//       if (!treeMap.has(fruit.tree_id)) {
//         treeMap.set(fruit.tree_id, {
//           tree_id: fruit.tree_id,
//           tree_name: fruit.tree_name,
//           fruits: [],
//           min_days: Infinity,
//           max_days: 0,
//           total_fruits: 0,
//           fruit_count: 0,
//           fruit_ids: [],
//         });
//       }

//       const treeData = treeMap.get(fruit.tree_id);
//       treeData.fruits.push({
//         ...fruit,
//         days: days,
//       });
//       treeData.min_days = Math.min(treeData.min_days, days);
//       treeData.max_days = Math.max(treeData.max_days, days);
//       treeData.total_fruits += fruit.quantity;
//       treeData.fruit_count++;
//       treeData.fruit_ids.push(fruit.fruit_id);
//     }

//     console.log(`📊 Found ${treeMap.size} trees with fruits to check`);

//     // Process each tree
//     for (const [treeId, treeData] of treeMap) {
//       await this.processTree(treeData, today);
//     }
//   }

//   // ADD THIS METHOD - FOR TESTING BACKGROUND NOTIFICATIONS
//   async sendTestBackgroundNotifications(count: number = 10) {
//     console.log(`🧪 Sending ${count} test background notifications...`);

//     const titles = [
//       "🌱 Harvest Reminder",
//       "🌳 Tree Update",
//       "🍎 Fruit Ready",
//       "📋 Check Your Trees",
//       "⏰ Harvest Schedule",
//       "🌿 Farm Update",
//       "🍌 Fruit Alert",
//       "🌴 Tree Notification",
//       "🥭 Harvest Time",
//       "🍊 Fruit Ready to Pick",
//     ];

//     const messages = [
//       "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
//       "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
//       "Ut enim ad minim veniam, quis nostrud exercitation ullamco.",
//       "Duis aute irure dolor in reprehenderit in voluptate velit esse.",
//       "Excepteur sint occaecat cupidatat non proident.",
//       "Nunc sed augue lacus viverra vitae congue eu consequat.",
//       "Pellentesque habitant morbi tristique senectus et netus.",
//       "Faucibus turpis in eu mi bibendum neque egestas congue.",
//       "Commodo elit at imperdiet dui accumsan sit amet nulla.",
//       "Gravida arcu ac tortor dignissim convallis aenean et tortor.",
//       "Purus ut faucibus pulvinar elementum integer enim neque.",
//       "Ullamcorper velit sed ullamcorper morbi tincidunt ornare.",
//       "Dignissim convallis aenean et tortor at risus viverra.",
//       "Libero id faucibus nisl tincidunt eget nullam non.",
//       "Vitae tortor condimentum lacinia quis vel eros donec.",
//     ];

//     const treeNames = [
//       "Mangga",
//       "Santol",
//       "Bayabas",
//       "Saging",
//       "Papaya",
//       "Atis",
//       "Langka",
//       "Rambutan",
//       "Lansones",
//       "Durian",
//       "Coconut",
//       "Kalamansi",
//       "Avocado",
//       "Guyabano",
//       "Chico",
//     ];

//     for (let i = 0; i < count; i++) {
//       const randomTitle = titles[Math.floor(Math.random() * titles.length)];
//       const randomMessage =
//         messages[Math.floor(Math.random() * messages.length)];
//       const randomTree =
//         treeNames[Math.floor(Math.random() * treeNames.length)];
//       const randomType = ["approaching", "ready", "overdue", "return_check"][
//         Math.floor(Math.random() * 4)
//       ];
//       const randomDays = Math.floor(Math.random() * 30) + 100; // 100-130 days
//       const randomFruitCount = Math.floor(Math.random() * 8) + 1; // 1-8 fruits
//       const randomTotalFruits =
//         randomFruitCount * (Math.floor(Math.random() * 3) + 1); // 1-24 total

//       const notificationId = this.generateUUID();
//       const treeId = this.generateUUID();
//       const fruitId = this.generateUUID();

//       // Create message with tree name
//       const fullMessage = `${randomTree}: ${randomMessage} (${randomFruitCount} fruits, ~${randomDays} days)`;

//       // Save to notifications table
//       await db.runAsync(
//         `INSERT INTO notifications (
//         id, user_id, fruit_id, type, title, message,
//         days_until_return, scheduled_for, is_sent, created_at
//       ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 1, datetime('now'))`,
//         [
//           notificationId,
//           null, // no user_id for test
//           fruitId,
//           randomType,
//           randomTitle,
//           fullMessage,
//           randomDays,
//         ],
//       );

//       // Send actual notification
//       await Notifications.scheduleNotificationAsync({
//         content: {
//           title: randomTitle,
//           body: fullMessage,
//           data: {
//             treeId,
//             treeName: randomTree,
//             type: randomType,
//             notificationId,
//             days: randomDays,
//             fruitCount: randomFruitCount,
//             totalFruits: randomTotalFruits,
//             isTest: true,
//           },
//           sound: true,
//         },
//         trigger: null, // show immediately
//       });

//       console.log(
//         `📨 [${i + 1}/${count}] Sent: ${randomTitle} - ${randomTree}`,
//       );

//       // Small delay para hindi ma-overwhelm ang system
//       await new Promise((resolve) => setTimeout(resolve, 300));
//     }

//     console.log(`✅ Successfully sent ${count} test background notifications!`);

//     return {
//       success: true,
//       count,
//       message: `${count} test notifications sent`,
//     };
//   }

//   // Process tree for notifications
//   private async processTree(tree: any, today: Date) {
//     const todayStr = today.toDateString();

//     // Get the oldest fruit's age
//     const oldestDays = tree.min_days;
//     const fruitCount = tree.fruit_count;
//     const totalFruits = tree.total_fruits;

//     console.log(
//       `🌳 Tree ${tree.tree_name}: ${fruitCount} fruits, oldest is ${oldestDays} days`,
//     );

//     // Check if may notification na ngayong araw para sa tree na ito
//     const placeholders = tree.fruit_ids.map(() => "?").join(",");
//     const notifiedToday = await db.getFirstAsync(
//       `SELECT * FROM notifications
//        WHERE fruit_id IN (${placeholders})
//        AND date(created_at) = date('now')
//        LIMIT 1`,
//       tree.fruit_ids,
//     );

//     if (notifiedToday) {
//       console.log(`⏭️ Already notified for tree ${tree.tree_name} today`);
//       return;
//     }

//     // Determine notification type based on oldest fruit
//     let notificationType = null;
//     let title = "";
//     let message = "";

//     // DAY 115: 5 days before harvest
//     if (oldestDays >= 115 && oldestDays < 120) {
//       notificationType = "approaching";
//       title = "🌱 Harvest Approaching";
//       const daysLeft = 120 - oldestDays;
//       message = `Tree ${tree.tree_name} has ${fruitCount} fruit(s) (${totalFruits} total) that will be ready in about ${daysLeft} days. Please prepare for harvest.`;
//     }

//     // DAY 120: Ready to harvest
//     else if (oldestDays >= 120 && oldestDays < 125) {
//       notificationType = "ready";
//       title = "🌳 Ready to Harvest!";
//       message = `Tree ${tree.tree_name} now has ${fruitCount} fruit(s) (${totalFruits} total) ready for harvest. Please harvest within the next 5 days.`;
//     }

//     // DAY 125 and beyond: Overdue
//     else if (oldestDays >= 125) {
//       notificationType = "overdue";
//       title = "⚠️ Harvest Overdue";
//       const daysOverdue = oldestDays - 120;
//       message = `Tree ${tree.tree_name} has ${fruitCount} fruit(s) (${totalFruits} total) that are ${daysOverdue} days overdue. Please harvest as soon as possible.`;
//     }

//     if (notificationType) {
//       await this.sendTreeNotification(
//         tree.tree_id,
//         tree.tree_name,
//         notificationType,
//         title,
//         message,
//         oldestDays,
//         fruitCount,
//         totalFruits,
//         tree.fruit_ids,
//       );
//     }
//   }

//   // Send tree-based notification
//   private async sendTreeNotification(
//     treeId: string,
//     treeName: string,
//     type: string,
//     title: string,
//     message: string,
//     days: number,
//     fruitCount: number,
//     totalFruits: number,
//     fruitIds: string[],
//   ) {
//     const notificationId = this.generateUUID();

//     // Get any user_id associated with these fruits
//     const firstFruitId = fruitIds[0];
//     const harvest = await db.getFirstAsync<{ user_id: string }>(
//       "SELECT user_id FROM harvests WHERE fruit_id = ? ORDER BY created_at DESC LIMIT 1",
//       [firstFruitId],
//     );

//     // Save to notifications table
//     await db.runAsync(
//       `INSERT INTO notifications (
//         id, user_id, fruit_id, type, title, message,
//         days_until_return, scheduled_for, is_sent, created_at
//       ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 1, datetime('now'))`,
//       [
//         notificationId,
//         harvest?.user_id || null,
//         firstFruitId,
//         type,
//         title,
//         message,
//         days,
//       ],
//     );

//     // Send actual notification
//     await Notifications.scheduleNotificationAsync({
//       content: {
//         title,
//         body: message,
//         data: {
//           treeId,
//           treeName,
//           type,
//           notificationId,
//           days,
//           fruitCount,
//           totalFruits,
//         },
//         sound: true,
//       },
//       trigger: null,
//     });

//     console.log(`📨 Sent tree notification: ${title} for ${treeName}`);
//   }

//   // Send return notification (after farmer set extra days)
//   async sendTreeReturnNotification(
//     treeId: string,
//     treeName: string,
//     days: number,
//   ) {
//     const notificationId = this.generateUUID();

//     await Notifications.scheduleNotificationAsync({
//       content: {
//         title: "🌳 Time to Check Again",
//         body: `Tree ${treeName} needs checking after ${days} days. Please assess if fruits are ready.`,
//         data: {
//           treeId,
//           treeName,
//           type: "return_check",
//           notificationId,
//           days,
//         },
//         sound: true,
//       },
//       trigger: null,
//     });
//   }

//   // FARMER ASSESSMENT: For tree-based assessment
//   async saveTreeAssessment(treeId: string, extraDays: number, notes?: string) {
//     try {
//       const now = new Date();
//       const nextCheckDate = new Date();
//       nextCheckDate.setDate(nextCheckDate.getDate() + extraDays);

//       // Update all fruits under this tree with farmer assessment
//       await db.runAsync(
//         `UPDATE fruits
//          SET farmer_extra_days = ?,
//              farmer_assessed_at = datetime('now'),
//              next_check_date = ?,
//              farmer_notes = ?
//          WHERE tree_id = ? AND deleted_at IS NULL AND status != 'harvested'`,
//         [extraDays, nextCheckDate.toISOString(), notes || null, treeId],
//       );

//       // Get tree details
//       const tree = await db.getFirstAsync<{ description: string }>(
//         "SELECT description FROM trees WHERE id = ?",
//         [treeId],
//       );

//       // Send confirmation notification
//       await this.sendTreeReturnNotification(
//         treeId,
//         tree?.description || "Unknown",
//         extraDays,
//       );

//       console.log(
//         `✅ Tree assessment saved: ${extraDays} days for tree ${treeId}`,
//       );

//       return {
//         success: true,
//         nextCheckDate: nextCheckDate.toLocaleDateString(),
//       };
//     } catch (error) {
//       console.error("Error saving tree assessment:", error);
//       throw error;
//     }
//   }

//   async clearTodayNotifications() {
//     await db.runAsync(
//       `DELETE FROM notifications WHERE date(created_at) = date('now')`,
//     );
//     console.log("🗑️ Cleared today's notifications");
//   }

//   // Get pending assessments for trees
//   async getPendingTreeAssessments() {
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);

//     const trees = await db.getAllAsync(`
//       SELECT
//         t.id as tree_id,
//         t.description as tree_name,
//         COUNT(f.id) as fruit_count,
//         SUM(f.quantity) as total_fruits,
//         MIN(f.farmer_extra_days) as farmer_days,
//         MIN(f.next_check_date) as next_check_date
//       FROM trees t
//       LEFT JOIN fruits f ON f.tree_id = t.id AND f.deleted_at IS NULL AND f.status != 'harvested'
//       GROUP BY t.id
//       HAVING fruit_count > 0
//     `);

//     // Calculate days in JavaScript for each tree
//     const result = [];
//     for (const tree of trees) {
//       const fruits = await db.getAllAsync(
//         `SELECT bagged_at FROM fruits WHERE tree_id = ? AND deleted_at IS NULL AND status != 'harvested'`,
//         [tree.tree_id],
//       );

//       let minDays = Infinity;
//       for (const fruit of fruits) {
//         const days = this.calculateDaysBetween(fruit.bagged_at, today);
//         minDays = Math.min(minDays, days);
//       }

//       if (minDays >= 125 || tree.next_check_date) {
//         result.push({
//           ...tree,
//           oldest_days: minDays,
//         });
//       }
//     }

//     return result.sort((a, b) => b.oldest_days - a.oldest_days);
//   }

//   // Manual check (for testing)
//   async manualCheck() {
//     console.log("🔍 Running manual check...");
//     await this.clearTodayNotifications(); // TEMPORARY

//     await this.checkHarvests();
//     console.log("✅ Manual check completed");
//   }
// }

// // Register background task
// TaskManager.defineTask(CHECK_TASK, async () => {
//   try {
//     const service = new NotificationService();
//     await service.checkHarvests();
//     await service.sendTestBackgroundNotifications(5);
//     return BackgroundFetch.BackgroundFetchResult.NewData;
//   } catch (error) {
//     console.error("Background task failed:", error);
//     return BackgroundFetch.BackgroundFetchResult.Failed;
//   }
// });

// export default new NotificationService();

// services/NotificationService.ts
import { CREATE_NOTIFICATIONS_TABLE } from "@/database/schema";
import * as BackgroundFetch from "expo-background-fetch";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import * as SQLite from "expo-sqlite";
import * as TaskManager from "expo-task-manager";

const CHECK_TASK = "harvest-notification-check";
const db = SQLite.openDatabaseSync("kalangka.db");

class NotificationService {
  // Generate UUID for primary keys
  private generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
  }

  private async createTables() {
    try {
      await db.execAsync(CREATE_NOTIFICATIONS_TABLE);
      console.log("📁 Notifications table created/verified");
    } catch (error) {
      console.error("Error creating notifications table:", error);
      throw error;
    }
  }

  // Initialize everything
  async init() {
    await this.createTables();
    await this.setupNotifications();
    await this.registerBackgroundTask();
    this.setupNotificationListeners();
    console.log("✅ NotificationService ready");
  }

  // Setup notification settings
  private async setupNotifications() {
    await Notifications.requestPermissionsAsync();

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
      }),
    });
  }

  // Register background task (every 6 hours)
  private async registerBackgroundTask() {
    try {
      await BackgroundFetch.registerTaskAsync(CHECK_TASK, {
        minimumInterval: 60, // 1 minute for testing
        // minimumInterval: 6 * 60 * 60, // Every 6 hours (production)
        stopOnTerminate: false,
        startOnBoot: true,
      });
      console.log("🔄 Background task registered (every 1 minute for testing)");
    } catch (error) {
      console.error("Failed to register background task:", error);
    }
  }

  // Listen for notification taps
  private setupNotificationListeners() {
    Notifications.addNotificationResponseReceivedListener(
      this.handleNotificationOpened.bind(this),
    );
  }

  // Handle notification tap
  private async handleNotificationOpened(response) {
    const data = response.notification.request.content.data;

    // Update notification as read
    if (data?.notificationId) {
      await db.runAsync(
        `UPDATE notifications 
         SET is_read = 1, updated_at = datetime('now') 
         WHERE id = ?`,
        [data.notificationId],
      );
    }

    // Navigate based on type
    if (
      data?.type === "approaching" ||
      data?.type === "ready" ||
      data?.type === "overdue"
    ) {
      router.push({
        pathname: "/users/tree",
        params: { treeId: data.treeId },
      });
    }
  }

  // Helper function to calculate days between two dates (accurate)
  private calculateDaysBetween(date1: string, date2: Date): number {
    const d1 = new Date(date1);
    // Set both to midnight UTC para consistent
    const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
    const utc2 = Date.UTC(
      date2.getFullYear(),
      date2.getMonth(),
      date2.getDate(),
    );

    const diffTime = Math.abs(utc2 - utc1);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  // ==================== MAIN FUNCTION ====================
  // Check harvests with role-based filtering
  async checkHarvests(userRole?: string, userId?: string) {
    console.log(
      "🔍 Checking harvests at:",
      new Date().toLocaleString(),
      "Role:",
      userRole || "system",
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Midnight today

    // Get all fruits with their tree and harvest info
    const fruits = await db.getAllAsync(`
      SELECT 
        f.id as fruit_id,
        f.bagged_at,
        f.quantity,
        f.remaining_quantity,
        f.farmer_extra_days,
        f.farmer_assessed_at,
        f.next_check_date,
        f.farmer_notes,
        t.id as tree_id,
        t.description as tree_name,
        h.id as harvest_id,
        h.user_id as assigned_user_id,
        h.status as harvest_status
      FROM fruits f
      LEFT JOIN trees t ON f.tree_id = t.id
      LEFT JOIN harvests h ON f.id = h.fruit_id AND h.deleted_at IS NULL
      WHERE f.deleted_at IS NULL 
        AND f.status != 'harvested'
    `);

    // Separate fruits based on harvest record
    const fruitsWithHarvest = fruits.filter((f) => f.harvest_id);
    const fruitsWithoutHarvest = fruits.filter((f) => !f.harvest_id);

    console.log(`📊 Total: ${fruits.length} fruits`);
    console.log(`   - May harvest: ${fruitsWithHarvest.length}`);
    console.log(`   - Walang harvest: ${fruitsWithoutHarvest.length}`);

    // Determine which fruits to process based on role
    let fruitsToProcess = [];

    if (userRole === "admin") {
      // ADMIN: fruits na WALANG harvest record (unassigned)
      fruitsToProcess = fruitsWithoutHarvest;
      console.log(
        `👑 Admin: processing ${fruitsToProcess.length} unassigned fruits`,
      );
    } else if (userRole === "user" && userId) {
      // USER: fruits na MAY harvest record at assigned sa kanila
      fruitsToProcess = fruitsWithHarvest.filter(
        (f) => f.assigned_user_id === userId,
      );
      console.log(
        `👤 User ${userId}: processing ${fruitsToProcess.length} assigned fruits`,
      );
    } else {
      // SYSTEM/BACKGROUND: process all (for general checks)
      fruitsToProcess = fruits;
      console.log(`🔄 System: processing all ${fruitsToProcess.length} fruits`);
    }

    // Group by tree
    const treeMap = new Map();

    for (const fruit of fruitsToProcess) {
      // Calculate days considering farmer_extra_days
      let days = this.calculateDaysBetween(fruit.bagged_at, today);

      // Kung may farmer_extra_days, check kung dapat i-skip or i-recalculate
      if (fruit.farmer_extra_days && fruit.farmer_extra_days > 0) {
        if (fruit.next_check_date) {
          const nextCheck = new Date(fruit.next_check_date);
          nextCheck.setHours(0, 0, 0, 0);

          // Kung hindi pa lampas sa next_check_date, skip muna
          if (nextCheck > today) {
            console.log(
              `⏭️ Fruit ${fruit.fruit_id} - babalikan pa sa ${fruit.next_check_date}`,
            );
            continue;
          }

          // Kung lampas na, recalculate days from bagged_at + extra_days
          const adjustedDate = new Date(fruit.bagged_at);
          adjustedDate.setDate(
            adjustedDate.getDate() + (fruit.farmer_extra_days || 0),
          );
          days = this.calculateDaysBetween(adjustedDate.toISOString(), today);
          console.log(
            `🔄 Fruit ${fruit.fruit_id} - recalculated days: ${days}`,
          );
        }
      }

      if (!treeMap.has(fruit.tree_id)) {
        treeMap.set(fruit.tree_id, {
          tree_id: fruit.tree_id,
          tree_name: fruit.tree_name,
          fruits: [],
          min_days: Infinity,
          max_days: 0,
          total_fruits: 0,
          fruit_count: 0,
          fruit_ids: [],
          assigned_user_id: fruit.assigned_user_id,
          has_harvest: !!fruit.harvest_id,
        });
      }

      const treeData = treeMap.get(fruit.tree_id);
      treeData.fruits.push({ ...fruit, days });
      treeData.min_days = Math.min(treeData.min_days, days);
      treeData.max_days = Math.max(treeData.max_days, days);
      treeData.total_fruits += fruit.quantity || fruit.remaining_quantity || 0;
      treeData.fruit_count++;
      treeData.fruit_ids.push(fruit.fruit_id);
    }

    console.log(`📊 Processing ${treeMap.size} trees`);

    // Send notifications per tree
    for (const [treeId, treeData] of treeMap) {
      await this.processTreeNotification(treeData, today, userRole, userId);
    }
  }

  // Process tree notification with role-based logic
  private async processTreeNotification(
    tree: any,
    today: Date,
    userRole?: string,
    userId?: string,
  ) {
    const oldestDays = tree.min_days;
    const fruitCount = tree.fruit_count;
    const totalFruits = tree.total_fruits;

    // Check if dapat mag-notify based on days
    if (oldestDays < 115) {
      return; // Too early
    }

    // Check if may notification na today para sa tree na ito
    const placeholders = tree.fruit_ids.map(() => "?").join(",");
    let query = `
      SELECT * FROM notifications 
      WHERE fruit_id IN (${placeholders})
      AND date(created_at) = date('now')
    `;

    const params: any[] = [...tree.fruit_ids];

    if (userRole === "user" && userId) {
      query += ` AND user_id = ?`;
      params.push(userId);
    } else if (userRole === "admin") {
      query += ` AND user_id IS NULL`; // Admin notifications have no user
    }

    const notifiedToday = await db.getFirstAsync(query, params);

    if (notifiedToday) {
      console.log(`⏭️ Already notified tree ${tree.tree_name} today`);
      return;
    }

    // Determine notification type and message based on role
    let type = "";
    let title = "";
    let message = "";

    if (oldestDays >= 115 && oldestDays < 120) {
      type = "approaching";
      if (userRole === "admin") {
        title = "👑 New Fruit Available";
        message = `Tree ${tree.tree_name}: ${fruitCount} new fruit(s) will be ready in ${120 - oldestDays} days. Ready for assignment.`;
      } else {
        title = "🌱 Harvest Approaching";
        const daysLeft = 120 - oldestDays;
        message = `Tree ${tree.tree_name} has ${fruitCount} fruit(s) that will be ready in about ${daysLeft} days. Please prepare.`;
      }
    } else if (oldestDays >= 120 && oldestDays < 125) {
      type = "ready";
      if (userRole === "admin") {
        title = "👑 Ready for Assignment";
        message = `Tree ${tree.tree_name}: ${fruitCount} fruit(s) ready for harvest. Assign to a worker now.`;
      } else {
        title = "🌳 Ready to Harvest!";
        message = `Tree ${tree.tree_name} now has ${fruitCount} fruit(s) ready for harvest. Please harvest within 5 days.`;
      }
    } else if (oldestDays >= 125) {
      type = "overdue";
      const daysOverdue = oldestDays - 120;
      if (userRole === "admin") {
        title = "👑 Overdue Fruit";
        message = `Tree ${tree.tree_name}: ${fruitCount} fruit(s) ${daysOverdue} days overdue. Check and reassign if needed.`;
      } else {
        title = "⚠️ Harvest Overdue";
        message = `Tree ${tree.tree_name} has ${fruitCount} fruit(s) that are ${daysOverdue} days overdue. Harvest immediately!`;
      }
    }

    if (type) {
      // Add context about harvest status
      if (tree.has_harvest) {
        message += " (Assigned)";
      } else {
        message += " (Unassigned)";
      }

      await this.sendNotification(
        tree,
        type,
        title,
        message,
        oldestDays,
        fruitCount,
        totalFruits,
        userRole === "admin" ? null : userId, // Admin: no user_id, User: may user_id
      );
    }
  }

  // Send notification with proper user targeting
  private async sendNotification(
    tree: any,
    type: string,
    title: string,
    message: string,
    days: number,
    fruitCount: number,
    totalFruits: number,
    userId: string | null,
  ) {
    const notificationId = this.generateUUID();

    // Save to notifications table
    await db.runAsync(
      `INSERT INTO notifications (
        id, user_id, fruit_id, type, title, message, 
        days_until_return, scheduled_for, is_sent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 1, datetime('now'))`,
      [
        notificationId,
        userId, // null for admin, may value for user
        tree.fruit_ids[0],
        type,
        title,
        message,
        days,
      ],
    );

    // Send actual notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: message,
        data: {
          treeId: tree.tree_id,
          treeName: tree.tree_name,
          type,
          notificationId,
          days,
          fruitCount,
          totalFruits,
          role: userId ? "user" : "admin",
        },
        sound: true,
      },
      trigger: null, // show immediately
    });

    console.log(
      `📨 [${userId ? "User" : "Admin"}] Sent: ${title} for ${tree.tree_name}`,
    );
  }

  // ==================== TESTING METHODS ====================
  async sendTestBackgroundNotifications(count: number = 10) {
    console.log(`🧪 Sending ${count} test background notifications...`);

    const titles = [
      "🌱 Harvest Reminder",
      "🌳 Tree Update",
      "🍎 Fruit Ready",
      "📋 Check Your Trees",
      "⏰ Harvest Schedule",
      "🌿 Farm Update",
      "🍌 Fruit Alert",
      "🌴 Tree Notification",
      "🥭 Harvest Time",
      "🍊 Fruit Ready to Pick",
    ];

    const messages = [
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
      "Ut enim ad minim veniam, quis nostrud exercitation ullamco.",
      "Duis aute irure dolor in reprehenderit in voluptate velit esse.",
      "Excepteur sint occaecat cupidatat non proident.",
      "Nunc sed augue lacus viverra vitae congue eu consequat.",
      "Pellentesque habitant morbi tristique senectus et netus.",
      "Faucibus turpis in eu mi bibendum neque egestas congue.",
      "Commodo elit at imperdiet dui accumsan sit amet nulla.",
      "Gravida arcu ac tortor dignissim convallis aenean et tortor.",
    ];

    const treeNames = [
      "Mangga",
      "Santol",
      "Bayabas",
      "Saging",
      "Papaya",
      "Atis",
      "Langka",
      "Rambutan",
      "Lansones",
      "Durian",
      "Coconut",
      "Kalamansi",
      "Avocado",
      "Guyabano",
      "Chico",
    ];

    for (let i = 0; i < count; i++) {
      const randomTitle = titles[Math.floor(Math.random() * titles.length)];
      const randomMessage =
        messages[Math.floor(Math.random() * messages.length)];
      const randomTree =
        treeNames[Math.floor(Math.random() * treeNames.length)];
      const randomType = ["approaching", "ready", "overdue", "return_check"][
        Math.floor(Math.random() * 4)
      ];
      const randomDays = Math.floor(Math.random() * 30) + 100;
      const randomFruitCount = Math.floor(Math.random() * 8) + 1;
      const randomTotalFruits =
        randomFruitCount * (Math.floor(Math.random() * 3) + 1);

      const notificationId = this.generateUUID();
      const treeId = this.generateUUID();
      const fruitId = this.generateUUID();

      const fullMessage = `${randomTree}: ${randomMessage} (${randomFruitCount} fruits, ~${randomDays} days)`;

      // Save to notifications table
      await db.runAsync(
        `INSERT INTO notifications (
          id, user_id, fruit_id, type, title, message, 
          days_until_return, scheduled_for, is_sent, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 1, datetime('now'))`,
        [
          notificationId,
          null, // no user_id for test
          fruitId,
          randomType,
          randomTitle,
          fullMessage,
          randomDays,
        ],
      );

      // Send actual notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: randomTitle,
          body: fullMessage,
          data: {
            treeId,
            treeName: randomTree,
            type: randomType,
            notificationId,
            days: randomDays,
            fruitCount: randomFruitCount,
            totalFruits: randomTotalFruits,
            isTest: true,
          },
          sound: true,
        },
        trigger: null,
      });

      console.log(
        `📨 [${i + 1}/${count}] Sent: ${randomTitle} - ${randomTree}`,
      );
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    console.log(`✅ Successfully sent ${count} test background notifications!`);
    return {
      success: true,
      count,
      message: `${count} test notifications sent`,
    };
  }

  // ==================== ORIGINAL METHODS ====================
  async sendTreeReturnNotification(
    treeId: string,
    treeName: string,
    days: number,
  ) {
    const notificationId = this.generateUUID();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🌳 Time to Check Again",
        body: `Tree ${treeName} needs checking after ${days} days. Please assess if fruits are ready.`,
        data: {
          treeId,
          treeName,
          type: "return_check",
          notificationId,
          days,
        },
        sound: true,
      },
      trigger: null,
    });
  }

  async saveTreeAssessment(treeId: string, extraDays: number, notes?: string) {
    try {
      const nextCheckDate = new Date();
      nextCheckDate.setDate(nextCheckDate.getDate() + extraDays);

      await db.runAsync(
        `UPDATE fruits 
         SET farmer_extra_days = ?,
             farmer_assessed_at = datetime('now'),
             next_check_date = ?,
             farmer_notes = ?
         WHERE tree_id = ? AND deleted_at IS NULL AND status != 'harvested'`,
        [extraDays, nextCheckDate.toISOString(), notes || null, treeId],
      );

      const tree = await db.getFirstAsync<{ description: string }>(
        "SELECT description FROM trees WHERE id = ?",
        [treeId],
      );

      await this.sendTreeReturnNotification(
        treeId,
        tree?.description || "Unknown",
        extraDays,
      );

      return {
        success: true,
        nextCheckDate: nextCheckDate.toLocaleDateString(),
      };
    } catch (error) {
      console.error("Error saving tree assessment:", error);
      throw error;
    }
  }

  async clearTodayNotifications() {
    await db.runAsync(
      `DELETE FROM notifications WHERE date(created_at) = date('now')`,
    );
    console.log("🗑️ Cleared today's notifications");
  }

  async getPendingTreeAssessments() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const trees = await db.getAllAsync(`
      SELECT 
        t.id as tree_id,
        t.description as tree_name,
        COUNT(f.id) as fruit_count,
        SUM(f.quantity) as total_fruits,
        MIN(f.farmer_extra_days) as farmer_days,
        MIN(f.next_check_date) as next_check_date
      FROM trees t
      LEFT JOIN fruits f ON f.tree_id = t.id AND f.deleted_at IS NULL AND f.status != 'harvested'
      GROUP BY t.id
      HAVING fruit_count > 0
    `);

    const result = [];
    for (const tree of trees) {
      const fruits = await db.getAllAsync(
        `SELECT bagged_at FROM fruits WHERE tree_id = ? AND deleted_at IS NULL AND status != 'harvested'`,
        [tree.tree_id],
      );

      let minDays = Infinity;
      for (const fruit of fruits) {
        const days = this.calculateDaysBetween(fruit.bagged_at, today);
        minDays = Math.min(minDays, days);
      }

      if (minDays >= 125 || tree.next_check_date) {
        result.push({ ...tree, oldest_days: minDays });
      }
    }

    return result.sort((a, b) => b.oldest_days - a.oldest_days);
  }

  async manualCheck(userRole?: string, userId?: string) {
    console.log("🔍 Running manual check...");
    // await this.clearTodayNotifications(); // TEMPORARY
    await this.checkHarvests(userRole, userId);
    console.log("✅ Manual check completed");
  }
}

// ==================== BACKGROUND TASK ====================
TaskManager.defineTask(CHECK_TASK, async () => {
  console.log("🔥🔥🔥 BACKGROUND TASK FIRED AT:", new Date().toLocaleString());

  try {
    const service = new NotificationService();

    // For background, process all fruits (system-wide)
    await service.checkHarvests();

    // Optional: send test notifications para ma-verify na gumagana
    // await service.sendTestBackgroundNotifications(2);

    console.log(
      "✅ Background task completed at:",
      new Date().toLocaleString(),
    );
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error("❌ Background task failed:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export default new NotificationService();
