import {
  CREATE_FRUIT_WEIGHTS_TABLE,
  CREATE_FRUIT_WEIGHT_INDEXES,
  CREATE_HARVESTS_TABLE,
  CREATE_HARVEST_INDEXES,
  CREATE_WASTES_TABLE,
  CREATE_WASTE_INDEXES,
} from "@/database/schema";
import { FruitWeight, Harvest, Waste } from "@/types/index";
import client from "@/utils/axiosInstance";
import NetInfo from "@react-native-community/netinfo";
import * as SQLite from "expo-sqlite";

class HarvestService {
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

      await this.db.execAsync(CREATE_HARVESTS_TABLE);
      await this.db.execAsync(CREATE_HARVEST_INDEXES);
      await this.db.execAsync(CREATE_FRUIT_WEIGHTS_TABLE);
      await this.db.execAsync(CREATE_FRUIT_WEIGHT_INDEXES);
      await this.db.execAsync(CREATE_WASTES_TABLE);
      await this.db.execAsync(CREATE_WASTE_INDEXES);

      console.log(
        "Harvest, Fruit Weights, and Waste tables created successfully.",
      );
      this.isInitializing = false;
      return true;
    } catch (error) {
      console.error(
        "Failed to initialize Harvest, Fruit Weights, and Waste SQLite database:",
        error,
      );
      this.isInitializing = false;
      this.initPromise = null;
      throw new Error(
        "Harvest, Fruit Weights, and Waste database initialization failed. Please restart the app.",
      );
    }
  }

  private async ensureDatabaseReady(): Promise<void> {
    if (!this.db) {
      await this.init();
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

  // ==================== HARVEST METHODS ====================

  // Create Harvest
  async createHarvest(
    data: Omit<
      Harvest,
      | "id"
      | "harvest_at"
      | "created_at"
      | "updated_at"
      | "is_synced"
      | "deleted_at"
    >,
  ): Promise<Harvest> {
    await this.ensureDatabaseReady();

    const id = this.generateUUID();

    const harvest: Harvest = {
      id,
      fruit_id: data.fruit_id,
      ripe_quantity: data.ripe_quantity,
    };

    // 3 columns lang talaga - id, fruit_id, ripe_quantity lang
    await this.db!.runAsync(
      `INSERT INTO harvests (id, fruit_id, ripe_quantity)
     VALUES (?, ?, ?)`,
      [harvest.id, harvest.fruit_id, harvest.ripe_quantity],
    );

    return harvest;
  }

  // Get Harvest by Fruit ID
  async getHarvestByFruitId(fruitId: string): Promise<Harvest | null> {
    await this.ensureDatabaseReady();

    const result = await this.db!.getFirstAsync<Harvest>(
      `SELECT * FROM harvests WHERE fruit_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
      [fruitId],
    );

    return result || null;
  }

  // Get Harvests by Date Range
  async getHarvestsByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<Harvest[]> {
    await this.ensureDatabaseReady();

    return await this.db!.getAllAsync<Harvest>(
      `SELECT * FROM harvests WHERE harvest_date BETWEEN ? AND ? AND deleted_at IS NULL ORDER BY harvest_date DESC`,
      [startDate, endDate],
    );
  }

  // Update Harvest
  async updateHarvestRipeQuantity(
    id: string,
    newRipeQuantity: number,
  ): Promise<void> {
    await this.ensureDatabaseReady();

    await this.db!.runAsync(
      `UPDATE harvests 
     SET ripe_quantity = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ? AND deleted_at IS NULL`,
      [newRipeQuantity, id],
    );
  }

  // Delete Harvest (Soft Delete)
  async softDeleteHarvest(id: string): Promise<void> {
    await this.ensureDatabaseReady();

    await this.db!.runAsync(
      `UPDATE harvests SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), new Date().toISOString(), id],
    );
  }

  // ==================== FRUIT WEIGHTS METHODS ====================
  async createFruitWeight(
    data: Omit<
      FruitWeight,
      "id" | "status" | "created_at" | "updated_at" | "is_synced" | "deleted_at"
    >,
  ): Promise<FruitWeight> {
    await this.ensureDatabaseReady();

    const id = this.generateUUID();

    // Auto-determine status based on weight
    const status = data.weight < 8 ? "local" : "national";
    const fruitWeight: FruitWeight = {
      id,
      harvest_id: data.harvest_id,
      weight: data.weight,
      status: status,
      deleted_at: null,
    };

    await this.db!.runAsync(
      `INSERT INTO fruit_weights (id, harvest_id,status, weight, deleted_at)
     VALUES (?, ?, ?, ?, ?)`,
      [
        fruitWeight.id,
        fruitWeight.harvest_id,
        fruitWeight.status,
        fruitWeight.weight,
        fruitWeight.deleted_at,
      ],
    );

    return fruitWeight;
  }

  // Get Fruit Weights by Harvest ID
  async getFruitWeightsByHarvestId(harvestId: string): Promise<FruitWeight[]> {
    await this.ensureDatabaseReady();

    return await this.db!.getAllAsync<FruitWeight>(
      `SELECT * FROM fruit_weights WHERE harvest_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
      [harvestId],
    );
  }

  // Update Fruit Weight
  async updateFruitWeight(id: string, newWeight: number): Promise<void> {
    await this.ensureDatabaseReady();

    await this.db!.runAsync(
      `UPDATE fruit_weights SET weight = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL`,
      [newWeight, id],
    );
  }

  // Delete Fruit Weight (Soft Delete)
  async softDeleteFruitWeight(id: string): Promise<void> {
    await this.ensureDatabaseReady();

    await this.db!.runAsync(
      `UPDATE fruit_weights SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), new Date().toISOString(), id],
    );
  }

  // ==================== WASTE METHODS ====================
  async createWaste(
    data: Omit<
      Waste,
      "id" | "created_at" | "updated_at" | "is_synced" | "deleted_at"
    > & { reason: string },
  ): Promise<Waste> {
    await this.ensureDatabaseReady();

    const id = this.generateUUID();
    const now = new Date().toISOString();

    const waste: Waste = {
      id,
      harvest_id: data.harvest_id,
      waste_quantity: data.waste_quantity,
      reason: data.reason,
      reported_at: new Date(),
      is_synced: false,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
    };

    // Include ALL columns
    await this.db!.runAsync(
      `INSERT INTO wastes (
      id, 
      harvest_id, 
      waste_quantity, 
      reason, 
      reported_at, 
      is_synced, 
      created_at, 
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        waste.id,
        waste.harvest_id,
        waste.waste_quantity,
        waste.reason,
        now,
        0, // is_synced = false
        now,
        now,
      ],
    );

    console.log("Waste created:", waste);
    return waste;
  }

  // Get Wastes by Harvest ID
  async getWastesByHarvestId(harvestId: string): Promise<Waste[]> {
    await this.ensureDatabaseReady();

    return await this.db!.getAllAsync<Waste>(
      `SELECT * FROM wastes WHERE harvest_id = ? AND deleted_at IS NULL ORDER BY reported_at DESC`,
      [harvestId],
    );
  }

  // Update Waste
  async updateWaste(
    id: string,
    newWasteQuantity: number,
    newReason: string,
  ): Promise<void> {
    await this.ensureDatabaseReady();

    await this.db!.runAsync(
      `UPDATE wastes SET waste_quantity = ?, reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL`,
      [newWasteQuantity, newReason, id],
    );
  }

  // Delete Waste (Soft Delete)
  async softDeleteWaste(id: string): Promise<void> {
    await this.ensureDatabaseReady();

    await this.db!.runAsync(
      `UPDATE wastes SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), new Date().toISOString(), id],
    );
  }

  // ==================== COMBINED METHODS ====================

  /**
   * Complete Harvest Process - Create harvest with weights and optional waste
   */
  async completeHarvest(
    fruitId: string,
    ripeQuantity: number,
    weights: number[],
    wastesData?: { quantity: number; reason: string }[], // Changed to array
  ): Promise<{
    harvest: Harvest;
    fruitWeights: FruitWeight[];
    wastes: Waste[]; // Changed to array
    synced: boolean;
  }> {
    await this.ensureDatabaseReady();

    // Start transaction
    await this.db!.execAsync("BEGIN TRANSACTION");

    try {
      // 1. Create harvest
      const harvest = await this.createHarvest({
        fruit_id: fruitId,
        ripe_quantity: ripeQuantity,
      });

      // 2. Create fruit weights
      const fruitWeights: FruitWeight[] = [];
      for (let i = 0; i < weights.length; i++) {
        const weight = await this.createFruitWeight({
          harvest_id: harvest.id,
          weight: weights[i],
        });
        fruitWeights.push(weight);
      }

      // 3. Create wastes if provided (multiple)
      const wastes: Waste[] = [];
      if (wastesData && wastesData.length > 0) {
        for (const wasteItem of wastesData) {
          if (wasteItem.quantity > 0) {
            const waste = await this.createWaste({
              harvest_id: harvest.id,
              waste_quantity: wasteItem.quantity,
              reason: wasteItem.reason,
            });
            wastes.push(waste);
          }
        }
      }

      // Commit transaction
      await this.db!.execAsync("COMMIT");

      let synced = false;

      const networkState = await NetInfo.fetch();
      console.log("Network state on harvest completion:", networkState);
      if (networkState.isConnected && networkState.isInternetReachable) {
        synced = await this.syncCompleteHarvest(harvest.id);
        console.log(
          `Harvest ${synced ? "synced" : "failed to sync"} automatically`,
        );
      } else {
        console.log("Device is offline, harvest saved locally");
      }

      return { harvest, fruitWeights, wastes, synced };
    } catch (error) {
      // Rollback on error
      await this.db!.execAsync("ROLLBACK");
      console.error("Error in completeHarvest:", error);
      throw new Error("Failed to complete harvest process");
    }
  }

  /**
   *  Sync complete harvest data to server (harvest + weights + wastes)
   *  @returns boolean - true if sync successful, false otherwise
   */
  /**
   * Sync complete harvest data to server (harvest + weights + wastes)
   * @returns boolean - true if sync successful, false otherwise
   */
  async syncCompleteHarvest(harvestId: string): Promise<boolean> {
    await this.ensureDatabaseReady();

    if (this.syncInProgress.has(harvestId)) {
      console.warn(`⚠️ Sync already in progress for harvest ID: ${harvestId}`);
      return false;
    }

    this.syncInProgress.add(harvestId);

    try {
      console.log(`🔍 Fetching harvest data for ID: ${harvestId}`);
      const harvest = await this.db!.getFirstAsync<Harvest>(
        `SELECT * FROM harvests WHERE id = ? AND deleted_at IS NULL`,
        [harvestId],
      );

      if (!harvest) {
        console.warn(`❌ No harvest found for sync with ID: ${harvestId}`);
        return false;
      }

      console.log(`📦 Harvest found:`, {
        id: harvest.id,
        fruit_id: harvest.fruit_id,
        ripe_quantity: harvest.ripe_quantity,
        is_synced: harvest.is_synced,
      });

      const fruitWeights = await this.getFruitWeightsByHarvestId(harvestId);
      const wastes = await this.getWastesByHarvestId(harvestId);

      console.log(`⚖️ Found ${fruitWeights.length} fruit weights`);
      console.log(`🗑️ Found ${wastes.length} wastes`);

      // Log fruit weights details
      fruitWeights.forEach((w, index) => {
        console.log(`  Weight ${index + 1}:`, {
          id: w.id,
          weight: w.weight,
          status: w.status,
        });
      });

      // Log wastes details
      wastes.forEach((w, index) => {
        console.log(`  Waste ${index + 1}:`, {
          id: w.id,
          quantity: w.waste_quantity,
          reason: w.reason,
        });
      });

      // Prepare payload in the exact format your API expects
      const payload = {
        id: harvest.id,
        fruit_id: harvest.fruit_id,
        ripe_quantity: harvest.ripe_quantity,
        harvest_at: new Date().toISOString().split("T")[0], // Format: YYYY-MM-DD
        fruit_weights: fruitWeights.map((w) => ({
          id: w.id,
          weight: w.weight,
          status: w.status,
        })),
        wastes: wastes.map((w) => ({
          id: w.id,
          waste_quantity: w.waste_quantity,
          reason: w.reason,
        })),
      };

      console.log(
        `📤 Sending payload to server:`,
        JSON.stringify(payload, null, 2),
      );

      // Send to server using axios client
      try {
        const response = await client.post("/harvests", payload);

        console.log(`📥 Server response:`, {
          status: response.status,
          statusText: response.statusText,
          data: response.data,
        });

        if (response.data.success) {
          console.log(`✅ Server accepted the harvest data`);

          // Mark as synced in local database
          await this.db!.execAsync("BEGIN TRANSACTION");
          try {
            // Update harvest sync status
            await this.db!.runAsync(
              `UPDATE harvests SET is_synced = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
              [harvestId],
            );
            console.log(`✅ Marked harvest as synced in local DB`);

            // Update fruit weights sync status
            for (const weight of fruitWeights) {
              await this.db!.runAsync(
                `UPDATE fruit_weights SET is_synced = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [weight.id],
              );
            }
            console.log(
              `✅ Marked ${fruitWeights.length} fruit weights as synced`,
            );

            // Update wastes sync status
            for (const waste of wastes) {
              await this.db!.runAsync(
                `UPDATE wastes SET is_synced = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [waste.id],
              );
            }
            console.log(`✅ Marked ${wastes.length} wastes as synced`);

            await this.db!.execAsync("COMMIT");
            console.log(`🎉 Successfully synced harvest ID: ${harvestId}`);
            return true;
          } catch (error) {
            await this.db!.execAsync("ROLLBACK");
            console.error(`❌ Error updating local sync status:`, error);
            throw error;
          }
        } else {
          console.error(`❌ Server returned success: false`, response.data);
          return false;
        }
      } catch (apiError: any) {
        console.error(`❌ API Error:`);

        // Log detailed error information
        if (apiError.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.error(`  Status: ${apiError.response.status}`);
          console.error(`  Status Text: ${apiError.response.statusText}`);
          console.error(
            `  Response Data:`,
            JSON.stringify(apiError.response.data, null, 2),
          );

          // Log validation errors specifically for 422
          if (apiError.response.status === 422) {
            console.error(`  🔍 VALIDATION ERRORS (422):`);
            const errors =
              apiError.response.data.errors || apiError.response.data;

            if (typeof errors === "object") {
              Object.keys(errors).forEach((key) => {
                console.error(`    ${key}:`, errors[key]);
              });
            }

            // Check for specific field issues
            console.error(`  📋 Payload structure check:`);
            console.error(
              `    - id: ${payload.id ? "✓ present" : "✗ missing"}`,
            );
            console.error(
              `    - fruit_id: ${payload.fruit_id ? "✓ present" : "✗ missing"}`,
            );
            console.error(
              `    - ripe_quantity: ${payload.ripe_quantity !== undefined ? "✓ present" : "✗ missing"}`,
            );
            console.error(
              `    - harvest_at: ${payload.harvest_at ? "✓ present" : "✗ missing"}`,
            );
            console.error(
              `    - fruit_weights: array with ${payload.fruit_weights.length} items`,
            );
            console.error(
              `    - wastes: array with ${payload.wastes.length} items`,
            );
          }
        } else if (apiError.request) {
          // The request was made but no response was received
          console.error(`  No response received:`, apiError.request);
        } else {
          // Something happened in setting up the request that triggered an Error
          console.error(`  Request setup error:`, apiError.message);
        }

        return false;
      }

      return false;
    } catch (err) {
      console.error(
        `💥 Unexpected error syncing harvest (ID: ${harvestId}):`,
        err,
      );
      return false;
    } finally {
      this.syncInProgress.delete(harvestId);
      console.log(`🔓 Sync lock released for harvest ID: ${harvestId}`);
    }
  }

  /**
   * Get complete harvest details by fruit ID
   */
  async getHarvestDetailsByFruitId(fruitId: string): Promise<{
    harvest: Harvest | null;
    fruitWeights: FruitWeight[];
    wastes: Waste[];
    totalWeight: number;
    averageWeight: number;
    totalWaste: number;
  }> {
    await this.ensureDatabaseReady();

    const harvest = await this.getHarvestByFruitId(fruitId);

    let fruitWeights: FruitWeight[] = [];
    let wastes: Waste[] = [];
    let totalWeight = 0;
    let averageWeight = 0;
    let totalWaste = 0;

    if (harvest) {
      fruitWeights = await this.getFruitWeightsByHarvestId(harvest.id);
      wastes = await this.getWastesByHarvestId(harvest.id);

      totalWeight = fruitWeights.reduce((sum, w) => sum + w.weight, 0);
      averageWeight =
        fruitWeights.length > 0 ? totalWeight / fruitWeights.length : 0;
      totalWaste = wastes.reduce((sum, w) => sum + w.waste_quantity, 0);
    }

    console.log("wastes:", wastes);

    return {
      harvest,
      fruitWeights,
      wastes,
      totalWeight,
      averageWeight,
      totalWaste,
    };
  }

  /**
   * Delete entire harvest (harvest + weights + wastes)
   */
  async deleteCompleteHarvest(harvestId: string): Promise<void> {
    await this.ensureDatabaseReady();

    // Start transaction
    await this.db!.execAsync("BEGIN TRANSACTION");

    try {
      // Soft delete weights
      const weights = await this.getFruitWeightsByHarvestId(harvestId);
      for (const weight of weights) {
        await this.softDeleteFruitWeight(weight.id);
      }

      // Soft delete wastes
      const wastes = await this.getWastesByHarvestId(harvestId);
      for (const waste of wastes) {
        await this.softDeleteWaste(waste.id);
      }

      // Soft delete harvest
      await this.softDeleteHarvest(harvestId);

      // Commit transaction
      await this.db!.execAsync("COMMIT");
    } catch (error) {
      await this.db!.execAsync("ROLLBACK");
      console.error("Error in deleteCompleteHarvest:", error);
      throw new Error("Failed to delete harvest");
    }
  }

  /**
   * Get all unsynced harvests with their weights and wastes for syncing
   */
  async getAllUnsyncedHarvests(): Promise<
    {
      harvest: Harvest;
      fruitWeights: FruitWeight[];
      wastes: Waste[];
    }[]
  > {
    await this.ensureDatabaseReady();

    try {
      // Get all unsynced harvests (is_synced = 0 or NULL)
      const unsyncedHarvests = await this.db!.getAllAsync<Harvest>(
        `SELECT * FROM harvests 
       WHERE (is_synced = 0 OR is_synced IS NULL) 
       AND deleted_at IS NULL 
       ORDER BY created_at ASC`,
      );

      if (unsyncedHarvests.length === 0) {
        return [];
      }

      const result: {
        harvest: Harvest;
        fruitWeights: FruitWeight[];
        wastes: Waste[];
      }[] = [];

      // For each unsynced harvest, get its fruit weights and wastes
      for (const harvest of unsyncedHarvests) {
        // Get unsynced fruit weights for this harvest
        const fruitWeights = await this.db!.getAllAsync<FruitWeight>(
          `SELECT * FROM fruit_weights 
         WHERE harvest_id = ? 
         AND (is_synced = 0 OR is_synced IS NULL)
         AND deleted_at IS NULL 
         ORDER BY created_at ASC`,
          [harvest.id],
        );

        // Get unsynced wastes for this harvest
        const wastes = await this.db!.getAllAsync<Waste>(
          `SELECT * FROM wastes 
         WHERE harvest_id = ? 
         AND (is_synced = 0 OR is_synced IS NULL)
         AND deleted_at IS NULL 
         ORDER BY created_at ASC`,
          [harvest.id],
        );

        // Convert date strings to Date objects and boolean conversion
        const processedHarvest: Harvest = {
          ...harvest,
          created_at: harvest.created_at
            ? new Date(harvest.created_at)
            : new Date(),
          updated_at: harvest.updated_at
            ? new Date(harvest.updated_at)
            : new Date(),
          deleted_at: harvest.deleted_at ? new Date(harvest.deleted_at) : null,
          is_synced: Boolean(harvest.is_synced),
        };

        const processedFruitWeights: FruitWeight[] = fruitWeights.map(
          (weight) => ({
            ...weight,
            created_at: weight.created_at
              ? new Date(weight.created_at)
              : new Date(),
            updated_at: weight.updated_at
              ? new Date(weight.updated_at)
              : new Date(),
            deleted_at: weight.deleted_at ? new Date(weight.deleted_at) : null,
            is_synced: Boolean(weight.is_synced),
          }),
        );

        const processedWastes: Waste[] = wastes.map((waste) => ({
          ...waste,
          reported_at: waste.reported_at
            ? new Date(waste.reported_at)
            : new Date(),
          created_at: waste.created_at
            ? new Date(waste.created_at)
            : new Date(),
          updated_at: waste.updated_at
            ? new Date(waste.updated_at)
            : new Date(),
          deleted_at: waste.deleted_at ? new Date(waste.deleted_at) : null,
          is_synced: Boolean(waste.is_synced),
        }));

        result.push({
          harvest: processedHarvest,
          fruitWeights: processedFruitWeights,
          wastes: processedWastes,
        });
      }

      return result;
    } catch (error) {
      console.error("Error fetching unsynced harvests:", error);
      return [];
    }
  }

  /**
   * Get harvest statistics by date range
   */
  async getHarvestStatistics(
    startDate: string,
    endDate: string,
  ): Promise<{
    totalHarvests: number;
    totalFruits: number;
    totalWeight: number;
    totalWaste: number;
    averageWeightPerFruit: number;
  }> {
    await this.ensureDatabaseReady();

    const harvests = await this.getHarvestsByDateRange(startDate, endDate);

    let totalFruits = 0;
    let totalWeight = 0;
    let totalWaste = 0;

    for (const harvest of harvests) {
      totalFruits += harvest.ripe_quantity;

      const weights = await this.getFruitWeightsByHarvestId(harvest.id);
      totalWeight += weights.reduce((sum, w) => sum + w.weight, 0);

      const wastes = await this.getWastesByHarvestId(harvest.id);
      totalWaste += wastes.reduce((sum, w) => sum + w.waste_quantity, 0);
    }

    return {
      totalHarvests: harvests.length,
      totalFruits,
      totalWeight,
      totalWaste,
      averageWeightPerFruit: totalFruits > 0 ? totalWeight / totalFruits : 0,
    };
  }
}

export default new HarvestService();
