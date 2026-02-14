import * as SQLite from "expo-sqlite";
import client from "@/utils/axiosInstance";
import NetInfo from "@react-native-community/netinfo";
import { Tree } from "@/types/index";
import { supabase } from "@/utils/supabase";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as Location from "expo-location";

class TreeService {
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitializing: boolean = false;
  private initPromise: Promise<boolean> | null = null;
  private syncInProgress: Set<string> = new Set();
  private imagesDirectory = `${FileSystem.documentDirectory}trees_images/`;
  private isImagesDirectoryInitialized = false;

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
      this.db = await SQLite.openDatabaseAsync("kalangka.db");

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

      await this.initImagesDirectory();

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

  private async initImagesDirectory(): Promise<void> {
    if (this.isImagesDirectoryInitialized) return;

    try {
      const dirInfo = await FileSystem.getInfoAsync(this.imagesDirectory);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.imagesDirectory, {
          intermediates: true,
        });
      }
      this.isImagesDirectoryInitialized = true;
      console.log("Images directory initialized:", this.imagesDirectory);
    } catch (error) {
      console.error("Failed to initialize images directory:", error);
    }
  }

  // Add this private method (around line 450)
  private async downloadAndSaveImage(
    imageUrl: string,
    treeId: string,
  ): Promise<string> {
    try {
      // Generate local filename
      const extension = imageUrl.split(".").pop()?.split("?")[0] || "jpg";
      const safeTreeId = treeId.replace(/[^a-zA-Z0-9]/g, "_");
      const localFileName = `${safeTreeId}_${Date.now()}.${extension}`;
      const localPath = `${this.imagesDirectory}${localFileName}`;

      console.log(`📥 Downloading image: ${imageUrl}`);
      console.log(`💾 Saving to: ${localPath}`);

      // Download the image
      const { uri } = await FileSystem.downloadAsync(imageUrl, localPath);

      console.log(`✅ Image saved locally: ${uri}`);
      return uri; // Return local path
    } catch (error) {
      console.error(`Failed to download image for tree ${treeId}:`, error);
      throw new Error(`Image download failed: ${error.message}`);
    }
  }

  // Add this method if not already present (around line 150)
  async getTreeById(id: string): Promise<Tree | null> {
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
      return null;
    }
  }

  async syncTreesFromServer(): Promise<{ synced: number; errors: string[] }> {
    try {
      console.log("🔄 Starting tree sync from server...");

      // ✅ ADD THIS SAFETY CHECK
      await this.ensureDatabaseReady();

      // ✅ ADD NULL CHECK
      if (!this.db) {
        throw new Error("Database is not initialized");
      }
      const errors: string[] = [];
      let syncedCount = 0;

      // Ensure images directory is ready
      await this.initImagesDirectory();

      // ✅ AXIOS CALL TO LARAVEL
      const response = await client.get("/trees");

      // Check response structure
      if (!response.data.success || !response.data.data) {
        throw new Error("Invalid response from server");
      }

      const remoteTrees = response.data.data; // Ito yung array of trees

      if (!remoteTrees || remoteTrees.length === 0) {
        console.log("No trees found on server");
        return { synced: 0, errors: ["No trees found on server"] };
      }

      console.log(`📥 Found ${remoteTrees.length} trees on server`);

      // Process each tree
      for (const remoteTree of remoteTrees) {
        try {
          // Check if tree already exists locally
          const existingTree = await this.getTreeById(remoteTree.id);

          if (!existingTree) {
            // New tree - download image from Supabase URL
            let localImagePath = remoteTree.image_url || "";

            // Download image if it's a URL from Supabase
            if (
              remoteTree.image_url &&
              remoteTree.image_url.startsWith("http")
            ) {
              try {
                localImagePath = await this.downloadAndSaveImage(
                  remoteTree.image_url, // Supabase URL
                  remoteTree.id,
                );
                console.log(`✅ Downloaded image for tree ${remoteTree.id}`);
              } catch (imageError) {
                console.warn(
                  `❌ Failed to download image for tree ${remoteTree.id}:`,
                  imageError,
                );
                localImagePath = remoteTree.image_url; // Keep Supabase URL as fallback
              }
            }

            // Insert into local database
            await this.db!.runAsync(
              `INSERT INTO trees (
              id, description, type, latitude, longitude, 
              image_path, status, is_synced, 
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                remoteTree.id,
                remoteTree.description || "Unnamed Tree",
                remoteTree.type || "Unknown",
                remoteTree.latitude,
                remoteTree.longitude,
                localImagePath, // Can be local path or Supabase URL
                remoteTree.status || "active",
                1, // is_synced = true (from server)
                remoteTree.created_at,
                remoteTree.updated_at || remoteTree.created_at,
              ],
            );

            syncedCount++;
            console.log(`✅ Added tree ${remoteTree.id} to local database`);
          } else {
            // Tree exists - check if server version is newer
            const localUpdatedAt = existingTree.updated_at?.getTime() || 0;
            const remoteUpdatedAt = new Date(remoteTree.updated_at).getTime();

            if (remoteUpdatedAt > localUpdatedAt) {
              let localImagePath =
                remoteTree.image_url || existingTree.image_path;

              // Download new image if URL changed
              if (
                remoteTree.image_url &&
                remoteTree.image_url.startsWith("http") &&
                existingTree.image_path !== remoteTree.image_url
              ) {
                try {
                  localImagePath = await this.downloadAndSaveImage(
                    remoteTree.image_url,
                    remoteTree.id,
                  );
                } catch (imageError) {
                  console.warn(
                    `Failed to download updated image for tree ${remoteTree.id}:`,
                    imageError,
                  );
                  localImagePath = remoteTree.image_url;
                }
              }

              // Update local tree
              await this.db!.runAsync(
                `UPDATE trees SET 
                description = ?, 
                type = ?, 
                latitude = ?, 
                longitude = ?, 
                image_path = ?, 
                status = ?, 
                is_synced = ?, 
                updated_at = ?
              WHERE id = ?`,
                [
                  remoteTree.description || existingTree.description,
                  remoteTree.type || existingTree.type,
                  remoteTree.latitude,
                  remoteTree.longitude,
                  localImagePath,
                  remoteTree.status || existingTree.status,
                  1, // Mark as synced
                  remoteTree.updated_at,
                  remoteTree.id,
                ],
              );

              syncedCount++;
              console.log(`✅ Updated tree ${remoteTree.id} in local database`);
            }
          }
        } catch (treeError: any) {
          const errorMsg = `Tree ${remoteTree.id}: ${treeError.message}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      console.log(
        `✅ Sync completed: ${syncedCount} trees synced, ${errors.length} errors`,
      );
      return { synced: syncedCount, errors };
    } catch (error: any) {
      console.error("❌ Sync failed:", error);
      throw new Error(`Failed to sync trees: ${error.message}`);
    }
  }

  // Ensure database is ready before any operation
  private async ensureDatabaseReady(): Promise<void> {
    if (!this.db) {
      console.log("⚠️ Database not ready, initializing...");
      await this.init();
    }

    // Double check
    if (!this.db) {
      throw new Error("Database failed to initialize");
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
      console.log(`📤 Direct Supabase upload for tree ${tree.id}...`);
      return await this.uploadWithBase64(tree);
    } catch (error) {
      console.error(`❌ Supabase upload failed:`, error);
      return null;
    }
  }

  // ========== PARAAN 1: BASE64 UPLOAD ==========
  private async uploadWithBase64(tree: Tree): Promise<string | null> {
    try {
      // 1. Check if file exists first
      const fileExists = await this.checkFileExists(tree.image_path);
      if (!fileExists) {
        console.warn(`Image file not found: ${tree.image_path}`);
        return null;
      }

      // 2. Basahin ang image bilang base64
      const base64 = await FileSystem.readAsStringAsync(tree.image_path, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // 3. Gumawa ng unique filename
      const filename = `tree_${tree.id}_${Date.now()}.jpg`;
      const filePath = `${filename}`; // No subfolder needed

      console.log(`📤 Uploading to Supabase bucket 'kalangka': ${filePath}`);

      // 4. Convert base64 to ArrayBuffer
      const arrayBuffer = decode(base64);

      // 5. Upload directly to Supabase Storage - BUCKET NAME: 'kalangka'
      const { data, error } = await supabase.storage
        .from("kalangka") // ✅ ITO NA ANG BAGONG BUCKET NAME
        .upload(filePath, arrayBuffer, {
          contentType: "image/jpeg",
          upsert: false, // Don't overwrite existing files
        });

      if (error) {
        console.error("Supabase upload error:", error.message);

        // Check specific error types
        if (error.message.includes("bucket not found")) {
          console.error(
            "❌ Bucket 'kalangka' doesn't exist! Create it in Supabase dashboard.",
          );
          console.error(
            "Go to: Storage → Create New Bucket → Name: 'kalangka' → Public",
          );
        } else if (error.message.includes("Forbidden")) {
          console.error("❌ No RLS policies or authentication issue");
          console.error("Add RLS policies in Supabase dashboard");
        }
        return null;
      }

      // 6. Kunin ang public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("kalangka").getPublicUrl(filePath);

      console.log(`✅ Uploaded to: ${publicUrl}`);
      return publicUrl;
    } catch (error) {
      console.error("Base64 upload error:", error);
      return null;
    }
  }

  // Helper method to check if file exists
  private async checkFileExists(filePath: string): Promise<boolean> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
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

  /**
   * Calculate distance from user to a specific tree
   */
  async getTreeDistance(
    treeLat: number,
    treeLng: number,
  ): Promise<string | null> {
    try {
      // Check location permission
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        return null;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Calculate distance using Haversine formula
      const R = 6371; // Earth's radius in kilometers
      const lat1 = (location.coords.latitude * Math.PI) / 180;
      const lat2 = (treeLat * Math.PI) / 180;
      const dLat = ((treeLat - location.coords.latitude) * Math.PI) / 180;
      const dLon = ((treeLng - location.coords.longitude) * Math.PI) / 180;

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) *
          Math.cos(lat2) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distanceInKm = R * c;

      // Format distance
      if (distanceInKm < 1) {
        return `${Math.round(distanceInKm * 1000)} meters away`;
      } else {
        return `${distanceInKm.toFixed(1)} km away`;
      }
    } catch (error) {
      console.log("Could not calculate distance:", error);
      return null;
    }
  }

  async getTreesWithDistance(): Promise<(Tree & { distance?: string })[]> {
    const trees = await this.getTrees();

    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        return trees; // Return trees without distance if no permission
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return trees.map((tree) => {
        const R = 6371;
        const lat1 = (location.coords.latitude * Math.PI) / 180;
        const lat2 = (tree.latitude * Math.PI) / 180;
        const dLat =
          ((tree.latitude - location.coords.latitude) * Math.PI) / 180;
        const dLon =
          ((tree.longitude - location.coords.longitude) * Math.PI) / 180;

        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1) *
            Math.cos(lat2) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distanceInKm = R * c;

        let distance: string;
        if (distanceInKm < 1) {
          distance = `${Math.round(distanceInKm * 1000)} meters away`;
        } else {
          distance = `${distanceInKm.toFixed(1)} km away`;
        }

        return { ...tree, distance };
      });
    } catch (error) {
      console.log("Could not calculate distances:", error);
      return trees;
    }
  }

  async getTreeCount(): Promise<number> {
    await this.ensureDatabaseReady();

    try {
      const result = await this.db!.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM trees",
      );

      return result?.count || 0;
    } catch (err) {
      console.error("Error getting tree count:", err);
      return 0;
    }
  }

  async checkAndSync(): Promise<{ needsSync: boolean; treeCount: number }> {
    try {
      const { data: remoteTrees, error } = await supabase
        .from("trees")
        .select("id, updated_at")
        .order("updated_at", { ascending: false });

      if (error || !remoteTrees || remoteTrees.length === 0) {
        return { needsSync: false, treeCount: 0 };
      }

      // Get local trees count
      const localTrees = await this.getTrees();

      // Simple check: if remote has more trees or different count
      const needsSync = remoteTrees.length !== localTrees.length;

      return {
        needsSync,
        treeCount: remoteTrees.length,
      };
    } catch (error) {
      console.error("Error checking sync status:", error);
      return { needsSync: false, treeCount: 0 };
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
