import { CREATE_NOTIFICATIONS_TABLE } from "@/database/schema";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as BackgroundFetch from "expo-background-fetch";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import * as SQLite from "expo-sqlite";
import * as TaskManager from "expo-task-manager";

const CHECK_TASK = "harvest-notification-check";
const db = SQLite.openDatabaseSync("kalangka.db");

// ==================== BACKGROUND TASK DEFINITION ====================
// MUST be defined before registerTaskAsync is called
TaskManager.defineTask(CHECK_TASK, async () => {
  console.log("🔥🔥🔥 BACKGROUND TASK FIRED AT:", new Date().toLocaleString());

  try {
    const service = new NotificationService();

    // ✅ Read from Redux Persist's AsyncStorage directly
    const persistedData = await AsyncStorage.getItem("persist:root");

    if (persistedData) {
      const parsedData = JSON.parse(persistedData);
      // redux-persist stores each reducer as a JSON string
      const authData = JSON.parse(parsedData.auth);

      if (authData?.user && authData?.isAuthenticated) {
        const user = authData.user;
        console.log(
          `👤 Background: Using persisted user - ${user.role} (${user.username || user.id})`,
        );
        await service.checkHarvests(user.role, user.id);
      } else {
        console.log("🔒 No authenticated user in persisted state");
        // Fallback: Check all users from database
        await service.checkAllUsersFromDatabase();
      }
    } else {
      console.log("📭 No persisted data found - checking all users from DB");
      await service.checkAllUsersFromDatabase();
    }

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

  // For foreground use only
  private isUserAuthenticated(): boolean {
    try {
      const { store } = require("@/redux/store");
      const state = store.getState();
      return state.auth.isAuthenticated && !!state.auth.user;
    } catch {
      return false;
    }
  }

  private getCurrentUser() {
    try {
      const { store } = require("@/redux/store");
      const state = store.getState();
      return state.auth.user;
    } catch {
      return null;
    }
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

  // Register background task
  private async registerBackgroundTask() {
    try {
      // Check if already registered
      const isRegistered = await TaskManager.isTaskRegisteredAsync(CHECK_TASK);
      if (isRegistered) {
        console.log("🔄 Background task already registered");
        return;
      }

      await BackgroundFetch.registerTaskAsync(CHECK_TASK, {
        minimumInterval: 60, // 1 minute for testing
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

  // ✅ NEW: Check all users from database (fallback for background)
  async checkAllUsersFromDatabase() {
    try {
      const users = await db.getAllAsync(`
        SELECT DISTINCT u.id, u.role, u.first_name, u.last_name 
        FROM users u 
        WHERE u.deleted_at IS NULL
        AND (
          u.role = 'admin' 
          OR EXISTS(
            SELECT 1 FROM harvests h 
            WHERE h.user_id = u.id 
            AND h.deleted_at IS NULL
          )
        )
      `);

      console.log(`👥 Background: Found ${users.length} users to check`);

      let checkedCount = 0;
      for (const user of users) {
        console.log(`  Checking ${user.role}: ${user.username || user.id}`);
        await this.checkHarvests(user.role, user.id);
        checkedCount++;
        // Small delay between users
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      console.log(`✅ Checked ${checkedCount}/${users.length} users`);
    } catch (error) {
      console.error("❌ Failed to check all users:", error);
    }
  }

  private async sendAdminSummaryNotification(
    title: string,
    message: string,
    totalUnassignedFruits: number,
    treeCount: number,
    counts: {
      approachingCount: number;
      readyCount: number;
      overdueCount: number;
    },
    trees: any[],
  ) {
    const notificationId = this.generateUUID();

    // Save to notifications table
    await db.runAsync(
      `INSERT INTO notifications (
      id, user_id, fruit_id, type, title, message, 
      days_until_return, scheduled_for, is_sent, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 1, datetime('now'))`,
      [notificationId, null, null, "admin_summary", title, message, 0],
    );

    // Send actual notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: message,
        data: {
          type: "admin_summary",
          notificationId,
          totalUnassignedFruits,
          treeCount,
          counts,
          trees: trees.map((t) => ({
            name: t.tree_name,
            count: t.fruit_count,
          })),
        },
        sound: true,
      },
      trigger: null,
    });

    console.log(`📨 [Admin] Sent summary: ${message.substring(0, 100)}...`);
  }

  private async sendUserSummaryNotification(
    title: string,
    message: string,
    totalHarvests: number,
    treeCount: number,
    counts: {
      approachingCount: number;
      readyCount: number;
      overdueCount: number;
    },
    treeNames: string[],
    userId: string,
  ) {
    const notificationId = this.generateUUID();

    // Save to notifications table
    await db.runAsync(
      `INSERT INTO notifications (
      id, user_id, fruit_id, type, title, message, 
      days_until_return, scheduled_for, is_sent, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 1, datetime('now'))`,
      [notificationId, userId, null, "user_summary", title, message, 0],
    );

    // Send actual notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: message,
        data: {
          type: "user_summary",
          notificationId,
          totalHarvests,
          treeCount,
          counts,
          treeNames,
        },
        sound: true,
      },
      trigger: null,
    });

    console.log(`📨 [User] Sent summary: ${message.substring(0, 100)}...`);
  }

  // Handle notification tap
  private async handleNotificationOpened(response: any) {
    if (!this.isUserAuthenticated()) {
      console.log("🔒 Notification tap ignored - user not authenticated");
      return;
    }

    const data = response.notification.request.content.data;
    const user = this.getCurrentUser();

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
        pathname: "/users/assigned",
        params: { treeId: data.treeId },
      });
    } else if (data?.type === "admin_summary") {
      if (user?.role === "admin") {
        router.push({
          pathname: "/admin/assign",
        });
      } else {
        console.log("🔒 Non-admin user tapped admin notification");
      }
    } else if (data?.type === "user_summary") {
      if (user?.role === "user") {
        router.push({
          pathname: "/users/assigned",
        });
      } else {
        console.log("🔒 Non-user tapped user notification");
      }
    }
  }

  // Helper function to calculate days between two dates
  private calculateDaysBetween(date1: string, date2: Date): number {
    const d1 = new Date(date1);
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
  async checkHarvests(userRole?: string, userId?: string) {
    let role = userRole;
    let uid = userId;

    // Try Redux first (foreground)
    if (!role || !uid) {
      const user = this.getCurrentUser();
      if (user && this.isUserAuthenticated()) {
        role = user.role;
        uid = user.id;
      }
    }

    // Try AsyncStorage if Redux failed (background)
    if (!role || !uid) {
      try {
        const persistedData = await AsyncStorage.getItem("persist:root");
        if (persistedData) {
          const parsedData = JSON.parse(persistedData);
          const authData = JSON.parse(parsedData.auth);
          if (authData?.user && authData?.isAuthenticated) {
            role = authData.user.role;
            uid = authData.user.id;
          }
        }
      } catch (error) {
        console.warn("Could not read persisted auth:", error);
      }
    }

    if (!role || !uid) {
      console.log("🔒 No authenticated user, skipping notification check");
      return;
    }

    console.log(
      "🔍 Checking harvests at:",
      new Date().toLocaleString(),
      "Role:",
      role,
      "UserID:",
      uid,
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

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

    const fruitsWithHarvest = fruits.filter((f: any) => f.harvest_id);
    const fruitsWithoutHarvest = fruits.filter((f: any) => !f.harvest_id);

    console.log(`📊 Total: ${fruits.length} fruits`);
    console.log(`   - May harvest: ${fruitsWithHarvest.length}`);
    console.log(`   - Walang harvest: ${fruitsWithoutHarvest.length}`);

    // For ADMIN
    if (role === "admin") {
      const unassignedFruits = fruitsWithoutHarvest;

      if (unassignedFruits.length === 0) {
        console.log("👑 No unassigned fruits to notify");
        return;
      }

      const treeSummary = new Map();
      let totalUnassignedCount = 0;
      let approachingCount = 0;
      let readyCount = 0;
      let overdueCount = 0;

      for (const fruit of unassignedFruits) {
        let days = this.calculateDaysBetween(fruit.bagged_at, today);

        if (fruit.farmer_extra_days && fruit.farmer_extra_days > 0) {
          if (fruit.next_check_date) {
            const nextCheck = new Date(fruit.next_check_date);
            nextCheck.setHours(0, 0, 0, 0);
            if (nextCheck > today) {
              continue;
            }
            const adjustedDate = new Date(fruit.bagged_at);
            adjustedDate.setDate(
              adjustedDate.getDate() + (fruit.farmer_extra_days || 0),
            );
            days = this.calculateDaysBetween(adjustedDate.toISOString(), today);
          }
        }

        if (days >= 115 && days < 120) {
          approachingCount += 1;
        } else if (days >= 120 && days < 125) {
          readyCount += 1;
        } else if (days >= 125) {
          overdueCount += 1;
        }

        if (days >= 115) {
          totalUnassignedCount += 1;

          if (!treeSummary.has(fruit.tree_id)) {
            treeSummary.set(fruit.tree_id, {
              tree_name: fruit.tree_name,
              fruit_count: 0,
              oldest_days: days,
            });
          }
          const tree = treeSummary.get(fruit.tree_id);
          tree.fruit_count += 1;
          tree.oldest_days = Math.min(tree.oldest_days, days);
        }
      }

      if (totalUnassignedCount === 0) {
        console.log("👑 No unassigned fruits ready for notification");
        return;
      }

      const existingNotification = await db.getFirstAsync(
        `SELECT * FROM notifications 
       WHERE user_id IS NULL 
       AND date(created_at) = date('now')
       AND type = 'admin_summary'`,
      );

      // if (existingNotification) {
      //   console.log("⏭️ Already sent admin summary today");
      //   return;
      // }

      let statusMessage = "";
      if (approachingCount > 0)
        statusMessage += `${approachingCount} approaching, `;
      if (readyCount > 0) statusMessage += `${readyCount} ready, `;
      if (overdueCount > 0) statusMessage += `${overdueCount} overdue, `;
      statusMessage = statusMessage.slice(0, -2);

      const title = "Assignment Needed";
      const message = `${totalUnassignedCount} unassigned fruit(s) ready from ${treeSummary.size} tree(s). ${statusMessage}`;

      await this.sendAdminSummaryNotification(
        title,
        message,
        totalUnassignedCount,
        treeSummary.size,
        { approachingCount, readyCount, overdueCount },
        Array.from(treeSummary.values()),
      );

      return;
    }

    // For USER
    if (role === "user" && uid) {
      const fruitsToProcess = fruitsWithHarvest.filter(
        (f: any) => f.assigned_user_id === uid,
      );

      console.log(
        `👤 User ${uid}: processing ${fruitsToProcess.length} assigned fruits`,
      );

      if (fruitsToProcess.length === 0) {
        console.log("👤 No assigned fruits to notify");
        return;
      }

      let totalHarvestsCount = 0;
      let approachingCount = 0;
      let readyCount = 0;
      let overdueCount = 0;
      const treeNames = new Set<string>();

      for (const fruit of fruitsToProcess) {
        let days = this.calculateDaysBetween(fruit.bagged_at, today);

        if (fruit.farmer_extra_days && fruit.farmer_extra_days > 0) {
          if (fruit.next_check_date) {
            const nextCheck = new Date(fruit.next_check_date);
            nextCheck.setHours(0, 0, 0, 0);
            if (nextCheck > today) {
              console.log(
                `⏭️ Fruit ${fruit.fruit_id} - babalikan pa sa ${fruit.next_check_date}`,
              );
              continue;
            }
            const adjustedDate = new Date(fruit.bagged_at);
            adjustedDate.setDate(
              adjustedDate.getDate() + (fruit.farmer_extra_days || 0),
            );
            days = this.calculateDaysBetween(adjustedDate.toISOString(), today);
          }
        }

        if (days >= 115) {
          totalHarvestsCount += 1;
          treeNames.add(fruit.tree_name);

          if (days >= 115 && days < 120) {
            approachingCount += 1;
          } else if (days >= 120 && days < 125) {
            readyCount += 1;
          } else if (days >= 125) {
            overdueCount += 1;
          }
        }
      }

      if (totalHarvestsCount === 0) {
        console.log("👤 No harvests ready for notification");
        return;
      }

      const existingNotification = await db.getFirstAsync(
        `SELECT * FROM notifications 
       WHERE user_id = ? 
       AND date(created_at) = date('now')
       AND type = 'user_summary'`,
        [uid],
      );

      // if (existingNotification) {
      //   console.log("⏭️ Already sent user summary today");
      //   return;
      // }

      let statusMessage = "";
      if (approachingCount > 0)
        statusMessage += `${approachingCount} approaching, `;
      if (readyCount > 0) statusMessage += `${readyCount} ready, `;
      if (overdueCount > 0) statusMessage += `${overdueCount} overdue, `;
      statusMessage = statusMessage.slice(0, -2);

      const title = "🌱 Harvest Reminder";
      const message = `You have ${totalHarvestsCount} harvest(s) ready. ${statusMessage}`;

      await this.sendUserSummaryNotification(
        title,
        message,
        totalHarvestsCount,
        treeNames.size,
        { approachingCount, readyCount, overdueCount },
        Array.from(treeNames),
        uid,
      );

      return;
    }
  }

  // ==================== OTHER METHODS (unchanged) ====================
  private async processTreeNotification(
    tree: any,
    today: Date,
    userRole?: string,
    userId?: string,
  ) {
    const oldestDays = tree.min_days;
    const fruitCount = tree.fruit_count;
    const totalFruits = tree.total_fruits;

    if (oldestDays < 115) {
      return;
    }

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
      query += ` AND user_id IS NULL`;
    }

    const notifiedToday = await db.getFirstAsync(query, params);

    if (notifiedToday) {
      console.log(`⏭️ Already notified tree ${tree.tree_name} today`);
      return;
    }

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
        userRole === "admin" ? null : userId,
      );
    }
  }

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

    await db.runAsync(
      `INSERT INTO notifications (
        id, user_id, fruit_id, type, title, message, 
        days_until_return, scheduled_for, is_sent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 1, datetime('now'))`,
      [notificationId, userId, tree.fruit_ids[0], type, title, message, days],
    );

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
      trigger: null,
    });

    console.log(
      `📨 [${userId ? "User" : "Admin"}] Sent: ${title} for ${tree.tree_name}`,
    );
  }

  async sendTestBackgroundNotifications(count: number = 10) {
    if (!this.isUserAuthenticated()) {
      console.log("🔒 Cannot send test notifications - no authenticated user");
      return { success: false, message: "Not authenticated" };
    }
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

      await db.runAsync(
        `INSERT INTO notifications (
          id, user_id, fruit_id, type, title, message, 
          days_until_return, scheduled_for, is_sent, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 1, datetime('now'))`,
        [
          notificationId,
          null,
          fruitId,
          randomType,
          randomTitle,
          fullMessage,
          randomDays,
        ],
      );

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

    return result.sort((a: any, b: any) => b.oldest_days - a.oldest_days);
  }

  async manualCheck(userRole?: string, userId?: string) {
    console.log("🔍 Running manual check...");
    await this.clearTodayNotifications();
    await this.checkHarvests(userRole, userId);
    console.log("✅ Manual check completed");
  }
}

export default new NotificationService();
