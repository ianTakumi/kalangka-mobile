import * as SQLite from "expo-sqlite";
import client from "@/utils/axiosInstance";
import NetInfo from "@react-native-community/netinfo";
import { User } from "@/types/index";

class UserService {
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitializing: boolean = false;
  private initPromise: Promise<boolean> | null = null;
  private syncInProgress: Set<string> = new Set();

  // Initialize database
  async init(): Promise<boolean> {
    // If already initialized, return true
    if (this.db) return true;

    // If currently initializing, wait for it
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
      console.log("Initializing SQLite database...");

      // Use the new async API
      this.db = await SQLite.openDatabaseAsync("trees.db");

      // Create tables
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          gender TEXT NOT NULL,
          is_synced INTEGER DEFAULT 0,
          created_at TEXT,
          updated_at TEXT
        );
      `);

      // Add indexes for better performance
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_synced ON users(is_synced);
        CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at);
        CREATE INDEX IF NOT EXISTS idx_users_gender ON users(gender);
      `);

      console.log("SQLite database initialized successfully");
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

  // Create a new user
  async createUser(
    userData: Omit<User, "id" | "created_at" | "updated_at" | "is_synced">,
  ): Promise<string> {
    await this.ensureDatabaseReady();

    const id = this.generateUUID();
    const now = new Date().toISOString();

    try {
      await this.db!.runAsync(
        `INSERT INTO users (id, first_name, last_name, email, gender, is_synced, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          userData.first_name,
          userData.last_name,
          userData.email,
          userData.gender,
          0, // is_synced = false
          now,
          now,
        ],
      );

      // Get the created user and sync
      const newUser = await this.getUser(id);
      if (newUser) {
        await this.syncUserToServer(newUser);
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
  async deleteUser(id: string): Promise<boolean> {
    await this.ensureDatabaseReady();

    try {
      await this.db!.runAsync(`DELETE FROM users WHERE id = ?`, [id]);

      // Sync delete to server
      this.syncDeleteToServer(id);

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

  // Get unsynced users
  async getUnsyncedUsers(): Promise<User[]> {
    await this.ensureDatabaseReady();

    try {
      const result = await this.db!.getAllAsync(
        "SELECT * FROM users WHERE is_synced = 0 ORDER BY created_at ASC",
      );

      return result.map((user: any) => ({
        ...user,
        created_at: user.created_at ? new Date(user.created_at) : null,
        updated_at: user.updated_at ? new Date(user.updated_at) : null,
        is_synced: Boolean(user.is_synced),
      }));
    } catch (error) {
      console.error("Error fetching unsynced users:", error);
      return [];
    }
  }

  // Sync all unsynced users
  async syncAll(): Promise<void> {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log("Offline - Cannot sync");
      return;
    }

    try {
      const unsyncedUsers = await this.getUnsyncedUsers();

      for (const user of unsyncedUsers) {
        await this.syncUserToServer(user);
      }

      console.log(`Synced ${unsyncedUsers.length} users`);
    } catch (error) {
      console.error("Full sync failed:", error);
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
        created_at: user.created_at ? user.created_at.toISOString() : null,
        updated_at: user.updated_at ? user.updated_at.toISOString() : null,
        is_synced: true,
      };

      console.log(`📤 Syncing user ${user.id}...`);

      let response;
      try {
        await client.get(`/users/${user.id}`);
        response = await client.put(`/users/${user.id}`, payload);
      } catch (getError: any) {
        if (getError.response?.status === 404) {
          response = await client.post("/users", payload);
        } else {
          throw getError;
        }
      }

      if (response.status === 200 || response.status === 201) {
        await this.markAsSynced(user.id);
        console.log(`✅ User ${user.id} synced successfully`);
      }
    } catch (error: any) {
      console.error(
        `❌ Sync failed for user ${user.id}:`,
        error.response?.data || error.message,
      );

      if (error.response?.status === 409) {
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
      console.log("Offline - Delete will sync when online");
      return;
    }

    try {
      await client.delete(`/users/${id}`);
    } catch (error) {
      console.error(`Delete sync failed for user ${id}:`, error);
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
