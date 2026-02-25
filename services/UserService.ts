import { CREATE_USERS_TABLE_AND_INDEXES } from "@/database/schema";
import { User } from "@/types/index";
import client from "@/utils/axiosInstance";
import NetInfo from "@react-native-community/netinfo";
import * as SQLite from "expo-sqlite";

class UserService {
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitializing: boolean = false;
  private initPromise: Promise<boolean> | null = null;
  private syncInProgress: Set<string> = new Set();
  private hasSyncedFromServer: boolean = false;

  // Initialize database
  async init(): Promise<boolean> {
    if (this.db) return true;
    if (this.isInitializing && this.initPromise) {
      return await this.initPromise;
    }

    // Start initialization
    this.isInitializing = true;
    this.initPromise = this.performInit();
    return await this.initPromise;
  }

  private async performInit(): Promise<boolean> {
    try {
      // Use the new async API
      this.db = await SQLite.openDatabaseAsync("kalangka.db");

      // Create tables
      await this.db.execAsync(CREATE_USERS_TABLE_AND_INDEXES);

      console.log("User table initialized successfully!");
      this.isInitializing = false;
      return true;
    } catch (error) {
      console.error("Failed to initialize SQLite database:", error);
      this.isInitializing = false;
      this.initPromise = null;
      throw new Error(
        "Database initialization failed. Please restart the app.",
      );
    }
  }

  // Ensure database is ready before any operation
  private async ensureDatabaseReady(): Promise<void> {
    if (!this.db) {
      await this.init();
    }
  }

