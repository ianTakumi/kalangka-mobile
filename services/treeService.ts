import * as SQLite from "expo-sqlite";
import client from "@/utils/axiosInstance";
import NetInfo from "@react-native-community/netinfo";
import { Tree } from "@/types/index";

class TreeService {
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
          CREATE TABLE IF NOT EXISTS trees (
            id TEXT PRIMARY KEY,
            description TEXT NOT NULL,
            type TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            is_synced INTEGER DEFAULT 0,
            image_path TEXT NOT NULL,
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
        `INSERT INTO trees (id, description, type, latitude, longitude,image_path, status,  is_synced, created_at, updated_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          treeData.description,
          treeData.type,
          treeData.latitude,
          treeData.longitude,
          treeData.image_path || "",
          treeData.status || "active",
          0, // is_synced = false
          now,
          now,
        ],
      );

      // Get the created tree and sync
      const newTree = await this.getTree(id);
      if (newTree) {
        await this.syncTreeToServer(newTree);
      }

      return id;
    } catch (error) {
      console.error("Error creating tree:", error);
      throw new Error("Failed to create tree. Please try again.");
    }
  }

  // Get all trees
  async getTrees(): Promise<Tree[]> {
    await this.ensureDatabaseReady();

    try {
      const result = await this.db!.getAllAsync(
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
    await this.ensureDatabaseReady();

    try {
      const result = await this.db!.getFirstAsync(
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
    await this.ensureDatabaseReady();

    const now = new Date().toISOString();

    try {
      // Build update query dynamically
      const allowedFields = [
        "description",
        "latitude",
        "longitude",
        "status",
        "type",
        // "image_path",
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

      await this.db!.runAsync(query, values);

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

  // Delete a tree entirely (hard delete)
  async deleteTree(id: string): Promise<boolean> {
    await this.ensureDatabaseReady();

    try {
      // Hard delete - remove the record entirely
      await this.db!.runAsync(`DELETE FROM trees WHERE id = ?`, [id]);

      // Sync delete to server
      this.syncDeleteToServer(id);

      return true;
    } catch (error) {
      console.error(`Error deleting tree ${id}:`, error);
      throw new Error("Failed to delete tree. Please try again.");
    }
  }

  private isSyncInProgress(id: string): boolean {
    return this.syncInProgress.has(id);
  }

  // Helper to mark sync as started
  private markSyncStart(id: string): void {
    this.syncInProgress.add(id);
  }

  // Helper to mark sync as finished
  private markSyncFinish(id: string): void {
    this.syncInProgress.delete(id);
  }

  // Get unsynced trees
  async getUnsyncedTrees(): Promise<Tree[]> {
    await this.ensureDatabaseReady();

    try {
      const result = await this.db!.getAllAsync(
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
    await this.ensureDatabaseReady();

    try {
      await this.db!.runAsync(
        "UPDATE trees SET is_synced = 1, updated_at = ? WHERE id = ?",
        [new Date().toISOString(), id],
      );
    } catch (error) {
      console.error(`Error marking tree ${id} as synced:`, error);
    }
  }
  // Sync a tree to server
  private async syncTreeToServer(tree: Tree): Promise<void> {
    // Prevent duplicate sync
    if (this.isSyncInProgress(tree.id)) {
      console.log(`⏸️ Sync already in progress for tree ${tree.id}, skipping`);
      return;
    }

    // If already synced, skip
    if (tree.is_synced) {
      console.log(`✅ Tree ${tree.id} already synced, skipping`);
      return;
    }

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log(
        `📴 Offline - Tree ${tree.id} saved locally, will sync when online`,
      );
      return;
    }

    this.markSyncStart(tree.id);

    try {
      // Check if tree still exists in database
      const existingTree = await this.getTree(tree.id);
      if (!existingTree) {
        console.log(`❌ Tree ${tree.id} no longer exists, skipping sync`);
        return;
      }

      // Check if already synced (in case of race condition)
      if (existingTree.is_synced) {
        console.log(`✅ Tree ${tree.id} already synced during check, skipping`);
        return;
      }

      // Upload image if exists
      let imageUrl = null;
      if (tree.image_path) {
        try {
          imageUrl = await this.uploadImageToServer(tree);
          if (!imageUrl) {
            console.warn(
              `⚠️ Image upload failed for tree ${tree.id}, proceeding without image`,
            );
          }
        } catch (imageError) {
          console.warn(
            `⚠️ Image upload error for tree ${tree.id}:`,
            imageError,
          );
          // Continue without image
        }
      }

      // Prepare payload
      const payload = {
        id: tree.id,
        description: tree.description,
        type: tree.type,
        latitude: tree.latitude,
        longitude: tree.longitude,
        status: tree.status,
        created_at: tree.created_at ? tree.created_at.toISOString() : null,
        updated_at: tree.updated_at ? tree.updated_at.toISOString() : null,
        image_url: imageUrl,
        has_image: !!imageUrl,
        is_synced: true,
      };

      console.log(`📤 Syncing tree ${tree.id}...`);

      // Check if tree exists on server first
      let response;
      try {
        // Try to check if tree exists on server
        await client.get(`/trees/${tree.id}`);
        // If exists, update
        response = await client.put(`/trees/${tree.id}`, payload);
      } catch (getError: any) {
        // If not found (404), create new
        if (getError.response?.status === 404) {
          response = await client.post("/trees", payload);
        } else {
          throw getError;
        }
      }

      if (response.status === 200 || response.status === 201) {
        await this.markAsSynced(tree.id);
        console.log(`✅ Tree ${tree.id} synced successfully`);
      }
    } catch (error: any) {
      console.error(
        `❌ Sync failed for tree ${tree.id}:`,
        error.response?.data || error.message,
      );

      // If duplicate key error (409), mark as synced anyway
      if (error.response?.status === 409) {
        console.log(
          `⚠️ Tree ${tree.id} already exists on server, marking as synced`,
        );
        await this.markAsSynced(tree.id);
      }
    } finally {
      this.markSyncFinish(tree.id);
    }
  }

  private async uploadImageToServer(tree: Tree): Promise<string | null> {
    try {
      if (!tree.image_path) {
        return null;
      }

      // Check if file exists
      const fileExists = await this.checkFileExists(tree.image_path);
      if (!fileExists) {
        console.warn(`Image file not found: ${tree.image_path}`);
        return null;
      }

      // Create FormData
      const formData = new FormData();

      // Append the image file
      formData.append("image", {
        uri: tree.image_path,
        type: "image/jpeg",
        name: `tree_${tree.id}_${Date.now()}.jpg`,
      } as any);

      // Append metadata
      formData.append("tree_id", tree.id);
      formData.append("folder", "tree-images");

      console.log(`📤 Uploading image for tree ${tree.id}...`);

      // Upload to separate image endpoint
      const response = await client.post("/upload/single", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 30000, // 30 seconds timeout
      });

      if (response.data.success && response.data.data?.url) {
        console.log(`✅ Image uploaded: ${response.data.data.url}`);
        return response.data.data.url;
      } else {
        throw new Error("No URL returned from upload");
      }
    } catch (error) {
      console.error(`❌ Image upload failed for tree ${tree.id}:`, error);
      return null;
    }
  }

  // Helper method to check if file exists
  private async checkFileExists(filePath: string): Promise<boolean> {
    try {
      // For React Native - using expo-file-system
      const { getInfoAsync } = await import("expo-file-system/legacy");
      const fileInfo = await getInfoAsync(filePath);
      return fileInfo.exists;
    } catch (error) {
      console.error("Error checking file existence:", error);
      return false;
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
      await client.delete(`/trees/${id}`);
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
    await this.ensureDatabaseReady();

    try {
      console.log("Starting database cleanup...");

      // Step 1: DELETE muna lahat ng records
      const deleteResult = await this.db?.execAsync("DELETE FROM trees");
      console.log("All records deleted from trees table");

      // Step 2: DROP the table completely
      const dropResult = await this.db?.execAsync("DROP TABLE IF EXISTS trees");
      console.log("Table 'trees' dropped");

      // Step 3: Drop indexes din kung meron
      try {
        await this.db?.execAsync("DROP INDEX IF EXISTS idx_trees_status");
        await this.db?.execAsync("DROP INDEX IF EXISTS idx_trees_synced");
        await this.db?.execAsync("DROP INDEX IF EXISTS idx_trees_created");
        console.log("Indexes dropped");
      } catch (indexError) {
        console.log("No indexes to drop or already dropped");
      }

      console.log("Database completely cleared - table structure removed");
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
    await this.ensureDatabaseReady();

    try {
      const stats = await this.db!.getAllAsync(`
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
