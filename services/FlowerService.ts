import { CREATE_FLOWER_INDEXES, CREATE_FLOWERS_TABLE } from "@/database/schema";
import { Flower } from "@/types/index";
import client from "@/utils/axiosInstance";
import { formatForMySQL } from "@/utils/helpers";
import { supabase } from "@/utils/supabase";
import NetInfo from "@react-native-community/netinfo";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as SQLite from "expo-sqlite";

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

      // ✅ I-CHECK MUNA KUNG EXISTING ANG TABLE
      const tableInfo = await this.db.getAllAsync("PRAGMA table_info(flowers)");
      const hasUserId = tableInfo.some((col) => col.name === "user_id");

      // ✅ KUNG WALANG USER_ID, I-DROP ANG LUMANG TABLE
      if (!hasUserId) {
        console.log(
          "⚠️ Old flowers table detected (missing user_id), dropping...",
        );
        await this.db.execAsync("DROP TABLE IF EXISTS flowers");
        console.log("✅ Old flowers table dropped");
      }

      // ✅ NGAYON I-CREATE ANG BAGONG TABLE
      await this.db.execAsync(CREATE_FLOWERS_TABLE);
      await this.db.execAsync(CREATE_FLOWER_INDEXES);

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
    console.log("Creating flower with data:", {
      id,
      ...flowerData,
    });
    try {
      await this.db!.runAsync(
        `INSERT INTO flowers (id, tree_id,user_id, quantity, wrapped_at, image_url, status, is_synced, created_at, updated_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          flowerData.tree_id,
          flowerData.user_id,
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
      let query = `
      SELECT 
        f.*,
        u.id as user_id_alias,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.email as user_email,
        u.gender as user_gender,
        u.role as user_role,
        u.created_at as user_created_at,
        u.updated_at as user_updated_at
      FROM flowers f
      LEFT JOIN users u ON f.user_id = u.id
      WHERE f.tree_id = ?
    `;

      if (!includeDeleted) {
        query += " AND f.deleted_at IS NULL";
      }

      query += " ORDER BY f.wrapped_at DESC";

      const result = await this.db!.getAllAsync(query, [treeId]);
      console.log(`Found ${result.length} flowers for tree ${treeId}`);

      return result.map((row: any) => {
        const flower = this.mapFlowerFromDB(row);
        // Attach user data if available
        if (row.user_id_alias) {
          (flower as any).user = {
            id: row.user_id_alias,
            first_name: row.user_first_name || "",
            last_name: row.user_last_name || "",
            email: row.user_email || "",
            gender: row.user_gender || "",
            role: row.user_role || "",
            created_at: row.user_created_at
              ? new Date(row.user_created_at)
              : null,
            updated_at: row.user_updated_at
              ? new Date(row.user_updated_at)
              : null,
          };
        }
        return flower;
      });
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
      user_id: flower.user_id,
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
        user_id: flower.user_id,
        quantity: flower.quantity,
        wrapped_at: formatForMySQL(flower.wrapped_at), //flower.wrapped_at.toISOString(),
        created_at: flower.created_at ? flower.created_at.toISOString() : null,
        updated_at: flower.updated_at ? flower.updated_at.toISOString() : null,
        image_url: imageUrl, // server na bahala mag-detect kung may image o wala
        is_synced: true,
      };

      console.log(payload);

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

  // async syncFlowersFromServer(): Promise<{ synced: number; errors: string[] }> {
  //   try {
  //     console.log("🔄 Starting flower sync from server...");
  //     await this.ensureDatabaseReady();
  //     if (!this.db) throw new Error("Database not initialized");

  //     const errors: string[] = [];
  //     let syncedCount = 0;

  //     // Get flowers from Laravel
  //     const response = await client.get("/flowers");
  //     if (!response.data.success || !response.data.data) {
  //       throw new Error("Invalid response from server");
  //     }

  //     const remoteFlowers = response.data.data;
  //     if (!remoteFlowers?.length) {
  //       return { synced: 0, errors: ["No flowers found on server"] };
  //     }

  //     console.log(`📥 Found ${remoteFlowers.length} flowers on server`);

  //     // Process each flower
  //     for (const rf of remoteFlowers) {
  //       try {
  //         // Check if exists
  //         const existing = await this.getFlower(rf.id);

  //         // Download image if it's a URL
  //         let localImagePath = rf.image_url || "";
  //         if (rf.image_url?.startsWith("http")) {
  //           try {
  //             // Create flowers images directory if not exists
  //             const dir = `${FileSystem.documentDirectory}flowers_images/`;
  //             const dirInfo = await FileSystem.getInfoAsync(dir);
  //             if (!dirInfo.exists) {
  //               await FileSystem.makeDirectoryAsync(dir, {
  //                 intermediates: true,
  //               });
  //             }

  //             // Download image
  //             const ext = rf.image_url.split(".").pop()?.split("?")[0] || "jpg";
  //             const localPath = `${dir}flower_${rf.id}_${Date.now()}.${ext}`;
  //             const { uri } = await FileSystem.downloadAsync(
  //               rf.image_url,
  //               localPath,
  //             );
  //             localImagePath = uri;
  //             console.log(`✅ Downloaded image for flower ${rf.id}`);
  //           } catch (imgError) {
  //             console.warn(
  //               `⚠️ Image download failed for flower ${rf.id}, using URL`,
  //             );
  //             localImagePath = rf.image_url; // Keep URL as fallback
  //           }
  //         }

  //         if (!existing) {
  //           // Insert new flower
  //           await this.db!.runAsync(
  //             `INSERT INTO flowers (id, tree_id, user_id, quantity, wrapped_at, image_url, status, is_synced, created_at, updated_at)
  //            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  //             [
  //               rf.id,
  //               rf.tree_id,
  //               rf.user_id,
  //               rf.quantity || 1,
  //               rf.wrapped_at,
  //               localImagePath,
  //               rf.status || "active",
  //               1,
  //               rf.created_at,
  //               rf.updated_at || rf.created_at,
  //             ],
  //           );
  //           syncedCount++;
  //           console.log(`✅ Added flower ${rf.id}`);
  //         } else {
  //           // Update if newer
  //           const localUpdated = existing.updated_at?.getTime() || 0;
  //           const remoteUpdated = new Date(rf.updated_at).getTime();

  //           if (remoteUpdated > localUpdated) {
  //             await this.db!.runAsync(
  //               `UPDATE flowers SET tree_id=?, user_id=?, quantity=?, wrapped_at=?, image_url=?,
  //              status=?, is_synced=?, updated_at=? WHERE id=?`,
  //               [
  //                 rf.tree_id,
  //                 rf.user_id,
  //                 rf.quantity || 1,
  //                 rf.wrapped_at,
  //                 localImagePath,
  //                 rf.status || "active",
  //                 1,
  //                 rf.updated_at,
  //                 rf.id,
  //               ],
  //             );
  //             syncedCount++;
  //             console.log(`✅ Updated flower ${rf.id}`);
  //           }
  //         }
  //       } catch (err: any) {
  //         errors.push(`Flower ${rf.id}: ${err.message}`);
  //       }
  //     }

  //     console.log(
  //       `✅ Flower sync: ${syncedCount} synced, ${errors.length} errors`,
  //     );
  //     return { synced: syncedCount, errors };
  //   } catch (error: any) {
  //     console.error("❌ Flower sync failed:", error);
  //     throw new Error(`Failed to sync flowers: ${error.message}`);
  //   }
  // }

  async syncFlowersFromServer(): Promise<{ synced: number; errors: string[] }> {
    try {
      console.log("🔄 Starting OPTIMIZED flower sync from server...");
      await this.ensureDatabaseReady();
      if (!this.db) throw new Error("Database not initialized");

      const errors: string[] = [];

      // STEP 1: Get ALL flowers in ONE request
      const response = await client.get("/flowers");
      if (!response.data.success || !response.data.data) {
        throw new Error("Invalid response from server");
      }

      const remoteFlowers = response.data.data;
      if (!remoteFlowers?.length) {
        console.log("No flowers found on server");
        return { synced: 0, errors: [] };
      }

      console.log(`📥 Found ${remoteFlowers.length} flowers on server`);

      // STEP 2: Get ALL existing flowers in ONE query
      const existingFlowers = await this.db!.getAllAsync<{
        id: string;
        updated_at: string;
        image_url: string;
      }>(
        "SELECT id, updated_at, image_url FROM flowers WHERE deleted_at IS NULL",
      );

      const existingMap = new Map(existingFlowers.map((f) => [f.id, f]));

      // STEP 3: Prepare data for batch operations - FIXED SYNTAX HERE
      const toInsert: any[] = [];
      const toUpdate: any[] = []; // ← Dapat may = []
      const toDelete: string[] = [];
      const imagesToDownload: { id: string; url: string }[] = [];

      const now = new Date().toISOString();

      // Get remote IDs for deletion check
      const remoteIds = new Set(remoteFlowers.map((f) => f.id));

      // Check for deletions
      for (const [id, existing] of existingMap) {
        if (!remoteIds.has(id)) {
          toDelete.push(id);
          console.log(`🗑️ Flower ${id} marked for deletion`);
        }
      }

      // Process remote flowers
      for (const remoteFlower of remoteFlowers) {
        const existing = existingMap.get(remoteFlower.id);
        const remoteUpdated = new Date(remoteFlower.updated_at || 0).getTime();
        const localUpdated = existing
          ? new Date(existing.updated_at || 0).getTime()
          : 0;

        if (!existing || remoteUpdated > localUpdated) {
          if (!existing) {
            toInsert.push(remoteFlower);
          } else {
            toUpdate.push(remoteFlower);
          }

          // Track image downloads
          if (remoteFlower.image_url?.startsWith("http")) {
            imagesToDownload.push({
              id: remoteFlower.id,
              url: remoteFlower.image_url,
            });
          }
        }
      }

      console.log(
        `📊 Summary: ${toInsert.length} inserts, ${toUpdate.length} updates, ${toDelete.length} deletes, ${imagesToDownload.length} images`,
      );

      // STEP 4: Execute ALL database operations in ONE transaction
      await this.db!.execAsync("BEGIN TRANSACTION");

      try {
        // Delete
        for (const id of toDelete) {
          await this.db!.runAsync("DELETE FROM flowers WHERE id = ?", [id]);
        }

        // Insert
        for (const flower of toInsert) {
          await this.db!.runAsync(
            `INSERT INTO flowers (id, tree_id, user_id, quantity, wrapped_at, image_url, status, is_synced, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              flower.id,
              flower.tree_id,
              flower.user_id || null,
              flower.quantity || 1,
              flower.wrapped_at || now,
              "", // Will update after download
              flower.status || "active",
              1,
              flower.created_at || now,
              flower.updated_at || flower.created_at || now,
            ],
          );
        }

        // Update
        for (const flower of toUpdate) {
          await this.db!.runAsync(
            `UPDATE flowers SET tree_id=?, user_id=?, quantity=?, wrapped_at=?, status=?, is_synced=1, updated_at=? 
           WHERE id=?`,
            [
              flower.tree_id,
              flower.user_id || null,
              flower.quantity || 1,
              flower.wrapped_at || now,
              flower.status || "active",
              flower.updated_at || now,
              flower.id,
            ],
          );
        }

        await this.db!.execAsync("COMMIT");
        console.log(`✅ Database operations committed`);
      } catch (error) {
        await this.db!.execAsync("ROLLBACK");
        throw error;
      }

      // STEP 5: Download images in PARALLEL (NO transaction)
      let downloadedImages = 0;
      if (imagesToDownload.length > 0) {
        console.log(
          `📸 Downloading ${imagesToDownload.length} images in parallel...`,
        );

        // Create directory if not exists
        const dir = `${FileSystem.documentDirectory}flowers_images/`;
        const dirInfo = await FileSystem.getInfoAsync(dir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        }

        const batchSize = 10;
        for (let i = 0; i < imagesToDownload.length; i += batchSize) {
          const batch = imagesToDownload.slice(i, i + batchSize);

          await Promise.all(
            batch.map(async ({ id, url }) => {
              try {
                const ext = url.split(".").pop()?.split("?")[0] || "jpg";
                const localPath = `${dir}flower_${id}_${Date.now()}.${ext}`;
                const { uri } = await FileSystem.downloadAsync(url, localPath);

                await this.db!.runAsync(
                  "UPDATE flowers SET image_url = ? WHERE id = ?",
                  [uri, id],
                );
                downloadedImages++;

                if (
                  downloadedImages % 10 === 0 ||
                  downloadedImages === imagesToDownload.length
                ) {
                  console.log(
                    `📸 Downloaded ${downloadedImages}/${imagesToDownload.length} images`,
                  );
                }
              } catch (error) {
                errors.push(`Image failed for flower ${id}`);
                console.warn(
                  `Failed to download image for flower ${id}:`,
                  error,
                );
              }
            }),
          );
        }
      }

      const totalSynced = toInsert.length + toUpdate.length;
      console.log(
        `✅ Flower sync: ${totalSynced} synced, ${toDelete.length} deleted, ${downloadedImages} images`,
      );

      return { synced: totalSynced, errors };
    } catch (error: any) {
      console.error("❌ Flower sync failed:", error);
      throw new Error(`Failed to sync flowers: ${error.message}`);
    }
  }

  async checkAndSync(): Promise<{ needsSync: boolean; flowerCount: number }> {
    try {
      const response = await client.get("/flowers");
      if (!response.data.success || !response.data.data) {
        return { needsSync: false, flowerCount: 0 };
      }

      const remoteFlowers = response.data.data;
      const localFlowers = await this.getFlowers(true); // include all

      const needsSync = remoteFlowers.length !== localFlowers.length;

      return {
        needsSync,
        flowerCount: remoteFlowers.length,
      };
    } catch (error) {
      console.error("Error checking flower sync:", error);
      return { needsSync: false, flowerCount: 0 };
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

  /**
   * Get flower statistics - optionally filtered by tree_id
   * @param treeId Optional tree ID to filter stats for a specific tree
   */
  async getStats(treeId?: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    synced: number;
    unsynced: number;
    deleted: number;
  }> {
    await this.ensureDatabaseReady();

    try {
      let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive,
        SUM(CASE WHEN is_synced = 1 THEN 1 ELSE 0 END) as synced,
        SUM(CASE WHEN is_synced = 0 THEN 1 ELSE 0 END) as unsynced,
        SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) as deleted
      FROM flowers
    `;

      const params: any[] = [];

      if (treeId) {
        query += ` WHERE tree_id = ?`;
        params.push(treeId);
      }

      const stats = await this.db!.getFirstAsync(query, params);

      return {
        total: stats?.total || 0,
        active: stats?.active || 0,
        inactive: stats?.inactive || 0,
        synced: stats?.synced || 0,
        unsynced: stats?.unsynced || 0,
        deleted: stats?.deleted || 0,
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