  private async userExistsOnServer(email: string): Promise<boolean> {
    try {
      const response = await client.post("/auth/check-email", {
        email: email,
      });

      console.log("userExistsOnServer response:", response.data);
      console.log("response.data.success:", response.data.success);
      console.log("response.data.exists:", response.data.exists);

      if (response.data.success) {
        const exists = response.data.exists === true; // Force boolean
        console.log("Returning exists:", exists);
        return exists;
      }
      return false;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return false;
      }
      console.error("Error checking if user exists on server:", error);
      return false;
    }
  }

  // Create a new user
  async createUser(
    userData: Omit<User, "id" | "created_at" | "updated_at" | "is_synced"> & {
      password: string;
    }, // ← Include password
  ): Promise<string> {
    await this.ensureDatabaseReady();

    const id = this.generateUUID();
    const now = new Date().toISOString();

    try {
      // Check if your table has password column
      // If wala pang password column sa table, kailangan mo i-update ang schema
      await this.db!.runAsync(
        `INSERT INTO users (id, first_name, last_name, email, gender, password, is_synced, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, // ← Added password
        [
          id,
          userData.first_name,
          userData.last_name,
          userData.email,
          userData.gender,
          userData.password, // ← Add password
          0, // is_synced = false initially
          now,
          now,
        ],
      );

      // Get the created user
      const newUser = await this.getUser(id);

      if (newUser) {
        // Check if online and sync immediately
        const netInfo = await NetInfo.fetch();
        if (netInfo.isConnected) {
          console.log(`📱 Online - Syncing new user ${id} to server...`);
          await this.syncUserToServer(newUser);
        } else {
          console.log(`📴 Offline - User ${id} saved locally, will sync later`);
        }
      }

      return id;
    } catch (error: any) {
      // Check for unique constraint violation
      if (
        error.message?.includes("UNIQUE constraint failed") ||
        error.message?.includes("unique constraint")
      ) {
        throw new Error("Email already exists. Please use a different email.");
      }

      console.error("Error creating user:", error);
      throw new Error("Failed to create user. Please try again.");
    }
  }

  // Sync users FROM server
  async syncUsersFromServer(): Promise<{ synced: number; errors: string[] }> {
    try {
      console.log("🔄 Starting user sync from server...");
      await this.ensureDatabaseReady();

      if (!this.db) {
        throw new Error("Database is not initialized");
      }

      const errors: string[] = [];
      let syncedCount = 0;

      // Call Laravel endpoint to get users
      const response = await client.get("/users");

      // Check response structure for Laravel pagination
      if (!response.data.success || !response.data.data) {
        throw new Error("Invalid response from server");
      }

      // Extract the users array from pagination data
      const remoteUsers = response.data.data.data; // response.data.data.data ang users array

      console.log(`📥 Found ${remoteUsers?.length || 0} users on server`);

      if (!remoteUsers || remoteUsers.length === 0) {
        console.log("No users found on server");
        return { synced: 0, errors: [] };
      }

      // Process each user
      for (const remoteUser of remoteUsers) {
        try {
          // Check if user already exists locally
          const existingUser = await this.getUser(remoteUser.id);

          if (!existingUser) {
            // New user - insert into local database
            await this.db!.runAsync(
              `INSERT INTO users (
              id, first_name, last_name, email, gender, 
              password, role, is_synced, created_at, updated_at, deleted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                remoteUser.id,
                remoteUser.first_name,
                remoteUser.last_name,
                remoteUser.email,
                remoteUser.gender,
                remoteUser.password || "",
                remoteUser.role || "user",
                1, // is_synced = true (from server)
                remoteUser.created_at,
                remoteUser.updated_at || remoteUser.created_at,
                null,
              ],
            );

            syncedCount++;
            console.log(`✅ Added user ${remoteUser.id} to local database`);
          } else {
            // User exists - check if server version is newer
            const localUpdatedAt = existingUser.updated_at?.getTime() || 0;
            const remoteUpdatedAt = new Date(remoteUser.updated_at).getTime();

            if (remoteUpdatedAt > localUpdatedAt) {
              // Update local user
              await this.db!.runAsync(
                `UPDATE users SET 
                first_name = ?, 
                last_name = ?, 
                email = ?, 
                gender = ?, 
                role = ?,
                is_synced = ?, 
                updated_at = ?
              WHERE id = ?`,
                [
                  remoteUser.first_name || existingUser.first_name,
                  remoteUser.last_name || existingUser.last_name,
                  remoteUser.email || existingUser.email,
                  remoteUser.gender || existingUser.gender,
                  remoteUser.role || existingUser.role || "user",
                  1, // Mark as synced
                  remoteUser.updated_at,
                  remoteUser.id,
                ],
              );

              syncedCount++;
              console.log(`✅ Updated user ${remoteUser.id} in local database`);
            }
          }
        } catch (userError: any) {
          const errorMsg = `User ${remoteUser.id}: ${userError.message}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      console.log(
        `✅ User sync completed: ${syncedCount} users synced, ${errors.length} errors`,
      );
      return { synced: syncedCount, errors };
    } catch (error: any) {
      console.error("❌ User sync failed:", error);
      throw new Error(`Failed to sync users: ${error.message}`);
    }
  }

  // Check if sync from server is needed
  async checkAndSync(): Promise<{ needsSync: boolean; userCount: number }> {
    try {
      const response = await client.get("/users");

      if (!response.data.success || !response.data.data) {
        return { needsSync: false, userCount: 0 };
      }

      // Extract users from pagination
      const remoteUsers = response.data.data.data || [];
      const localUsers = await this.getUsers();

      // Check if remote has more users or different count
      const needsSync = remoteUsers.length !== localUsers.length;

      return {
        needsSync,
        userCount: remoteUsers.length,
      };
    } catch (error) {
      console.error("Error checking sync status:", error);
      return { needsSync: false, userCount: 0 };
    }
  }

  // Get all users
  async getUsers(): Promise<User[]> {
    await this.ensureDatabaseReady();

    try {
      const result = await this.db!.getAllAsync(
        "SELECT * FROM users ORDER BY created_at DESC",
      );

      return result.map((user: any) => ({
        ...user,
        created_at: user.created_at ? new Date(user.created_at) : null,
        updated_at: user.updated_at ? new Date(user.updated_at) : null,
        is_synced: Boolean(user.is_synced),
      }));
    } catch (error) {
      console.error("Error fetching users:", error);
      throw new Error("Failed to fetch users. Please try again.");
    }
  }

  // Get a single user by ID
  async getUser(id: string): Promise<User | null> {
    await this.ensureDatabaseReady();

    try {
      const result = await this.db!.getFirstAsync(
        "SELECT * FROM users WHERE id = ?",
        [id],
      );

      if (!result) return null;

      return {
        ...result,
        created_at: result.created_at ? new Date(result.created_at) : null,
        updated_at: result.updated_at ? new Date(result.updated_at) : null,
        is_synced: Boolean(result.is_synced),
      };
    } catch (error) {
      console.error(`Error fetching user ${id}:`, error);
      throw new Error("Failed to fetch user. Please try again.");
    }
  }

  async updateUser(id: string, updates: Partial<User>): Promise<boolean> {
    await this.ensureDatabaseReady();

    const now = new Date().toISOString();

    try {
      // Build update query dynamically
      const allowedFields = ["first_name", "last_name", "email", "gender"];

      const fieldsToUpdate = Object.keys(updates).filter((key) =>
        allowedFields.includes(key),
      );

      if (fieldsToUpdate.length === 0) {
        throw new Error("No valid fields to update");
      }

      const setClauses = fieldsToUpdate.map((field) => `${field} = ?`);
      const values = fieldsToUpdate.map((field) => (updates as any)[field]);

      // Always update these fields
      setClauses.push("updated_at = ?");
      setClauses.push("is_synced = ?");
      values.push(now, 0); // updated_at, is_synced = false

      // Add ID for WHERE clause
      values.push(id);

      console.log(`Updating user ${id} with values:`, values);

      const query = `UPDATE users SET ${setClauses.join(", ")} WHERE id = ?`;

      await this.db!.runAsync(query, values);

      // Get updated user and sync
      const updatedUser = await this.getUser(id);
      if (updatedUser) {
        this.syncUserToServer(updatedUser);
      }

      return true;
    } catch (error: any) {
      // Check for unique constraint violation
      if (
        error.message?.includes("UNIQUE constraint failed") ||
        error.message?.includes("unique constraint")
      ) {
        throw new Error("Email already exists. Please use a different email.");
      }

      console.error(`Error updating user ${id}:`, error);
      throw new Error("Failed to update user. Please try again.");
    }
  }

  // Delete a user
  // Delete a user (soft delete muna)
  async deleteUser(id: string): Promise<boolean> {
    await this.ensureDatabaseReady();

    try {
      const now = new Date().toISOString();

      // Soft delete muna - set deleted_at
      await this.db!.runAsync(
        `UPDATE users SET deleted_at = ?, updated_at = ?, is_synced = 0 WHERE id = ?`,
        [now, now, id],
      );

      // Check if online to sync delete to server
      const netInfo = await NetInfo.fetch();
      if (netInfo.isConnected) {
        console.log(`📱 Online - Syncing delete for user ${id} to server...`);
        await this.syncDeleteToServer(id);
      } else {
        console.log(
          `📴 Offline - User ${id} marked as deleted locally, will sync delete when online`,
        );
      }

      return true;
    } catch (error) {
      console.error(`Error deleting user ${id}:`, error);
      throw new Error("Failed to delete user. Please try again.");
    }
  }

  // Get database statistics
  async getStats(): Promise<{
    total: number;
    male: number;
    female: number;
    other: number;
    synced: number;
    unsynced: number;
  }> {
    await this.ensureDatabaseReady();

    try {
      const stats = await this.db!.getAllAsync(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN gender = 'male' THEN 1 ELSE 0 END) as male,
          SUM(CASE WHEN gender = 'female' THEN 1 ELSE 0 END) as female,
          SUM(CASE WHEN gender NOT IN ('male', 'female') THEN 1 ELSE 0 END) as other,
          SUM(CASE WHEN is_synced = 1 THEN 1 ELSE 0 END) as synced,
          SUM(CASE WHEN is_synced = 0 THEN 1 ELSE 0 END) as unsynced
        FROM users
      `);

      return {
        total: stats[0]?.total || 0,
        male: stats[0]?.male || 0,
        female: stats[0]?.female || 0,
        other: stats[0]?.other || 0,
        synced: stats[0]?.synced || 0,
        unsynced: stats[0]?.unsynced || 0,
      };
    } catch (error) {
      console.error("Error getting users database stats:", error);
      return {
        total: 0,
        male: 0,
        female: 0,
        other: 0,
        synced: 0,
        unsynced: 0,
      };
    }
  }

  // Get unsynced users (including soft-deleted)
  async getUnsyncedUsers(): Promise<User[]> {
    await this.ensureDatabaseReady();

    try {
      // Get all users where is_synced = 0 (including soft-deleted)
      const result = await this.db!.getAllAsync(
        "SELECT * FROM users WHERE is_synced = 0 ORDER BY created_at ASC",
      );

      return result.map((user: any) => ({
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        gender: user.gender,
        role: user.role,
        password: user.password,
        is_synced: Boolean(user.is_synced),
        created_at: user.created_at ? new Date(user.created_at) : null,
        updated_at: user.updated_at ? new Date(user.updated_at) : null,
        deleted_at: user.deleted_at ? new Date(user.deleted_at) : null, // ← IMPORTANT: Include deleted_at
      }));
    } catch (error) {
      console.error("Error fetching unsynced users:", error);
      return [];
    }
  }

  // Sync all unsynced users (including soft-deleted)
  async syncAll(): Promise<void> {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log("📴 Offline - Cannot sync");
      return;
    }

    try {
      // First, sync local changes TO server
      const unsyncedUsers = await this.getUnsyncedUsers();
      console.log(`Found ${unsyncedUsers.length} unsynced users`);

      let deletedCount = 0;
      let syncedCount = 0;

      for (const user of unsyncedUsers) {
        if (user.deleted_at) {
          console.log(`🗑️ User ${user.id} is soft-deleted, syncing delete...`);
          await this.syncDeleteToServer(user.id);
          deletedCount++;
        } else {
          console.log(`📤 Syncing user ${user.id}...`);
          await this.syncUserToServer(user);
          syncedCount++;
        }
      }

      // Then, sync FROM server to get latest data
      if (!this.hasSyncedFromServer) {
        console.log("📥 Syncing latest users from server...");
        const { synced } = await this.syncUsersFromServer();
        if (synced > 0) {
          this.hasSyncedFromServer = true;
        }
      }

      console.log(
        `✅ Sync completed: ${syncedCount} users synced, ${deletedCount} users deleted`,
      );
    } catch (error) {
      console.error("❌ Full sync failed:", error);
    }
  }

  // Mark user as synced
  async markAsSynced(id: string): Promise<void> {
    await this.ensureDatabaseReady();

    try {
      await this.db!.runAsync(
        "UPDATE users SET is_synced = 1, updated_at = ? WHERE id = ?",
        [new Date().toISOString(), id],
      );
    } catch (error) {
      console.error(`Error marking user ${id} as synced:`, error);
    }
  }

  // Sync a user to server
  private async syncUserToServer(user: User): Promise<void> {
    if (this.isSyncInProgress(user.id)) {
      console.log(`⏸️ Sync already in progress for user ${user.id}, skipping`);
      return;
    }

    if (user.is_synced) {
      console.log(`✅ User ${user.id} already synced, skipping`);
      return;
    }

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log(
        `📴 Offline - User ${user.id} saved locally, will sync when online`,
      );
      return;
    }

    this.markSyncStart(user.id);

    try {
      const existingUser = await this.getUser(user.id);
      if (!existingUser) {
        console.log(`❌ User ${user.id} no longer exists, skipping sync`);
        return;
      }

      if (existingUser.is_synced) {
        console.log(`✅ User ${user.id} already synced during check, skipping`);
        return;
      }

      const payload = {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        gender: user.gender,
        role: (user as any).role || "user",
        password: user.password,
      };

      console.log("Payload to send:", payload);
      console.log(`📤 Syncing user ${user.id}...`);

      let response;
      let exists = false;

      try {
        // First try to find user by ID
        await client.get(`/users/${user.id}`);
        exists = true;
        console.log(`✅ User found by ID: ${user.id}`);
      } catch (idError: any) {
        if (idError.response?.status === 404) {
          // If not found by ID, check by email
          console.log(`User not found by ID, checking by email: ${user.email}`);
          exists = await this.userExistsOnServer(user.email);
          console.log(`User exists by email?`, exists);
        } else {
          throw idError;
        }
      }

      if (exists) {
        console.log(`✅ User exists, doing PUT to /users/${user.id}`);
        response = await client.put(`/users/${user.id}`, payload);
      } else {
        console.log(`❌ User does not exist, doing POST to /auth/register`);
        response = await client.post("/auth/register", payload);
      }

      console.log("Response status:", response.status);
      console.log("Response data:", response.data);

      if (response.status === 200 || response.status === 201) {
        await this.markAsSynced(user.id);
        console.log(`✅ User ${user.id} synced successfully`);
      }
    } catch (error: any) {
      console.error(
        `❌ Sync failed for user ${user.id}:`,
        error.response?.data || error.message,
      );

      // If duplicate key error, user already exists - mark as synced
      if (
        error.response?.status === 409 ||
        error.response?.data?.message?.includes("duplicate key") ||
        error.response?.data?.message?.includes("already exists")
      ) {
        console.log(
          `⚠️ User ${user.id} already exists on server, marking as synced`,
        );
        await this.markAsSynced(user.id);
      }
    } finally {
      this.markSyncFinish(user.id);
    }
  }

  // Sync delete to server
  private async syncDeleteToServer(id: string): Promise<void> {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log("📴 Offline - Delete will sync when online");
      return;
    }

    if (this.isSyncInProgress(`delete-${id}`)) {
      console.log(
        `⏸️ Delete sync already in progress for user ${id}, skipping`,
      );
      return;
    }

    this.markSyncStart(`delete-${id}`);

    try {
      console.log(`🗑️ Syncing DELETE for user ${id} to server...`);

      // Try to delete from server
      await client.delete(`/users/${id}`);

      console.log(`✅ User ${id} deleted from server successfully`);

      // After successful server deletion, permanently delete from local database
      await this.hardDeleteUser(id);
      console.log(`✅ User ${id} permanently removed from local database`);
    } catch (error: any) {
      console.error(
        `❌ Delete sync failed for user ${id}:`,
        error.response?.data || error.message,
      );

      // If user not found on server (404), we can safely delete locally
      if (error.response?.status === 404) {
        console.log(`⚠️ User ${id} not found on server, deleting locally`);
        await this.hardDeleteUser(id);
      } else {
        // Keep as soft-deleted to retry later
        console.log(`⚠️ Keeping user ${id} as soft-deleted for retry`);

        // Mark as unsynced to retry later (para i-retry sa susunod na sync)
        await this.markAsUnsynced(id);
      }
    } finally {
      this.markSyncFinish(`delete-${id}`);
    }
  }

  async markAsUnsynced(id: string): Promise<void> {
    await this.ensureDatabaseReady();

    try {
      await this.db!.runAsync(
        "UPDATE users SET is_synced = 0, updated_at = ? WHERE id = ?",
        [new Date().toISOString(), id],
      );
    } catch (error) {
      console.error(`Error marking user ${id} as unsynced:`, error);
    }
  }

  async hardDeleteUser(id: string): Promise<boolean> {
    await this.ensureDatabaseReady();

    try {
      await this.db!.runAsync(`DELETE FROM users WHERE id = ?`, [id]);
      console.log(`✅ User ${id} permanently deleted from local database`);
      return true;
    } catch (error) {
      console.error(`Error hard deleting user ${id}:`, error);
      throw new Error("Failed to permanently delete user.");
    }
  }

  // Clear all data (for testing)
  async clearDatabase(): Promise<void> {
    await this.ensureDatabaseReady();

    try {
      console.log("Starting users database cleanup...");

      await this.db?.execAsync("DELETE FROM users");
      console.log("All records deleted from users table");

      await this.db?.execAsync("DROP TABLE IF EXISTS users");
      console.log("Table 'users' dropped");

      try {
        await this.db?.execAsync("DROP INDEX IF EXISTS idx_users_email");
        await this.db?.execAsync("DROP INDEX IF EXISTS idx_users_synced");
        await this.db?.execAsync("DROP INDEX IF EXISTS idx_users_created");
        await this.db?.execAsync("DROP INDEX IF EXISTS idx_users_gender");
        console.log("Indexes dropped");
      } catch (indexError) {
        console.log("No indexes to drop or already dropped");
      }

      console.log("Users database completely cleared");
    } catch (error) {
      console.error("Error clearing users database:", error);
      throw new Error("Failed to clear users database.");
    }
  }

  // Helper methods for sync management
  private isSyncInProgress(id: string): boolean {
    return this.syncInProgress.has(id);
  }

  private markSyncStart(id: string): void {
    this.syncInProgress.add(id);
  }

  private markSyncFinish(id: string): void {
    this.syncInProgress.delete(id);
  }

  // Helper function to generate UUID
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
}

export default new UserService();
