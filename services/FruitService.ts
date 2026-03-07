import { CREATE_FRUITS_INDEXES, CREATE_FRUITS_TABLE } from "@/database/schema";
import { Fruit } from "@/types/index";
import client from "@/utils/axiosInstance";
import { supabase } from "@/utils/supabase";
import NetInfo from "@react-native-community/netinfo";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as SQLite from "expo-sqlite";

class FruitService {
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitializing: boolean = false;
  private initPromise: Promise<boolean> | null = null;
  private syncInProgress: Set<string> = new Set();

  // Initialize database
  async init(): Promise<boolean> {
    if (this.db) return true;
    if (this.isInitializing && this.initPromise) {
      return await this.initPromise;
    }

    this.isInitializing = true;
    this.initPromise = this.performInit();
    return await this.initPromise;
  }

  private async performInit(): Promise<boolean> {
    try {
      console.log("Initializing SQLite database for fruits...");
      this.db = await SQLite.openDatabaseAsync("kalangka.db");

      await this.db.execAsync(CREATE_FRUITS_TABLE);

      await this.db.execAsync(CREATE_FRUITS_INDEXES);

      console.log("Fruits SQLite database initialized successfully");
      this.isInitializing = false;
      return true;
    } catch (error) {
      console.error("Failed to initialize Fruits SQLite database:", error);
      this.isInitializing = false;
      this.initPromise = null;
      throw new Error(
        "Fruits database initialization failed. Please restart the app.",
      );
    }
  }

  private async ensureDatabaseReady(): Promise<void> {
    if (!this.db) {
      await this.init();
    }
  }

  private async markAsUnsynced(id: string): Promise<void> {
    await this.ensureDatabaseReady();

    try {
      await this.db!.runAsync(
        "UPDATE fruits SET is_synced = 0, updated_at = ? WHERE id = ?",
        [new Date().toISOString(), id],
      );
      console.log(`📝 Fruit ${id} marked as unsynced`);
    } catch (error) {
      console.error(`Error marking fruit ${id} as unsynced:`, error);
    }
  }

  private async markAsSynced(id: string): Promise<void> {
    await this.ensureDatabaseReady();

    try {
      await this.db!.runAsync(
        "UPDATE fruits SET is_synced = 1, updated_at = ? WHERE id = ?",
        [new Date().toISOString(), id],
      );
    } catch (error) {
      console.error(`Error marking fruit ${id} as synced:`, error);
    }
  }

  private isSyncInProgress(id: string): boolean {
    return this.syncInProgress.has(id);
  }

  private markSyncStart(id: string): void {
    this.syncInProgress.add(id);
  }

  private markSyncFinish(id: string): void {
    this.syncInProgress.delete(id);
  }

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

  private mapFruitFromDB(fruit: any): Fruit {
    return {
      id: fruit.id,
      flower_id: fruit.flower_id,
      tree_id: fruit.tree_id,
      quantity: fruit.quantity,
      bagged_at: fruit.bagged_at ? new Date(fruit.bagged_at) : new Date(),
      image_uri: fruit.image_uri,
      created_at: fruit.created_at ? new Date(fruit.created_at) : null,
      updated_at: fruit.updated_at ? new Date(fruit.updated_at) : null,
      deleted_at: fruit.deleted_at ? new Date(fruit.deleted_at) : null,
      is_synced: Boolean(fruit.is_synced),
      status: fruit.status,
    };
  }

