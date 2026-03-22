import { CREATE_NOTIFICATIONS_TABLE } from "@/database/schema";
import { store } from "@/redux/store";
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

  // Add after generateUUID() method
  private isUserAuthenticated(): boolean {
    const state = store.getState();
    return state.auth.isAuthenticated && !!state.auth.user;
  }

  private getCurrentUser() {
    const state = store.getState();
    return state.auth.user;
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

  // Add this method to the NotificationService class
  private async sendAdminSummaryNotification(
    title: string,
    message: string,
    totalFruits: number,
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
      [
        notificationId,
        null, // null for admin
        null, // no specific fruit
        "admin_summary",
        title,
        message,
        0,
      ],
    );

    // Send actual notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: message,
        data: {
          type: "admin_summary",
          notificationId,
          totalFruits,
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

  // Add this method to the NotificationService class
  private async sendUserSummaryNotification(
    title: string,
    message: string,
    totalFruits: number,
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
      [
        notificationId,
        userId,
        null, // no specific fruit
        "user_summary",
        title,
        message,
        0,
      ],
    );

    // Send actual notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: message,
        data: {
          type: "user_summary",
          notificationId,
          totalFruits,
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
  private async handleNotificationOpened(response) {
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
      // For user notifications - go to tree details
      router.push({
        pathname: "/users/assigned",
        params: { treeId: data.treeId },
      });
    } else if (data?.type === "admin_summary") {
      // For admin summary notification - go to admin harvest screen
      if (user?.role === "admin") {
        router.push({
          pathname: "/admin/assign", // or wherever your admin harvest list is
        });
      } else {
        console.log("🔒 Non-admin user tapped admin notification");
      }
    } else if (data?.type === "user_summary") {
      if (user?.role === "user") {
        router.push({
          pathname: "/users/assigned", // or wherever user sees their assigned harvests
        });
      } else {
        console.log("🔒 Non-user tapped user notification");
      }
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
    let role = userRole;
    let uid = userId;

    if (!role || !uid) {
      const user = this.getCurrentUser();
      if (user && this.isUserAuthenticated()) {
        role = user.role;
        uid = user.id;
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

    // Separate fruits based on harvest record
    const fruitsWithHarvest = fruits.filter((f) => f.harvest_id);
    const fruitsWithoutHarvest = fruits.filter((f) => !f.harvest_id);

    console.log(`📊 Total: ${fruits.length} fruits`);
    console.log(`   - May harvest: ${fruitsWithHarvest.length}`);
    console.log(`   - Walang harvest: ${fruitsWithoutHarvest.length}`);

    // For ADMIN: Collect summary data instead of per-tree notifications
    if (role === "admin") {
      // Process unassigned fruits for summary
      const unassignedFruits = fruitsWithoutHarvest;

      if (unassignedFruits.length === 0) {
        console.log("👑 No unassigned fruits to notify");
        return;
      }

      // Group by tree to get tree names and counts
      const treeSummary = new Map();
      let totalFruitsCount = 0;
      let approachingCount = 0;
      let readyCount = 0;
      let overdueCount = 0;

      for (const fruit of unassignedFruits) {
        let days = this.calculateDaysBetween(fruit.bagged_at, today);

        // Handle extra days logic
        if (fruit.farmer_extra_days && fruit.farmer_extra_days > 0) {
          if (fruit.next_check_date) {
            const nextCheck = new Date(fruit.next_check_date);
            nextCheck.setHours(0, 0, 0, 0);
            if (nextCheck > today) {
              continue; // Skip if not yet ready for re-check
            }
            const adjustedDate = new Date(fruit.bagged_at);
            adjustedDate.setDate(
              adjustedDate.getDate() + (fruit.farmer_extra_days || 0),
            );
            days = this.calculateDaysBetween(adjustedDate.toISOString(), today);
          }
        }

        // Count fruits by status
        if (days >= 115 && days < 120) {
          approachingCount += fruit.quantity || fruit.remaining_quantity || 1;
        } else if (days >= 120 && days < 125) {
          readyCount += fruit.quantity || fruit.remaining_quantity || 1;
        } else if (days >= 125) {
          overdueCount += fruit.quantity || fruit.remaining_quantity || 1;
        }

        // Only count fruits that are 115+ days
        if (days >= 115) {
          totalFruitsCount += fruit.quantity || fruit.remaining_quantity || 1;

          if (!treeSummary.has(fruit.tree_id)) {
            treeSummary.set(fruit.tree_id, {
              tree_name: fruit.tree_name,
              fruit_count: 0,
              oldest_days: days,
            });
          }
          const tree = treeSummary.get(fruit.tree_id);
          tree.fruit_count += fruit.quantity || fruit.remaining_quantity || 1;
          tree.oldest_days = Math.min(tree.oldest_days, days);
        }
      }

      if (totalFruitsCount === 0) {
        console.log("👑 No fruits ready for notification");
        return;
      }

      // Check if already notified today
      const existingNotification = await db.getFirstAsync(
        `SELECT * FROM notifications 
       WHERE user_id IS NULL 
       AND date(created_at) = date('now')
       AND type = 'admin_summary'`,
      );

      if (existingNotification) {
        console.log("⏭️ Already sent admin summary today");
        return;
      }

      // Build the summary message
      const treeList = Array.from(treeSummary.values())
        .map((t) => `${t.tree_name} (${t.fruit_count} fruits)`)
        .join(", ");

      // Build the summary message - SHORT VERSION (no tree names)
      let statusMessage = "";
      if (approachingCount > 0)
        statusMessage += `${approachingCount} approaching, `;
      if (readyCount > 0) statusMessage += `${readyCount} ready, `;
      if (overdueCount > 0) statusMessage += `${overdueCount} overdue, `;
      statusMessage = statusMessage.slice(0, -2);

      const title = "Harvest Summary";
      const message = `${totalFruitsCount} unassigned fruit(s) ready from ${treeSummary.size} tree(s). ${statusMessage}`;

      await this.sendAdminSummaryNotification(
        title,
        message,
        totalFruitsCount,
        treeSummary.size,
        { approachingCount, readyCount, overdueCount },
        Array.from(treeSummary.values()),
      );

      return; // Admin done, don't process per-tree
    }

    // For USER: Continue with per-tree notifications
    // For USER: Send one summary notification
    if (role === "user" && uid) {
      // Process assigned fruits only
      const fruitsToProcess = fruitsWithHarvest.filter(
        (f) => f.assigned_user_id === uid,
      );

      console.log(
        `👤 User ${uid}: processing ${fruitsToProcess.length} assigned fruits`,
      );

      if (fruitsToProcess.length === 0) {
        console.log("👤 No assigned fruits to notify");
        return;
      }

      // Collect summary data for user
      let totalFruitsCount = 0;
      let approachingCount = 0;
      let readyCount = 0;
      let overdueCount = 0;
      const treeNames = new Set<string>();

      for (const fruit of fruitsToProcess) {
        let days = this.calculateDaysBetween(fruit.bagged_at, today);

        // Handle extra days logic
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

        // Only count fruits that are 115+ days
        if (days >= 115) {
          const fruitQuantity = fruit.quantity || fruit.remaining_quantity || 1;
          totalFruitsCount += fruitQuantity;
          treeNames.add(fruit.tree_name);

          // Count by status
          if (days >= 115 && days < 120) {
            approachingCount += fruitQuantity;
          } else if (days >= 120 && days < 125) {
            readyCount += fruitQuantity;
          } else if (days >= 125) {
            overdueCount += fruitQuantity;
          }
        }
      }

      if (totalFruitsCount === 0) {
        console.log("👤 No fruits ready for notification");
        return;
      }

      // Check if already notified today
      const existingNotification = await db.getFirstAsync(
        `SELECT * FROM notifications 
     WHERE user_id = ? 
     AND date(created_at) = date('now')
     AND type = 'user_summary'`,
        [uid],
      );

      if (existingNotification) {
        console.log("⏭️ Already sent user summary today");
        return;
      }

      // Build the summary message for user
      let statusMessage = "";
      if (approachingCount > 0)
        statusMessage += `${approachingCount} approaching, `;
      if (readyCount > 0) statusMessage += `${readyCount} ready, `;
      if (overdueCount > 0) statusMessage += `${overdueCount} overdue, `;
      statusMessage = statusMessage.slice(0, -2);

      const title = "🌱 Harvest Reminder";
      const message = `You have ${totalFruitsCount} fruit(s) to harvest. ${statusMessage}`;

      await this.sendUserSummaryNotification(
        title,
        message,
        totalFruitsCount,
        treeNames.size,
        { approachingCount, readyCount, overdueCount },
        Array.from(treeNames),
        uid,
      );

      return; // User done
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
    await this.clearTodayNotifications(); // TEMPORARY
    await this.checkHarvests(userRole, userId);
    console.log("✅ Manual check completed");
  }
}

// ==================== BACKGROUND TASK ====================
TaskManager.defineTask(CHECK_TASK, async () => {
  console.log("🔥🔥🔥 BACKGROUND TASK FIRED AT:", new Date().toLocaleString());

  try {
    const service = new NotificationService();

    // Get current user from Redux
    const state = store.getState();
    const user = state.auth.user;

    if (user) {
      // If user is logged in, run check with their role
      await service.checkHarvests(user.role, user.id);
    } else {
      console.log(
        "🔒 No user logged in, skipping background notification check",
      );
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

export default new NotificationService();
