// services/TreeService.ts
import * as SQLite from "expo-sqlite";
import client from "@/utils/axiosInstance";
import NetInfo from "@react-native-community/netinfo";
import { Tree } from "@/types/index";

class TreeService {
  private db: SQLite.SQLiteDatabase | null = null;

  // Initialize database
  async init(): Promise<boolean> {
    try {
      console.log("Initializing SQLite database...");

      // Use the new async API
      this.db = await SQLite.openDatabaseAsync("trees.db");

      // Create tables
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS trees (
          id TEXT PRIMARY KEY,
          description TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          qr_code_url TEXT,
          is_synced INTEGER DEFAULT 0,
          created_at TEXT,
          updated_at TEXT
        );
      `);

      // Add indexes for better performance
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_trees_status ON trees(status);
        CREATE INDEX IF NOT EXISTS idx_trees_synced ON trees(is_synced);
        CREATE INDEX IF NOT EXISTS idx_trees_created ON trees(created_at);
      `);

      console.log("SQLite database initialized successfully");
      return true;
    } catch (error) {
      console.error("Failed to initialize SQLite database:", error);
      throw new Error(
        "Database initialization failed. Please restart the app.",
      );
    }
  }

  // Create a new tree
  async createTree(
    treeData: Omit<Tree, "id" | "created_at" | "updated_at">,
  ): Promise<string> {
    if (!this.db) {
      throw new Error("Database not initialized. Call init() first.");
    }

    const id = this.generateUUID();
    const now = new Date().toISOString();

    try {
      await this.db.runAsync(
        `INSERT INTO trees (id, description, latitude, longitude, status, qr_code_url, is_synced, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          treeData.description,
          treeData.latitude,
          treeData.longitude,
          treeData.status || "active",
          treeData.qr_code_url || null,
          0, // is_synced = false
          now,
          now,
        ],
      );

      // Get the created tree and sync
      const newTree = await this.getTree(id);
      if (newTree) {
        this.syncTreeToServer(newTree);
      }

      return id;
    } catch (error) {
      console.error("Error creating tree:", error);
      throw new Error("Failed to create tree. Please try again.");
    }
  }

  // Get all trees
  async getTrees(): Promise<Tree[]> {
    if (!this.db) {
      throw new Error("Database not initialized. Call init() first.");
    }

    try {
      const result = await this.db.getAllAsync(
        "SELECT * FROM trees ORDER BY created_at DESC",
      );

      return result.map((tree: any) => ({
        ...tree,
        created_at: tree.created_at ? new Date(tree.created_at) : null,
        updated_at: tree.updated_at ? new Date(tree.updated_at) : null,
        is_synced: Boolean(tree.is_synced),
      }));
    } catch (error) {
      console.error("Error fetching trees:", error);
      throw new Error("Failed to fetch trees. Please try again.");
    }
  }

  // Get a single tree by ID
  async getTree(id: string): Promise<Tree | null> {
    if (!this.db) {
      throw new Error("Database not initialized. Call init() first.");
    }

    try {
      const result = await this.db.getFirstAsync(
        "SELECT * FROM trees WHERE id = ?",
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
      console.error(`Error fetching tree ${id}:`, error);
      throw new Error("Failed to fetch tree. Please try again.");
    }
  }

  // Update a tree
  async updateTree(id: string, updates: Partial<Tree>): Promise<boolean> {
    if (!this.db) {
      throw new Error("Database not initialized. Call init() first.");
    }

    const now = new Date().toISOString();

    try {
      // Build update query dynamically
      const allowedFields = [
        "description",
        "latitude",
        "longitude",
        "status",
        "qr_code_url",
      ];
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

      const query = `UPDATE trees SET ${setClauses.join(", ")} WHERE id = ?`;

      await this.db.runAsync(query, values);

      // Get updated tree and sync
      const updatedTree = await this.getTree(id);
      if (updatedTree) {
        this.syncTreeToServer(updatedTree);
      }

      return true;
    } catch (error) {
      console.error(`Error updating tree ${id}:`, error);
      throw new Error("Failed to update tree. Please try again.");
    }
  }

  // Delete a tree (soft delete)
  async deleteTree(id: string): Promise<boolean> {
    if (!this.db) {
      throw new Error("Database not initialized. Call init() first.");
    }

    try {
      const now = new Date().toISOString();

      // Soft delete by marking as inactive
      await this.db.runAsync(
        `UPDATE trees SET status = 'inactive', is_synced = 0, updated_at = ? WHERE id = ?`,
        [now, id],
      );

      // Sync delete to server
      this.syncDeleteToServer(id);

      return true;
    } catch (error) {
      console.error(`Error deleting tree ${id}:`, error);
      throw new Error("Failed to delete tree. Please try again.");
    }
  }

  // Get unsynced trees
  async getUnsyncedTrees(): Promise<Tree[]> {
    if (!this.db) {
      throw new Error("Database not initialized. Call init() first.");
    }

    try {
      const result = await this.db.getAllAsync(
        "SELECT * FROM trees WHERE is_synced = 0 ORDER BY created_at ASC",
      );

      return result.map((tree: any) => ({
        ...tree,
        created_at: tree.created_at ? new Date(tree.created_at) : null,
        updated_at: tree.updated_at ? new Date(tree.updated_at) : null,
        is_synced: Boolean(tree.is_synced),
      }));
    } catch (error) {
      console.error("Error fetching unsynced trees:", error);
      return [];
    }
  }

  // Mark tree as synced
  async markAsSynced(id: string): Promise<void> {
    if (!this.db) {
      throw new Error("Database not initialized. Call init() first.");
    }

    try {
      await this.db.runAsync(
        "UPDATE trees SET is_synced = 1, updated_at = ? WHERE id = ?",
        [new Date().toISOString(), id],
      );
    } catch (error) {
      console.error(`Error marking tree ${id} as synced:`, error);
    }
  }

  // Sync a tree to server
  private async syncTreeToServer(tree: Tree): Promise<void> {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log("Offline - Tree saved locally, will sync when online");
      return;
    }

    try {
      const payload = {
        ...tree,
        created_at: tree.created_at?.toISOString(),
        updated_at: tree.updated_at?.toISOString(),
      };

      // Remove database-specific fields
      delete (payload as any).is_synced;

      console.log("Syncing tree to server:", tree.id);

      // Your actual API call here
      // const response = await client.post("/trees/sync", payload);

      // If successful, mark as synced
      // if (response.data.success) {
      //   await this.markAsSynced(tree.id);
      // }

      // For now, simulate success
      await this.markAsSynced(tree.id);
    } catch (error) {
      console.error(`Sync failed for tree ${tree.id}:`, error);
      // Don't throw error - sync failures should not break the app
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
      console.log("Syncing delete to server:", id);
      // Your actual delete API call here
      // await client.delete(`/trees/${id}`);

      // For now, just log
    } catch (error) {
      console.error(`Delete sync failed for tree ${id}:`, error);
    }
  }

  // Sync all unsynced trees
  async syncAll(): Promise<void> {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log("Offline - Cannot sync");
      return;
    }

    try {
      const unsyncedTrees = await this.getUnsyncedTrees();

      for (const tree of unsyncedTrees) {
        if (tree.status === "inactive") {
          await this.syncDeleteToServer(tree.id);
        } else {
          await this.syncTreeToServer(tree);
        }
      }

      console.log(`Synced ${unsyncedTrees.length} trees`);
    } catch (error) {
      console.error("Full sync failed:", error);
    }
  }

  // Clear all data (for testing)
  async clearDatabase(): Promise<void> {
    if (!this.db) {
      throw new Error("Database not initialized. Call init() first.");
    }

    try {
      await this.db.execAsync("DELETE FROM trees");
      console.log("Database cleared");
    } catch (error) {
      console.error("Error clearing database:", error);
      throw new Error("Failed to clear database.");
    }
  }

  // Get database statistics
  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    synced: number;
    unsynced: number;
  }> {
    if (!this.db) {
      throw new Error("Database not initialized. Call init() first.");
    }

    try {
      const stats = await this.db.getAllAsync(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive,
          SUM(CASE WHEN is_synced = 1 THEN 1 ELSE 0 END) as synced,
          SUM(CASE WHEN is_synced = 0 THEN 1 ELSE 0 END) as unsynced
        FROM trees
      `);

      return {
        total: stats[0]?.total || 0,
        active: stats[0]?.active || 0,
        inactive: stats[0]?.inactive || 0,
        synced: stats[0]?.synced || 0,
        unsynced: stats[0]?.unsynced || 0,
      };
    } catch (error) {
      console.error("Error getting database stats:", error);
      return {
        total: 0,
        active: 0,
        inactive: 0,
        synced: 0,
        unsynced: 0,
      };
    }
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

export default new TreeService();