  private async checkFileExists(filePath: string): Promise<boolean> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      return fileInfo.exists;
    } catch (error) {
      console.error("Error checking file existence:", error);
      return false;
    }
  }

  private async uploadImageToServer(fruit: Fruit): Promise<string | null> {
    try {
      if (!fruit.image_uri) {
        return null;
      }
      console.log(`📤 Uploading image for fruit ${fruit.id}...`);
      return await this.uploadWithBase64(fruit);
    } catch (error) {
      console.error(`❌ Image upload failed for fruit ${fruit.id}:`, error);
      return null;
    }
  }

  private async uploadWithBase64(fruit: Fruit): Promise<string | null> {
    try {
      const fileExists = await this.checkFileExists(fruit.image_uri);
      if (!fileExists) {
        console.warn(`Image file not found: ${fruit.image_uri}`);
        return null;
      }

      const base64 = await FileSystem.readAsStringAsync(fruit.image_uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const filename = `fruit_${fruit.id}_${Date.now()}.jpg`;
      const filePath = `fruits/${filename}`;

      console.log(`📤 Uploading to Supabase bucket 'kalangka': ${filePath}`);

      const arrayBuffer = decode(base64);

      const { data, error } = await supabase.storage
        .from("kalangka")
        .upload(filePath, arrayBuffer, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (error) {
        console.error("Supabase upload error:", error.message);
        return null;
      }

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

  private async syncFruitToServer(fruit: Fruit): Promise<void> {
    if (this.isSyncInProgress(fruit.id)) {
      console.log(
        `⏸️ Sync already in progress for fruit ${fruit.id}, skipping`,
      );
      return;
    }

    if (fruit.is_synced) {
      console.log(`✅ Fruit ${fruit.id} already synced, skipping`);
      return;
    }

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log(
        `📴 Offline - Fruit ${fruit.id} saved locally, will sync when online`,
      );
      return;
    }

    this.markSyncStart(fruit.id);

    try {
      const existingFruit = await this.getFruit(fruit.id);
      if (!existingFruit) {
        console.log(`❌ Fruit ${fruit.id} no longer exists, skipping sync`);
        return;
      }

      if (existingFruit.is_synced) {
        console.log(
          `✅ Fruit ${fruit.id} already synced during check, skipping`,
        );
        return;
      }

      let imageUrl = null;
      if (fruit.image_uri) {
        try {
          imageUrl = await this.uploadImageToServer(fruit);
          if (!imageUrl) {
            console.warn(
              `⚠️ Image upload failed for fruit ${fruit.id}, proceeding without image`,
            );
          }
        } catch (imageError) {
          console.warn(
            `⚠️ Image upload error for fruit ${fruit.id}:`,
            imageError,
          );
        }
      }

      const payload = {
        id: fruit.id,
        flower_id: fruit.flower_id,
        tree_id: fruit.tree_id,
        quantity: fruit.quantity,
        bagged_at: fruit.bagged_at.toISOString(),
        created_at: fruit.created_at ? fruit.created_at.toISOString() : null,
        updated_at: fruit.updated_at ? fruit.updated_at.toISOString() : null,
        image_uri: imageUrl,
        is_synced: true,
      };

      console.log(`📤 Syncing fruit ${fruit.id}...`);

      let response;
      try {
        await client.get(`/fruits/${fruit.id}`);
        response = await client.put(`/fruits/${fruit.id}`, payload);
      } catch (getError: any) {
        if (getError.response?.status === 404) {
          response = await client.post("/fruits", payload);
        } else {
          throw getError;
        }
      }

      if (response.status === 200 || response.status === 201) {
        await this.markAsSynced(fruit.id);
        console.log(`✅ Fruit ${fruit.id} synced successfully`);
      }
    } catch (error: any) {
      console.error(
        `❌ Sync failed for fruit ${fruit.id}:`,
        error.response?.data || error.message,
      );

      if (error.response?.status === 409) {
        console.log(
          `⚠️ Fruit ${fruit.id} already exists on server, marking as synced`,
        );
        await this.markAsSynced(fruit.id);
      }
    } finally {
      this.markSyncFinish(fruit.id);
    }
  }

  private async syncDeleteToServer(id: string): Promise<void> {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log("📴 Offline - Delete will sync when online");
      return;
    }

    if (this.isSyncInProgress(id)) {
      console.log(`⏸️ Delete sync already in progress for fruit ${id}`);
      return;
    }

    this.markSyncStart(id);

    try {
      try {
        await client.get(`/fruits/${id}`);
        await client.delete(`/fruits/${id}`);
        console.log(`🗑️ Deleted fruit ${id} from server`);
        await this.hardDeleteFruit(id);
        console.log(`✅ Permanently removed fruit ${id} from local database`);
      } catch (getError: any) {
        if (getError.response?.status === 404) {
          console.log(`⚠️ Fruit ${id} not found on server, already deleted`);
          await this.hardDeleteFruit(id);
          console.log(`✅ Permanently removed fruit ${id} from local database`);
        } else {
          throw getError;
        }
      }
    } catch (error) {
      console.error(`❌ Delete sync failed for fruit ${id}:`, error);
      await this.markAsUnsynced(id);
    } finally {
      this.markSyncFinish(id);
    }
  }

  // Public CRUD Methods
  async getFruitCount(): Promise<number> {
    await this.ensureDatabaseReady();
    try {
      const result = await this.db!.getFirstAsync(
        "SELECT COUNT(*) as count FROM fruits WHERE deleted_at IS NULL",
      );
      return result?.count || 0;
    } catch (error) {
      console.error("Error counting fruits:", error);
      return 0;
    }
  }
  async checkAndSync(): Promise<{ needsSync: boolean; fruitCount: number }> {
    try {
      // Get fruits from Laravel API
      const response = await client.get("/fruits");

      if (!response.data.success || !response.data.data) {
        console.log("No fruits found on server or invalid response");
      }

      const remoteFruits = response.data.data; // Array of fruits from Laravel

      if (!remoteFruits || remoteFruits.length === 0) {
        return { needsSync: false, fruitCount: 0 };
      }

      // Get local fruits count (include deleted for accurate comparison)
      const localFruits = await this.getFruits(true);

      // Compare counts and latest timestamps
      let needsSync = false;

      if (remoteFruits.length !== localFruits.length) {
        // Different count = need sync
        needsSync = true;
        console.log(
          `📊 Fruit count mismatch: Server has ${remoteFruits.length}, Local has ${localFruits.length}`,
        );
      } else {
        // Same count, check if any fruit has newer timestamp
        // Get latest local update
        const latestLocal = localFruits.reduce((latest, fruit) => {
          const fruitTime = fruit.updated_at?.getTime() || 0;
          return fruitTime > latest ? fruitTime : latest;
        }, 0);

        // Get latest remote update
        const latestRemote = remoteFruits.reduce(
          (latest: number, fruit: any) => {
            const fruitTime = new Date(fruit.updated_at).getTime();
            return fruitTime > latest ? fruitTime : latest;
          },
          0,
        );

        // If remote has newer data, need sync
        if (latestRemote > latestLocal) {
          needsSync = true;
          console.log(
            `📊 Newer fruits on server: Server ${new Date(latestRemote)}, Local ${new Date(latestLocal)}`,
          );
        }
      }

      return {
        needsSync,
        fruitCount: remoteFruits.length,
      };
    } catch (error: any) {
      console.error("Error checking fruit sync status:", error);
      // If error (like network), assume no sync needed
      return { needsSync: false, fruitCount: 0 };
    }
  }

  async createFruit(
    fruitData: Omit<
      Fruit,
      "id" | "created_at" | "updated_at" | "deleted_at"
    > & {
      status?: string;
    },
  ): Promise<string> {
    await this.ensureDatabaseReady();

    const id = this.generateUUID();
    const now = new Date().toISOString();

    try {
      await this.db!.runAsync(
        `INSERT INTO fruits (id, flower_id, tree_id, quantity, bagged_at, image_uri, status, is_synced, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          fruitData.flower_id,
          fruitData.tree_id,
          fruitData.quantity || 1,
          fruitData.bagged_at instanceof Date
            ? fruitData.bagged_at.toISOString()
            : fruitData.bagged_at,
          fruitData.image_uri,
          fruitData.status || "active",
          0,
          now,
          now,
        ],
      );

      const newFruit = await this.getFruit(id);
      if (newFruit) {
        await this.syncFruitToServer(newFruit);
      }

      return id;
    } catch (error) {
      console.error("Error creating fruit:", error);
      throw new Error("Failed to create fruit record. Please try again.");
    }
  }

  async syncFruitsFromServer(): Promise<{ synced: number; errors: string[] }> {
    try {
      console.log("🔄 Syncing fruits from server...");
      await this.ensureDatabaseReady();
      if (!this.db) throw new Error("DB not ready");

      const errors: string[] = [];
      let synced = 0;

      // Create images directory if not exists
      const imgDir = `${FileSystem.documentDirectory}fruits/`;
      const dirInfo = await FileSystem.getInfoAsync(imgDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(imgDir, { intermediates: true });
      }

      // Get from Laravel
      const res = await client.get("/fruits");
      if (!res.data.success || !res.data.data?.length) {
        return { synced: 0, errors: ["No fruits"] };
      }

      // Get local fruits
      const localFruits = await this.getFruits(true);
      const localMap = new Map(localFruits.map((f) => [f.id, f]));

      console.log(
        `📥 Server: ${res.data.data.length} fruits, Local: ${localFruits.length} fruits`,
      );

      // Process each fruit
      for (const rf of res.data.data) {
        try {
          const existing = localMap.get(rf.id);

          // DOWNLOAD IMAGE if it's a URL
          let imagePath = rf.image_uri || "";
          if (rf.image_uri?.startsWith("http")) {
            try {
              const filename = `fruit_${rf.id}_${Date.now()}.jpg`;
              const localPath = imgDir + filename;
              const { uri } = await FileSystem.downloadAsync(
                rf.image_uri,
                localPath,
              );
              imagePath = uri;
              console.log(`✅ Downloaded image for fruit ${rf.id}`);
            } catch (err) {
              console.warn(
                `⚠️ Image download failed for fruit ${rf.id}, using URL`,
              );
              imagePath = rf.image_uri; // fallback to URL
            }
          }

          if (!existing) {
            // Insert new with downloaded image
            await this.db.runAsync(
              `INSERT INTO fruits (id, flower_id, tree_id, quantity, bagged_at, image_uri, status, is_synced, created_at, updated_at) 
             VALUES (?,?,?,?,?,?,?,?,?,?)`,
              [
                rf.id,
                rf.flower_id,
                rf.tree_id,
                rf.quantity || 1,
                rf.bagged_at,
                imagePath,
                rf.status || "active",
                1,
                rf.created_at,
                rf.updated_at || rf.created_at,
              ],
            );
            synced++;
            console.log(`✅ Added fruit ${rf.id}`);
          } else {
            // Update if newer
            const remoteTime = new Date(rf.updated_at).getTime();
            const localTime = existing.updated_at?.getTime() || 0;

            if (remoteTime > localTime) {
              await this.db.runAsync(
                `UPDATE fruits SET flower_id=?, tree_id=?, quantity=?, bagged_at=?, 
               image_uri=?, status=?, is_synced=1, updated_at=? WHERE id=?`,
                [
                  rf.flower_id,
                  rf.tree_id,
                  rf.quantity || 1,
                  rf.bagged_at,
                  imagePath,
                  rf.status || "active",
                  rf.updated_at,
                  rf.id,
                ],
              );
              synced++;
              console.log(`✅ Updated fruit ${rf.id}`);
            }
          }
        } catch (e: any) {
          errors.push(e.message);
        }
      }

      console.log(`✅ Fruit sync: ${synced} synced, ${errors.length} errors`);
      return { synced, errors };
    } catch (error: any) {
      throw new Error(`Sync failed: ${error.message}`);
    }
  }

  async getFruits(includeDeleted: boolean = false): Promise<Fruit[]> {
    await this.ensureDatabaseReady();

    try {
      let query = "SELECT * FROM fruits";
      if (!includeDeleted) {
        query += " WHERE deleted_at IS NULL";
      }
      query += " ORDER BY created_at DESC";

      const result = await this.db!.getAllAsync(query);
      return result.map((fruit: any) => this.mapFruitFromDB(fruit));
    } catch (error) {
      console.error("Error fetching fruits:", error);
      throw new Error("Failed to fetch fruits. Please try again.");
    }
  }

  async getFruitsWithoutHarvest(
    includeDeleted: boolean = false,
  ): Promise<Fruit[]> {
    await this.ensureDatabaseReady();

    try {
      let query = `
      SELECT f.* 
      FROM fruits f
      LEFT JOIN harvests h ON f.id = h.fruit_id AND h.deleted_at IS NULL
      WHERE h.id IS NULL
    `;

      if (!includeDeleted) {
        query += " AND f.deleted_at IS NULL";
      }

      query += " ORDER BY f.created_at DESC";

      const result = await this.db!.getAllAsync(query);
      return result.map((fruit: any) => this.mapFruitFromDB(fruit));
    } catch (error) {
      console.error("Error fetching fruits without harvest:", error);
      throw new Error("Failed to fetch fruits without harvest.");
    }
  }

  async getFruitsByFlowerId(
    flowerId: string,
    includeDeleted: boolean = false,
  ): Promise<Fruit[]> {
    await this.ensureDatabaseReady();

    try {
      let query = "SELECT * FROM fruits WHERE flower_id = ?";
      if (!includeDeleted) {
        query += " AND deleted_at IS NULL";
      }
      query += " ORDER BY bagged_at DESC";

      const result = await this.db!.getAllAsync(query, [flowerId]);
      console.log("Fruits for flower:", result);
      return result.map((fruit: any) => this.mapFruitFromDB(fruit));
    } catch (error) {
      console.error(`Error fetching fruits for flower ${flowerId}:`, error);
      throw new Error(
        "Failed to fetch fruits for this flower. Please try again.",
      );
    }
  }

  async getFruitsByTreeId(
    treeId: string,
    includeDeleted: boolean = false,
  ): Promise<Fruit[]> {
    await this.ensureDatabaseReady();

    try {
      let query = "SELECT * FROM fruits WHERE tree_id = ?";
      if (!includeDeleted) {
        query += " AND deleted_at IS NULL";
      }
      query += " ORDER BY bagged_at DESC";

      const result = await this.db!.getAllAsync(query, [treeId]);
      return result.map((fruit: any) => this.mapFruitFromDB(fruit));
    } catch (error) {
      console.error(`Error fetching fruits for tree ${treeId}:`, error);
      throw new Error(
        "Failed to fetch fruits for this tree. Please try again.",
      );
    }
  }

  async getFruit(id: string): Promise<Fruit | null> {
    await this.ensureDatabaseReady();

    try {
      const result = await this.db!.getFirstAsync(
        "SELECT * FROM fruits WHERE id = ? AND deleted_at IS NULL",
        [id],
      );
      if (!result) return null;
      return this.mapFruitFromDB(result);
    } catch (error) {
      console.error(`Error fetching fruit ${id}:`, error);
      throw new Error("Failed to fetch fruit. Please try again.");
    }
  }

  async updateFruit(id: string, updates: Partial<Fruit>): Promise<boolean> {
    await this.ensureDatabaseReady();

    const now = new Date().toISOString();
    try {
      const existingFruit = await this.getFruit(id);
      if (!existingFruit) {
        throw new Error(`Fruit ${id} not found`);
      }

      const allowedFields = [
        "flower_id",
        "tree_id",
        "quantity",
        "bagged_at",
        "image_uri",
        "status",
      ];
      const fieldsToUpdate = Object.keys(updates).filter((key) =>
        allowedFields.includes(key),
      );

      if (fieldsToUpdate.length === 0) {
        throw new Error("No valid fields to update");
      }

      const setClauses = fieldsToUpdate.map((field) => `${field} = ?`);
      const values = fieldsToUpdate.map((field) => {
        const value = (updates as any)[field];
        if (field === "bagged_at" && value instanceof Date) {
          return value.toISOString();
        }
        return value;
      });

      setClauses.push("updated_at = ?", "is_synced = ?");
      values.push(now, 0);
      values.push(id);

      const query = `UPDATE fruits SET ${setClauses.join(", ")} WHERE id = ? AND deleted_at IS NULL`;
      await this.db!.runAsync(query, values);

      const updatedFruit = await this.getFruit(id);
      if (updatedFruit) {
        await this.syncFruitToServer(updatedFruit);
      }

      return true;
    } catch (error) {
      console.error(`Error updating fruit ${id}:`, error);
      await this.markAsUnsynced(id);
      throw new Error("Failed to update fruit. Please try again.");
    }
  }

  async deleteFruit(id: string): Promise<boolean> {
    await this.ensureDatabaseReady();

    try {
      const fruit = await this.getFruit(id);

      if (!fruit) {
        throw new Error(`Fruit ${id} not found`);
      }

      const now = new Date().toISOString();
      await this.db!.runAsync(
        `UPDATE fruits SET deleted_at = ?, updated_at = ?, is_synced = 0 WHERE id = ?`,
        [now, now, id],
      );

      await this.syncDeleteToServer(id);
      return true;
    } catch (error) {
      console.error(`Error deleting fruit ${id}:`, error);
      throw new Error("Failed to delete fruit. Please try again.");
    }
  }

  async hardDeleteFruit(id: string): Promise<boolean> {
    await this.ensureDatabaseReady();
    try {
      await this.db!.runAsync(`DELETE FROM fruits WHERE id = ?`, [id]);
      return true;
    } catch (error) {
      console.error(`Error hard deleting fruit ${id}:`, error);
      throw new Error("Failed to permanently delete fruit. Please try again.");
    }
  }

  async restoreFruit(id: string): Promise<boolean> {
    await this.ensureDatabaseReady();

    const now = new Date().toISOString();
    try {
      await this.db!.runAsync(
        `UPDATE fruits SET deleted_at = NULL, updated_at = ?, is_synced = 0 WHERE id = ?`,
        [now, id],
      );
      const restoredFruit = await this.getFruit(id);
      if (restoredFruit) {
        await this.syncFruitToServer(restoredFruit);
      }
      return true;
    } catch (error) {
      console.error(`Error restoring fruit ${id}:`, error);
      throw new Error("Failed to restore fruit. Please try again.");
    }
  }

  async getUnsyncedFruits(): Promise<Fruit[]> {
    await this.ensureDatabaseReady();

    try {
      const result = await this.db!.getAllAsync(
        "SELECT * FROM fruits WHERE is_synced = 0 ORDER BY created_at ASC",
      );
      return result.map((fruit: any) => this.mapFruitFromDB(fruit));
    } catch (error) {
      console.error("Error fetching unsynced fruits:", error);
      return [];
    }
  }

  async syncAll(): Promise<void> {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log("Offline - Cannot sync");
      return;
    }

    try {
      const unsyncedFruits = await this.getUnsyncedFruits();
      console.log(`Found ${unsyncedFruits.length} unsynced fruits`);

      for (const fruit of unsyncedFruits) {
        if (fruit.deleted_at) {
          console.log(`🗑️ Syncing DELETE for fruit ${fruit.id}`);
          await this.syncDeleteToServer(fruit.id);
        } else {
          console.log(`📤 Syncing fruit ${fruit.id}`);
          await this.syncFruitToServer(fruit);
        }
      }

      console.log(`✅ Synced ${unsyncedFruits.length} fruits`);
    } catch (error) {
      console.error("Full sync failed:", error);
    }
  }

  async clearDatabase(): Promise<void> {
    await this.ensureDatabaseReady();

    try {
      console.log("Starting fruits database cleanup...");
      await this.db?.execAsync("DELETE FROM fruits");
      console.log("All records deleted from fruits table");

      await this.db?.execAsync("DROP TABLE IF EXISTS fruits");
      console.log("Table 'fruits' dropped");

      try {
        await this.db?.execAsync("DROP INDEX IF EXISTS idx_fruits_flower_id");
        await this.db?.execAsync("DROP INDEX IF EXISTS idx_fruits_tree_id");
        await this.db?.execAsync("DROP INDEX IF EXISTS idx_fruits_status");
        await this.db?.execAsync("DROP INDEX IF EXISTS idx_fruits_synced");
        await this.db?.execAsync("DROP INDEX IF EXISTS idx_fruits_created");
        await this.db?.execAsync("DROP INDEX IF EXISTS idx_fruits_bagged");
        console.log("Indexes dropped");
      } catch (indexError) {
        console.log("No indexes to drop or already dropped");
      }

      console.log("Fruits database completely cleared");
    } catch (error) {
      console.error("Error clearing fruits database:", error);
      throw new Error("Failed to clear fruits database.");
    }
  }

  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    synced: number;
    unsynced: number;
    deleted: number;
  }> {
    await this.ensureDatabaseReady();

    try {
      const stats = await this.db!.getAllAsync(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive,
          SUM(CASE WHEN is_synced = 1 THEN 1 ELSE 0 END) as synced,
          SUM(CASE WHEN is_synced = 0 THEN 1 ELSE 0 END) as unsynced,
          SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) as deleted
        FROM fruits
      `);

      return {
        total: stats[0]?.total || 0,
        active: stats[0]?.active || 0,
        inactive: stats[0]?.inactive || 0,
        synced: stats[0]?.synced || 0,
        unsynced: stats[0]?.unsynced || 0,
        deleted: stats[0]?.deleted || 0,
      };
    } catch (error) {
      console.error("Error getting fruits database stats:", error);
      return {
        total: 0,
        active: 0,
        inactive: 0,
        synced: 0,
        unsynced: 0,
        deleted: 0,
      };
    }
  }
}

export default new FruitService();
