import * as SQLite from "expo-sqlite";
import { Flower } from "@/types/index";
import client from "@/utils/axiosInstance";
import NetInfo from "@react-native-community/netinfo";
import { supabase } from "@/utils/supabase";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";

class FlowerService {
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
      console.log("Initializing SQLite database for flowers...");
      this.db = await SQLite.openDatabaseAsync("kalangka.db");

      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS flowers (
          id TEXT PRIMARY KEY,
          tree_id TEXT NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 1,
          wrapped_at TEXT NOT NULL,
          image_url TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          is_synced INTEGER DEFAULT 0,
          created_at TEXT,
          updated_at TEXT,
          deleted_at TEXT,
          FOREIGN KEY (tree_id) REFERENCES trees(id) ON DELETE CASCADE
        );
      `);

      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_flowers_tree_id ON flowers(tree_id);
        CREATE INDEX IF NOT EXISTS idx_flowers_status ON flowers(status);
        CREATE INDEX IF NOT EXISTS idx_flowers_synced ON flowers(is_synced);
        CREATE INDEX IF NOT EXISTS idx_flowers_created ON flowers(created_at);
        CREATE INDEX IF NOT EXISTS idx_flowers_wrapped ON flowers(wrapped_at);
      `);

      console.log("Flowers SQLite database initialized successfully");
      this.isInitializing = false;
      return true;
    } catch (error) {
      console.error("Failed to initialize Flowers SQLite database:", error);
      this.isInitializing = false;
      this.initPromise = null;
      throw new Error(
        "Flowers database initialization failed. Please restart the app.",
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
        "UPDATE flowers SET is_synced = 0, updated_at = ? WHERE id = ?",
        [new Date().toISOString(), id],
      );
      console.log(`📝 Flower ${id} marked as unsynced`);
    } catch (error) {
      console.error(`Error marking flower ${id} as unsynced:`, error);
    }
  }

  async createFlower(
    flowerData: Omit<
      Flower,
      "id" | "created_at" | "updated_at" | "deleted_at" | "status"
    > & {
      status?: string;
    },
  ): Promise<string> {
    await this.ensureDatabaseReady();

    const id = this.generateUUID();
    const now = new Date().toISOString();

    try {
      await this.db!.runAsync(
        `INSERT INTO flowers (id, tree_id, quantity, wrapped_at, image_url, status, is_synced, created_at, updated_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          flowerData.tree_id,
          flowerData.quantity || 1,
          flowerData.wrapped_at instanceof Date
            ? flowerData.wrapped_at.toISOString()
            : flowerData.wrapped_at,
          flowerData.image_url,
          flowerData.status || "active",
          0,
          now,
          now,
        ],
      );

      const newFlower = await this.getFlower(id);
      if (newFlower) {
        await this.syncFlowerToServer(newFlower);
      }

      return id;
    } catch (error) {
      console.error("Error creating flower:", error);
      throw new Error("Failed to create flower record. Please try again.");
    }
  }

  async getFlowers(includeDeleted: boolean = false): Promise<Flower[]> {
    await this.ensureDatabaseReady();

    try {
      let query = "SELECT * FROM flowers";
      if (!includeDeleted) {
        query += " WHERE deleted_at IS NULL";
      }
      query += " ORDER BY created_at DESC";

      const result = await this.db!.getAllAsync(query);
      return result.map((flower: any) => this.mapFlowerFromDB(flower));
    } catch (error) {
      console.error("Error fetching flowers:", error);
      throw new Error("Failed to fetch flowers. Please try again.");
    }
  }

  async getFlowersByTreeId(
    treeId: string,
    includeDeleted: boolean = false,
  ): Promise<Flower[]> {
    await this.ensureDatabaseReady();

    try {
      let query = "SELECT * FROM flowers WHERE tree_id = ?";
      if (!includeDeleted) {
        query += " AND deleted_at IS NULL";
      }
      query += " ORDER BY wrapped_at DESC";

      const result = await this.db!.getAllAsync(query, [treeId]);
      console.log(result);
      return result.map((flower: any) => this.mapFlowerFromDB(flower));
    } catch (error) {
      console.error(`Error fetching flowers for tree ${treeId}:`, error);
      throw new Error(
        "Failed to fetch flowers for this tree. Please try again.",
      );
    }
  }

  async getFlower(id: string): Promise<Flower | null> {
    await this.ensureDatabaseReady();

    try {
      const result = await this.db!.getFirstAsync(
        "SELECT * FROM flowers WHERE id = ? AND deleted_at IS NULL",
        [id],
      );
      if (!result) return null;
      return this.mapFlowerFromDB(result);
    } catch (error) {
      console.error(`Error fetching flower ${id}:`, error);
      throw new Error("Failed to fetch flower. Please try again.");
    }
  }

  async updateFlower(id: string, updates: Partial<Flower>): Promise<boolean> {
    await this.ensureDatabaseReady();

    const now = new Date().toISOString();
    try {
      // Check kung may existing flower
      const existingFlower = await this.getFlower(id);
      if (!existingFlower) {
        throw new Error(`Flower ${id} not found`);
      }

      // Continue with the rest of your update logic...
      const allowedFields = [
        "tree_id",
        "quantity",
        "wrapped_at",
        "image_url",
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
        if (field === "wrapped_at" && value instanceof Date) {
          return value.toISOString();
        }
        return value;
      });

      setClauses.push("updated_at = ?", "is_synced = ?");
      values.push(now, 0);
      values.push(id);

      const query = `UPDATE flowers SET ${setClauses.join(", ")} WHERE id = ? AND deleted_at IS NULL`;
      await this.db!.runAsync(query, values);

      const updatedFlower = await this.getFlower(id);
      if (updatedFlower) {
        this.syncFlowerToServer(updatedFlower);
      }

      return true;
    } catch (error) {
      console.error(`Error updating flower ${id}:`, error);
      // Mark as unsynced kahit may error
      await this.markAsUnsynced(id);
      throw new Error("Failed to update flower. Please try again.");
    }
  }

  async deleteFlower(id: string): Promise<boolean> {
    await this.ensureDatabaseReady();

    try {
      // Kunin muna ang flower data bago i-delete
      const flower = await this.getFlower(id);

      if (!flower) {
        throw new Error(`Flower ${id} not found`);
      }

      const now = new Date().toISOString();
      // Soft delete - mark as deleted instead of removing
      await this.db!.runAsync(
        `UPDATE flowers SET deleted_at = ?, updated_at = ?, is_synced = 0 WHERE id = ?`,
        [now, now, id],
      );

      // Mag-sync ng delete sa server
      this.syncDeleteToServer(id);
      return true;
    } catch (error) {
      console.error(`Error deleting flower ${id}:`, error);
      throw new Error("Failed to delete flower. Please try again.");
    }
  }

  async hardDeleteFlower(id: string): Promise<boolean> {
    await this.ensureDatabaseReady();
    try {
      await this.db!.runAsync(`DELETE FROM flowers WHERE id = ?`, [id]);
      this.syncDeleteToServer(id);
      return true;
    } catch (error) {
      console.error(`Error hard deleting flower ${id}:`, error);
      throw new Error("Failed to permanently delete flower. Please try again.");
    }
  }

  async restoreFlower(id: string): Promise<boolean> {
    await this.ensureDatabaseReady();

    const now = new Date().toISOString();
    try {
      await this.db!.runAsync(
        `UPDATE flowers SET deleted_at = NULL, updated_at = ?, is_synced = 0 WHERE id = ?`,
        [now, id],
      );
      const restoredFlower = await this.getFlower(id);
      if (restoredFlower) {
        this.syncFlowerToServer(restoredFlower);
      }
      return true;
    } catch (error) {
      console.error(`Error restoring flower ${id}:`, error);
      throw new Error("Failed to restore flower. Please try again.");
    }
  }

  async getFlowerCount(): Promise<number> {
    await this.ensureDatabaseReady();
    try {
      const result = await this.db!.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM flowers WHERE deleted_at IS NULL",
      );
      return result?.count || 0;
    } catch (err) {
      console.error("Error counting flowers:", err);
      return 0;
    }
  }

  private mapFlowerFromDB(flower: any): Flower {
    return {
      id: flower.id,
      tree_id: flower.tree_id,
      quantity: flower.quantity,
      wrapped_at: flower.wrapped_at ? new Date(flower.wrapped_at) : new Date(),
      image_url: flower.image_url,
      created_at: flower.created_at ? new Date(flower.created_at) : null,
      updated_at: flower.updated_at ? new Date(flower.updated_at) : null,
      deleted_at: flower.deleted_at ? new Date(flower.deleted_at) : null,
      is_synced: Boolean(flower.is_synced),
    };
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
  async getUnsyncedFlowers(): Promise<Flower[]> {
    await this.ensureDatabaseReady();

    try {
      // Remove the "AND deleted_at IS NULL" condition to include deleted flowers
      const result = await this.db!.getAllAsync(
        "SELECT * FROM flowers WHERE is_synced = 0 ORDER BY created_at ASC",
      );
      return result.map((flower: any) => this.mapFlowerFromDB(flower));
    } catch (error) {
      console.error("Error fetching unsynced flowers:", error);
      return [];
    }
  }

  async markAsSynced(id: string): Promise<void> {
    await this.ensureDatabaseReady();

    try {
      await this.db!.runAsync(
        "UPDATE flowers SET is_synced = 1, updated_at = ? WHERE id = ?",
        [new Date().toISOString(), id],
      );
    } catch (error) {
      console.error(`Error marking flower ${id} as synced:`, error);
    }
  }

  private async syncFlowerToServer(flower: Flower): Promise<void> {
    if (this.isSyncInProgress(flower.id)) {
      console.log(
        `⏸️ Sync already in progress for flower ${flower.id}, skipping`,
      );
      return;
    }

    if (flower.is_synced) {
      console.log(`✅ Flower ${flower.id} already synced, skipping`);
      return;
    }

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log(
        `📴 Offline - Flower ${flower.id} saved locally, will sync when online`,
      );
      return;
    }

    this.markSyncStart(flower.id);

    try {
      const existingFlower = await this.getFlower(flower.id);
      if (!existingFlower) {
        console.log(`❌ Flower ${flower.id} no longer exists, skipping sync`);
        return;
      }

      if (existingFlower.is_synced) {
        console.log(
          `✅ Flower ${flower.id} already synced during check, skipping`,
        );
        return;
      }

      // Upload image if exists
      let imageUrl = null;
      if (flower.image_url) {
        try {
          imageUrl = await this.uploadImageToServer(flower);
          if (!imageUrl) {
            console.warn(
              `⚠️ Image upload failed for flower ${flower.id}, proceeding without image`,
            );
          }
        } catch (imageError) {
          console.warn(
            `⚠️ Image upload error for flower ${flower.id}:`,
            imageError,
          );
        }
      }

      // Prepare payload - WALANG has_image field dito
      const payload = {
        id: flower.id,
        tree_id: flower.tree_id,
        quantity: flower.quantity,
        wrapped_at: flower.wrapped_at.toISOString(),
        created_at: flower.created_at ? flower.created_at.toISOString() : null,
        updated_at: flower.updated_at ? flower.updated_at.toISOString() : null,
        image_url: imageUrl, // server na bahala mag-detect kung may image o wala
        is_synced: true,
      };

      console.log(`📤 Syncing flower ${flower.id}...`);

      let response;
      try {
        await client.get(`/flowers/${flower.id}`);
        response = await client.put(`/flowers/${flower.id}`, payload);
      } catch (getError: any) {
        if (getError.response?.status === 404) {
          response = await client.post("/flowers", payload);
        } else {
          throw getError;
        }
      }

      if (response.status === 200 || response.status === 201) {
        await this.markAsSynced(flower.id);
        console.log(`✅ Flower ${flower.id} synced successfully`);
      }
    } catch (error: any) {
      console.error(
        `❌ Sync failed for flower ${flower.id}:`,
        error.response?.data || error.message,
      );

      if (error.response?.status === 409) {
        console.log(
          `⚠️ Flower ${flower.id} already exists on server, marking as synced`,
        );
        await this.markAsSynced(flower.id);
      }
    } finally {
      this.markSyncFinish(flower.id);
    }
  }

  private async uploadImageToServer(flower: Flower): Promise<string | null> {
    try {
      if (!flower.image_url) {
        return null;
      }
      console.log(`📤 Direct Supabase upload for flower ${flower.id}...`);
      return await this.uploadWithBase64(flower);
    } catch (error) {
      console.error(`❌ Image upload failed for flower ${flower.id}:`, error);
      return null;
    }
  }

  private async uploadWithBase64(flower: Flower): Promise<string | null> {
    try {
      // 1. Check if file exists first
      const fileExists = await this.checkFileExists(flower.image_url);
      if (!fileExists) {
        console.warn(`Image file not found: ${flower.image_url}`);
        return null;
      }

      // 2. Basahin ang image bilang base64
      const base64 = await FileSystem.readAsStringAsync(flower.image_url, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // 3. Gumawa ng unique filename
      const filename = `flower_${flower.id}_${Date.now()}.jpg`;
      const filePath = `${filename}`;

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

  private async checkFileExists(filePath: string): Promise<boolean> {
    try {
      const { getInfoAsync } = await import("expo-file-system/legacy");
      const fileInfo = await getInfoAsync(filePath);
      return fileInfo.exists;
    } catch (error) {
      console.error("Error checking file existence:", error);
      return false;
    }
  }

  private async syncDeleteToServer(id: string): Promise<void> {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log("📴 Offline - Delete will sync when online");
      return;
    }

    if (this.isSyncInProgress(id)) {
      console.log(`⏸️ Delete sync already in progress for flower ${id}`);
      return;
    }

    this.markSyncStart(id);

    try {
      // Check if flower exists on server
      try {
        await client.get(`/flowers/${id}`);

        // If record exists on server, delete it
        await client.delete(`/flowers/${id}`);
        console.log(`🗑️ Deleted flower ${id} from server`);

        // 🟢 IMPORTANT: Hard delete from local database after successful server deletion
        await this.hardDeleteFlower(id);
        console.log(`✅ Permanently removed flower ${id} from local database`);
      } catch (getError: any) {
        if (getError.response?.status === 404) {
          console.log(`⚠️ Flower ${id} not found on server, already deleted`);
          // 🟢 Also hard delete locally since it's already gone from server
          await this.hardDeleteFlower(id);
          console.log(
            `✅ Permanently removed flower ${id} from local database`,
          );
        } else {
          throw getError;
        }
      }
    } catch (error) {
      console.error(`❌ Delete sync failed for flower ${id}:`, error);
      // Keep as unsynced to retry later
      await this.markAsUnsynced(id);
    } finally {
      this.markSyncFinish(id);
    }
  }

  async syncAll(): Promise<void> {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log("Offline - Cannot sync");
      return;
    }

    try {
      const unsyncedFlowers = await this.getUnsyncedFlowers();
      console.log("Unsynced flowers", unsyncedFlowers);
      console.log(`Found ${unsyncedFlowers.length} unsynced flowers`);

      for (const flower of unsyncedFlowers) {
        if (flower.deleted_at) {
          console.log(`🗑️ Syncing DELETE for flower ${flower.id}`);
          await this.syncDeleteToServer(flower.id);
        } else {
          console.log(`📤 Syncing flower ${flower.id}`);
          await this.syncFlowerToServer(flower);
        }
      }

      console.log(`✅ Synced ${unsyncedFlowers.length} flowers`);
    } catch (error) {
      console.error("Full sync failed:", error);
    }
  }

  async clearDatabase(): Promise<void> {
    await this.ensureDatabaseReady();

    try {
      console.log("Starting flowers database cleanup...");
      await this.db?.execAsync("DELETE FROM flowers");
      console.log("All records deleted from flowers table");

      await this.db?.execAsync("DROP TABLE IF EXISTS flowers");
      console.log("Table 'flowers' dropped");

      try {
        await this.db?.execAsync("DROP INDEX IF EXISTS idx_flowers_tree_id");
        await this.db?.execAsync("DROP INDEX IF EXISTS idx_flowers_status");
        await this.db?.execAsync("DROP INDEX IF EXISTS idx_flowers_synced");
        await this.db?.execAsync("DROP INDEX IF EXISTS idx_flowers_created");
        await this.db?.execAsync("DROP INDEX IF EXISTS idx_flowers_wrapped");
        console.log("Indexes dropped");
      } catch (indexError) {
        console.log("No indexes to drop or already dropped");
      }

      console.log(
        "Flowers database completely cleared - table structure removed",
      );
    } catch (error) {
      console.error("Error clearing flowers database:", error);
      throw new Error("Failed to clear flowers database.");
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
        FROM flowers
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
      console.error("Error getting flowers database stats:", error);
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

export default new FlowerService();
