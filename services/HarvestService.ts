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

  /**
   * Update existing harvest with weights and wastes
   * This updates an existing harvest record (not creates a new one)
   */
  async updateHarvest(
    harvestId: string,
    ripeQuantity: number, // Total ripe fruits (lahat ng nasa UI)
    weights: number[], // Lahat ng weights (existing + new)
    wastesData?: { quantity: number; reason: string }[], // Lahat ng wastes (existing + new)
  ): Promise<{
    harvest: Harvest;
    fruitWeights: FruitWeight[];
    wastes: Waste[];
    synced: boolean;
  }> {
    await this.ensureDatabaseReady();

    // Start transaction
    await this.db!.execAsync("BEGIN TRANSACTION");

    try {
      // 1. Check if harvest exists
      const existingHarvest = await this.db!.getFirstAsync<Harvest>(
        `SELECT * FROM harvests WHERE id = ? AND deleted_at IS NULL`,
        [harvestId],
      );

      if (!existingHarvest) {
        throw new Error(`Harvest with ID ${harvestId} not found`);
      }

      // 2. Get fruit details
      const fruit = await this.db!.getFirstAsync<{
        quantity: number;
        remaining_quantity: number;
      }>(`SELECT quantity, remaining_quantity FROM fruits WHERE id = ?`, [
        existingHarvest.fruit_id,
      ]);

      if (!fruit) {
        throw new Error("Fruit not found");
      }

      // 3. Delete existing weights and wastes
      await this.db!.runAsync(
        `DELETE FROM fruit_weights WHERE harvest_id = ?`,
        [harvestId],
      );

      await this.db!.runAsync(`DELETE FROM wastes WHERE harvest_id = ?`, [
        harvestId,
      ]);

      // 4. Determine harvest status - ONLY 'pending', 'partial', 'harvested'
      const totalProcessed =
        weights.length +
        (wastesData?.reduce((sum, w) => sum + w.quantity, 0) || 0);

      const availableQuantity = fruit.remaining_quantity || fruit.quantity;
      const remainingAfterHarvest = availableQuantity - totalProcessed;

      // ✅ FIX: Only use valid status values from schema
      let status: "pending" | "partial" | "harvested" = "partial";

      if (remainingAfterHarvest <= 0) {
        // All fruits are processed (either harvested or wasted)
        status = "harvested";
      } else if (weights.length > 0) {
        // Some fruits harvested, some remaining
        status = "partial";
      } else {
        // No ripe fruits harvested yet
        status = "pending";
      }

      console.log(`📊 Status calculation:`, {
        totalProcessed,
        availableQuantity,
        remainingAfterHarvest,
        weightsLength: weights.length,
        wastesLength: wastesData?.length || 0,
        status,
      });

      // 5. Update harvest with correct status
      await this.db!.runAsync(
        `UPDATE harvests 
       SET ripe_quantity = ?, 
           status = ?,
           harvest_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP,
           is_synced = 0
       WHERE id = ? AND deleted_at IS NULL`,
        [ripeQuantity, status, harvestId],
      );

      // Get updated harvest
      const updatedHarvest = await this.db!.getFirstAsync<Harvest>(
        `SELECT * FROM harvests WHERE id = ?`,
        [harvestId],
      );

      if (!updatedHarvest) {
        throw new Error("Failed to retrieve updated harvest");
      }

      console.log(`✅ Harvest updated with status: ${status}`);

      // 6. Insert new fruit weights
      const fruitWeights: FruitWeight[] = [];
      for (let i = 0; i < weights.length; i++) {
        const weight = await this.createFruitWeight({
          harvest_id: harvestId,
          weight: weights[i],
        });
        fruitWeights.push(weight);
      }

      // 7. Insert new wastes
      const wastes: Waste[] = [];
      if (wastesData && wastesData.length > 0) {
        for (const wasteItem of wastesData) {
          if (wasteItem.quantity > 0) {
            const waste = await this.createWaste({
              harvest_id: harvestId,
              waste_quantity: wasteItem.quantity,
              reason: wasteItem.reason,
            });
            wastes.push(waste);
          }
        }
      }

      // Commit transaction
      await this.db!.execAsync("COMMIT");

      // Sync if online
      let synced = false;
      const networkState = await NetInfo.fetch();
      if (networkState.isConnected && networkState.isInternetReachable) {
        synced = await this.syncCompleteHarvest(harvestId);
      }

      return {
        harvest: updatedHarvest,
        fruitWeights,
        wastes,
        synced,
      };
    } catch (error) {
      await this.db!.execAsync("ROLLBACK");
      console.error("Error in updateHarvest:", error);
      throw new Error("Failed to update harvest");
    }
  }

  async getTotalWeightThisWeek(): Promise<number> {
    await this.ensureDatabaseReady();

    const now = new Date();
    const startOfWeek = new Date(now);

    // Set to Sunday
    const day = now.getDay(); // 0 = Sunday
    startOfWeek.setDate(now.getDate() - day);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const startOfWeekISO = startOfWeek.toISOString();
    const endOfWeekISO = endOfWeek.toISOString();

    console.log(
      "Week range (Sunday to Saturday):",
      startOfWeekISO,
      "to",
      endOfWeekISO,
    );

    const result = await this.db!.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(weight), 0) as total FROM fruit_weights
        WHERE created_at >= ? AND created_at < ?`,
      [startOfWeekISO, endOfWeekISO],
    );

    return result?.total || 0;
  }

  // Delete Harvest (Soft Delete)
  async softDeleteHarvest(id: string): Promise<void> {
    await this.ensureDatabaseReady();

    await this.db!.runAsync(
      `UPDATE harvests SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), new Date().toISOString(), id],
    );
  }

  // Get count of unsynced harvests
  async getUnsyncedCount(): Promise<number> {
    await this.ensureDatabaseReady();

    const result = await this.db!.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM harvests WHERE is_synced = 0 AND deleted_at IS NULL`,
    );
    return result?.count || 0;
  }

  /**
   * Sync harvests from server to local database
   * This downloads harvests, fruit weights, and wastes from server
   */
  // async syncHarvestsFromServer(): Promise<{
  //   synced: number;
  //   errors: string[];
  // }> {
  //   await this.ensureDatabaseReady();

  //   const results = {
  //     synced: 0,
  //     errors: [] as string[],
  //   };

  //   try {
  //     const netInfo = await NetInfo.fetch();
  //     if (!netInfo.isConnected) {
  //       console.log("📴 Offline - Cannot sync harvests from server");
  //       return results;
  //     }

  //     console.log("🔄 Syncing harvests from server...");

  //     // Fetch all harvests
  //     const response = await client.get(`/harvests`);

  //     if (!response.data.success) {
  //       console.warn(`Failed to fetch harvests`);
  //       return results;
  //     }

  //     const allHarvests = response.data.data || [];
  //     console.log(`📥 Total harvests found: ${allHarvests.length}`);

  //     // Start transaction
  //     await this.db!.execAsync("BEGIN TRANSACTION");

  //     try {
  //       for (const remoteHarvest of allHarvests) {
  //         try {
  //           // Get fruit details to know total quantity
  //           const fruit = await this.db!.getFirstAsync<{
  //             id: string;
  //             quantity: number;
  //             remaining_quantity: number;
  //           }>(
  //             `SELECT id, quantity, remaining_quantity FROM fruits WHERE id = ? AND deleted_at IS NULL`,
  //             [remoteHarvest.fruit_id],
  //           );

  //           // ✅ Use status from server if available, otherwise calculate
  //           let harvestStatus = remoteHarvest.status || "pending";

  //           // If server has no status, calculate based on fruit_weights and wastes
  //           if (!remoteHarvest.status) {
  //             const totalWeights = remoteHarvest.fruit_weights?.length || 0;
  //             const totalWastes =
  //               remoteHarvest.wastes?.reduce(
  //                 (sum: number, w: any) => sum + (w.waste_quantity || 0),
  //                 0,
  //               ) || 0;
  //             const totalProcessed = totalWeights + totalWastes;

  //             if (fruit) {
  //               const fruitTotal = fruit.remaining_quantity || fruit.quantity;
  //               if (totalProcessed >= fruitTotal) {
  //                 harvestStatus = "harvested";
  //               } else if (totalProcessed > 0) {
  //                 harvestStatus = "partial";
  //               } else {
  //                 harvestStatus = "pending";
  //               }
  //             }
  //           }

  //           // Check if harvest already exists locally
  //           const existingHarvest = await this.db!.getFirstAsync<Harvest>(
  //             `SELECT * FROM harvests WHERE id = ? AND deleted_at IS NULL`,
  //             [remoteHarvest.id],
  //           );

  //           const now = new Date().toISOString();

  //           if (!existingHarvest) {
  //             // Insert new harvest with status from server
  //             await this.db!.runAsync(
  //               `INSERT INTO harvests (
  //               id, fruit_id, user_id, ripe_quantity, harvest_at, status,
  //               is_synced, created_at, updated_at
  //             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  //               [
  //                 remoteHarvest.id,
  //                 remoteHarvest.fruit_id,
  //                 remoteHarvest.user_id || null,
  //                 remoteHarvest.ripe_quantity || 0,
  //                 remoteHarvest.harvest_at || now,
  //                 harvestStatus,
  //                 1, // is_synced = true (from server)
  //                 remoteHarvest.created_at || now,
  //                 remoteHarvest.updated_at || now,
  //               ],
  //             );
  //             results.synced++;
  //             console.log(
  //               `✅ Added harvest ${remoteHarvest.id} to local DB (status: ${harvestStatus})`,
  //             );
  //           } else {
  //             // Update existing harvest if newer or status changed
  //             const localUpdatedAt = new Date(existingHarvest.updated_at || 0);
  //             const remoteUpdatedAt = new Date(remoteHarvest.updated_at || 0);

  //             if (
  //               remoteUpdatedAt > localUpdatedAt ||
  //               existingHarvest.status !== harvestStatus
  //             ) {
  //               await this.db!.runAsync(
  //                 `UPDATE harvests SET
  //                 fruit_id = ?,
  //                 user_id = ?,
  //                 ripe_quantity = ?,
  //                 harvest_at = ?,
  //                 status = ?,
  //                 is_synced = 1,
  //                 updated_at = ?
  //               WHERE id = ?`,
  //                 [
  //                   remoteHarvest.fruit_id,
  //                   remoteHarvest.user_id || null,
  //                   remoteHarvest.ripe_quantity || 0,
  //                   remoteHarvest.harvest_at || now,
  //                   harvestStatus,
  //                   remoteHarvest.updated_at || now,
  //                   remoteHarvest.id,
  //                 ],
  //               );
  //               results.synced++;
  //               console.log(
  //                 `✅ Updated harvest ${remoteHarvest.id} in local DB (status: ${existingHarvest.status} → ${harvestStatus})`,
  //               );
  //             }
  //           }

  //           // ✅ SYNC FRUIT WEIGHTS
  //           if (
  //             remoteHarvest.fruit_weights &&
  //             remoteHarvest.fruit_weights.length > 0
  //           ) {
  //             // Delete existing weights for this harvest
  //             await this.db!.runAsync(
  //               `DELETE FROM fruit_weights WHERE harvest_id = ?`,
  //               [remoteHarvest.id],
  //             );

  //             // Insert new weights
  //             for (const weight of remoteHarvest.fruit_weights) {
  //               await this.db!.runAsync(
  //                 `INSERT INTO fruit_weights (
  //                 id, harvest_id, weight, status, is_synced, created_at, updated_at
  //               ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  //                 [
  //                   weight.id,
  //                   remoteHarvest.id,
  //                   parseFloat(weight.weight),
  //                   weight.status || "local",
  //                   1,
  //                   weight.created_at || now,
  //                   weight.updated_at || now,
  //                 ],
  //               );
  //             }
  //             console.log(
  //               `  ⚖️ Synced ${remoteHarvest.fruit_weights.length} fruit weights for harvest ${remoteHarvest.id}`,
  //             );
  //           }

  //           // ✅ SYNC WASTES
  //           if (remoteHarvest.wastes && remoteHarvest.wastes.length > 0) {
  //             // Delete existing wastes for this harvest
  //             await this.db!.runAsync(
  //               `DELETE FROM wastes WHERE harvest_id = ?`,
  //               [remoteHarvest.id],
  //             );

  //             // Insert new wastes
  //             for (const waste of remoteHarvest.wastes) {
  //               await this.db!.runAsync(
  //                 `INSERT INTO wastes (
  //                 id, harvest_id, waste_quantity, reason, reported_at,
  //                 is_synced, created_at, updated_at
  //               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  //                 [
  //                   waste.id,
  //                   remoteHarvest.id,
  //                   waste.waste_quantity,
  //                   waste.reason,
  //                   waste.reported_at || now,
  //                   1,
  //                   waste.created_at || now,
  //                   waste.updated_at || now,
  //                 ],
  //               );
  //             }
  //             console.log(
  //               `  🗑️ Synced ${remoteHarvest.wastes.length} wastes for harvest ${remoteHarvest.id}`,
  //             );
  //           }

  //           // ✅ Update fruit's remaining quantity based on harvest data
  //           if (fruit) {
  //             // Calculate total processed from weights and wastes
  //             const totalWeights = remoteHarvest.fruit_weights?.length || 0;
  //             const totalWastes =
  //               remoteHarvest.wastes?.reduce(
  //                 (sum: number, w: any) => sum + (w.waste_quantity || 0),
  //                 0,
  //               ) || 0;
  //             const totalProcessed = totalWeights + totalWastes;

  //             if (totalProcessed > 0) {
  //               const currentRemaining =
  //                 fruit.remaining_quantity || fruit.quantity;
  //               const newRemaining = Math.max(
  //                 0,
  //                 currentRemaining - totalProcessed,
  //               );

  //               await this.db!.runAsync(
  //                 `UPDATE fruits SET remaining_quantity = ?, updated_at = ? WHERE id = ?`,
  //                 [newRemaining, now, fruit.id],
  //               );
  //               console.log(
  //                 `  🍎 Updated fruit ${fruit.id} remaining quantity: ${currentRemaining} → ${newRemaining}`,
  //               );
  //             }
  //           }
  //         } catch (harvestError: any) {
  //           const errorMsg = `Harvest ${remoteHarvest.id}: ${harvestError.message}`;
  //           results.errors.push(errorMsg);
  //           console.error(errorMsg);
  //         }
  //       }

  //       // Commit transaction
  //       await this.db!.execAsync("COMMIT");
  //       console.log(
  //         `✅ Harvest sync completed: ${results.synced} harvests synced, ${results.errors.length} errors`,
  //       );
  //     } catch (error) {
  //       await this.db!.execAsync("ROLLBACK");
  //       throw error;
  //     }

  //     return results;
  //   } catch (error: any) {
  //     console.error("❌ Failed to sync harvests from server:", error);
  //     throw new Error(`Failed to sync harvests: ${error.message}`);
  //   }
  // }

  async syncHarvestsFromServer(): Promise<{
    synced: number;
    errors: string[];
  }> {
    await this.ensureDatabaseReady();

    const results = {
      synced: 0,
      errors: [] as string[],
    };

    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.log("📴 Offline - Cannot sync harvests from server");
        return results;
      }

      console.log("🔄 Syncing harvests from server...");

      // STEP 1: Fetch all harvests in ONE request
      const response = await client.get(`/harvests`);

      if (!response.data.success) {
        console.warn(`Failed to fetch harvests`);
        return results;
      }

      const allHarvests = response.data.data || [];
      console.log(`📥 Total harvests found: ${allHarvests.length}`);

      if (allHarvests.length === 0) {
        return results;
      }

      // STEP 2: Get ALL existing harvests in ONE query
      const existingHarvests = await this.db!.getAllAsync<{
        id: string;
        updated_at: string;
        status: string;
      }>(
        "SELECT id, updated_at, status FROM harvests WHERE deleted_at IS NULL",
      );

      const existingHarvestMap = new Map(
        existingHarvests.map((h) => [h.id, h]),
      );

      // STEP 3: Get ALL existing fruit weights in ONE query
      const existingWeights = await this.db!.getAllAsync<{
        id: string;
        harvest_id: string;
      }>("SELECT id, harvest_id FROM fruit_weights");

      const weightsByHarvest = new Map<string, Set<string>>();
      for (const weight of existingWeights) {
        if (!weightsByHarvest.has(weight.harvest_id)) {
          weightsByHarvest.set(weight.harvest_id, new Set());
        }
        weightsByHarvest.get(weight.harvest_id)!.add(weight.id);
      }

      // STEP 4: Get ALL existing wastes in ONE query
      const existingWastes = await this.db!.getAllAsync<{
        id: string;
        harvest_id: string;
      }>("SELECT id, harvest_id FROM wastes");

      const wastesByHarvest = new Map<string, Set<string>>();
      for (const waste of existingWastes) {
        if (!wastesByHarvest.has(waste.harvest_id)) {
          wastesByHarvest.set(waste.harvest_id, new Set());
        }
        wastesByHarvest.get(waste.harvest_id)!.add(waste.id);
      }

      // STEP 5: Get ALL fruits for remaining quantity updates
      const allFruits = await this.db!.getAllAsync<{
        id: string;
        quantity: number;
        remaining_quantity: number;
      }>(
        "SELECT id, quantity, remaining_quantity FROM fruits WHERE deleted_at IS NULL",
      );

      const fruitMap = new Map(allFruits.map((f) => [f.id, f]));

      // STEP 6: Prepare data for bulk operations
      const toInsert: any[] = [];
      const toUpdate: any[] = [];
      const weightsToInsert: any[] = [];
      const wastesToInsert: any[] = [];
      const weightsToDelete: string[] = [];
      const wastesToDelete: string[] = [];
      const fruitUpdates: Map<string, number> = new Map();

      const now = new Date().toISOString();

      for (const remoteHarvest of allHarvests) {
        const existing = existingHarvestMap.get(remoteHarvest.id);
        const remoteUpdated = new Date(remoteHarvest.updated_at || 0).getTime();
        const localUpdated = existing
          ? new Date(existing.updated_at || 0).getTime()
          : 0;

        // Calculate harvest status
        let harvestStatus = remoteHarvest.status || "pending";

        if (!remoteHarvest.status) {
          const totalWeights = remoteHarvest.fruit_weights?.length || 0;
          const totalWastes =
            remoteHarvest.wastes?.reduce(
              (sum: number, w: any) => sum + (w.waste_quantity || 0),
              0,
            ) || 0;
          const totalProcessed = totalWeights + totalWastes;

          const fruit = fruitMap.get(remoteHarvest.fruit_id);
          if (fruit) {
            const fruitTotal = fruit.remaining_quantity || fruit.quantity;
            if (totalProcessed >= fruitTotal) {
              harvestStatus = "harvested";
            } else if (totalProcessed > 0) {
              harvestStatus = "partial";
            }
          }
        }

        // Determine if need to insert or update
        if (!existing || remoteUpdated > localUpdated) {
          if (!existing) {
            toInsert.push({
              ...remoteHarvest,
              _status: harvestStatus,
              _now: now,
            });
          } else {
            toUpdate.push({
              ...remoteHarvest,
              _status: harvestStatus,
              _now: now,
            });
          }

          // Prepare fruit weights
          if (remoteHarvest.fruit_weights?.length > 0) {
            // Mark old weights for deletion
            const oldWeights = weightsByHarvest.get(remoteHarvest.id);
            if (oldWeights) {
              weightsToDelete.push(...Array.from(oldWeights));
            }

            // Prepare new weights
            for (const weight of remoteHarvest.fruit_weights) {
              weightsToInsert.push({
                id: weight.id,
                harvest_id: remoteHarvest.id,
                weight: parseFloat(weight.weight),
                status: weight.status || "local",
                created_at: weight.created_at || now,
                updated_at: weight.updated_at || now,
              });
            }
          }

          // Prepare wastes
          if (remoteHarvest.wastes?.length > 0) {
            // Mark old wastes for deletion
            const oldWastes = wastesByHarvest.get(remoteHarvest.id);
            if (oldWastes) {
              wastesToDelete.push(...Array.from(oldWastes));
            }

            // Prepare new wastes
            for (const waste of remoteHarvest.wastes) {
              wastesToInsert.push({
                id: waste.id,
                harvest_id: remoteHarvest.id,
                waste_quantity: waste.waste_quantity,
                reason: waste.reason,
                reported_at: waste.reported_at || now,
                created_at: waste.created_at || now,
                updated_at: waste.updated_at || now,
              });
            }
          }

          // Calculate fruit remaining quantity
          const fruit = fruitMap.get(remoteHarvest.fruit_id);
          if (fruit) {
            const totalWeights = remoteHarvest.fruit_weights?.length || 0;
            const totalWastes =
              remoteHarvest.wastes?.reduce(
                (sum: number, w: any) => sum + (w.waste_quantity || 0),
                0,
              ) || 0;
            const totalProcessed = totalWeights + totalWastes;

            if (totalProcessed > 0) {
              const currentRemaining =
                fruit.remaining_quantity || fruit.quantity;
              const newRemaining = Math.max(
                0,
                currentRemaining - totalProcessed,
              );
              fruitUpdates.set(fruit.id, newRemaining);
            }
          }
        }
      }

      console.log(
        `📊 Summary: ${toInsert.length} inserts, ${toUpdate.length} updates, ${weightsToInsert.length} weights, ${wastesToInsert.length} wastes`,
      );

      // STEP 7: Execute ALL operations in ONE transaction
      await this.db!.execAsync("BEGIN TRANSACTION");

      try {
        // Delete old weights
        if (weightsToDelete.length > 0) {
          for (const weightId of weightsToDelete) {
            await this.db!.runAsync("DELETE FROM fruit_weights WHERE id = ?", [
              weightId,
            ]);
          }
          console.log(`🗑️ Deleted ${weightsToDelete.length} old weights`);
        }

        // Delete old wastes
        if (wastesToDelete.length > 0) {
          for (const wasteId of wastesToDelete) {
            await this.db!.runAsync("DELETE FROM wastes WHERE id = ?", [
              wasteId,
            ]);
          }
          console.log(`🗑️ Deleted ${wastesToDelete.length} old wastes`);
        }

        // Bulk insert harvests
        for (const harvest of toInsert) {
          await this.db!.runAsync(
            `INSERT INTO harvests (
            id, fruit_id, user_id, ripe_quantity, harvest_at, status,
            is_synced, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              harvest.id,
              harvest.fruit_id,
              harvest.user_id || null,
              harvest.ripe_quantity || 0,
              harvest.harvest_at || harvest._now,
              harvest._status,
              1,
              harvest.created_at || harvest._now,
              harvest.updated_at || harvest._now,
            ],
          );
          results.synced++;
        }

        // Bulk update harvests
        for (const harvest of toUpdate) {
          await this.db!.runAsync(
            `UPDATE harvests SET 
            fruit_id = ?, user_id = ?, ripe_quantity = ?, harvest_at = ?,
            status = ?, is_synced = 1, updated_at = ?
          WHERE id = ?`,
            [
              harvest.fruit_id,
              harvest.user_id || null,
              harvest.ripe_quantity || 0,
              harvest.harvest_at || harvest._now,
              harvest._status,
              harvest.updated_at || harvest._now,
              harvest.id,
            ],
          );
          results.synced++;
        }

        // Insert new weights
        for (const weight of weightsToInsert) {
          await this.db!.runAsync(
            `INSERT INTO fruit_weights (
            id, harvest_id, weight, status, is_synced, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              weight.id,
              weight.harvest_id,
              weight.weight,
              weight.status,
              1,
              weight.created_at,
              weight.updated_at,
            ],
          );
        }

        // Insert new wastes
        for (const waste of wastesToInsert) {
          await this.db!.runAsync(
            `INSERT INTO wastes (
            id, harvest_id, waste_quantity, reason, reported_at,
            is_synced, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              waste.id,
              waste.harvest_id,
              waste.waste_quantity,
              waste.reason,
              waste.reported_at,
              1,
              waste.created_at,
              waste.updated_at,
            ],
          );
        }

        // Update fruit remaining quantities
        for (const [fruitId, newRemaining] of fruitUpdates) {
          await this.db!.runAsync(
            `UPDATE fruits SET remaining_quantity = ?, updated_at = ? WHERE id = ?`,
            [newRemaining, now, fruitId],
          );
        }

        await this.db!.execAsync("COMMIT");

        console.log(
          `✅ Harvest sync completed: ${results.synced} synced, ${weightsToInsert.length} weights, ${wastesToInsert.length} wastes`,
        );
      } catch (error) {
        await this.db!.execAsync("ROLLBACK");
        throw error;
      }

      return results;
    } catch (error: any) {
      console.error("❌ Failed to sync harvests from server:", error);
      throw new Error(`Failed to sync harvests: ${error.message}`);
    }
  }
  /**
   * Get all harvests with complete details (fruit, tree, user, weights, wastes)
   * Matches the API response structure
   */
  /**
   * Get all harvests with complete details (fruit, tree, user, weights, wastes)
   * Simplified version to avoid complex JOINs
   */
  async getAllHarvests(): Promise<Harvest[]> {
    await this.ensureDatabaseReady();

    try {
      // Get all harvests with their related data
      const harvests = await this.db!.getAllAsync<any>(
        `SELECT 
        h.*,
        f.id as fruit_id,
        f.flower_id,
        f.tree_id,
        f.quantity as fruit_quantity,
        f.bagged_at,
        f.image_uri,
        t.id as tree_id_ref,
        t.description as tree_description,
        t.latitude,
        t.longitude,
        t.type as tree_type,
        u.id as user_id_ref,
        u.first_name,
        u.last_name,
        u.email
      FROM harvests h
      LEFT JOIN fruits f ON h.fruit_id = f.id
      LEFT JOIN trees t ON f.tree_id = t.id
      LEFT JOIN users u ON h.user_id = u.id
      WHERE h.deleted_at IS NULL 
      ORDER BY h.harvest_at DESC
      `,
      );

      // Transform to match your Harvest interface
      const transformedHarvests = harvests.map((harvest) => ({
        id: harvest.id,
        fruit_id: harvest.fruit_id,
        user_id: harvest.user_id,
        ripe_quantity: harvest.ripe_quantity,
        harvest_at: harvest.harvest_at,
        status: harvest.status,
        created_at: harvest.created_at,
        updated_at: harvest.updated_at,
        total_weight: harvest.total_weight || 0,
        total_waste: harvest.total_waste || 0,
        fruit: {
          id: harvest.fruit_id,
          flower_id: harvest.flower_id,
          tree_id: harvest.tree_id,
          user_id: harvest.user_id,
          quantity: harvest.fruit_quantity,
          bagged_at: harvest.bagged_at,
          image_url: harvest.image_uri,
          created_at: harvest.created_at,
          updated_at: harvest.updated_at,
          tree: {
            id: harvest.tree_id_ref,
            description: harvest.tree_description,
            latitude: harvest.latitude,
            longitude: harvest.longitude,
            status: "active",
            is_synced: true,
            type: harvest.tree_type,
            image_url: "",
            created_at: harvest.created_at,
            updated_at: harvest.updated_at,
          },
        },
        fruit_weights: [], // You'll need to fetch these separately
        wastes: [], // You'll need to fetch these separately
        user: {
          id: harvest.user_id_ref,
          first_name: harvest.first_name,
          last_name: harvest.last_name,
          gender: "",
          email: harvest.email,
          role: "user",
          created_at: harvest.created_at,
          updated_at: harvest.updated_at,
        },
      }));

      return transformedHarvests;
    } catch (err) {
      console.error("Error fetching all harvests:", err);
      return [];
    }
  }

  // Helper method to get just the count
  async getLocalHarvestCount(): Promise<number> {
    await this.ensureDatabaseReady();

    try {
      const result = await this.db!.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM harvests WHERE deleted_at IS NULL`,
      );
      return result?.count || 0;
    } catch (err) {
      console.error("Error getting harvest count:", err);
      return 0;
    }
  }

  /**
   * Get total harvest statistics from COMPLETED harvests (status = 'harvested')
   * Returns total harvest count, total weight, and total waste
   */
  async getCompletedHarvestStats(): Promise<{
    totalHarvest: number;
    totalWeight: number;
    totalWaste: number;
  }> {
    await this.ensureDatabaseReady();

    try {
      // 1. Get all completed harvest IDs
      const completedHarvests = await this.db!.getAllAsync<{ id: string }>(
        `SELECT id FROM harvests WHERE status = 'harvested' AND deleted_at IS NULL`,
      );

      if (completedHarvests.length === 0) {
        return {
          totalHarvest: 0,
          totalWeight: 0,
          totalWaste: 0,
        };
      }

      const harvestIds = completedHarvests.map((h) => h.id);

      // 2. Count total fruit_weights (this equals number of harvested fruits)
      let totalHarvest = 0;
      let totalWeight = 0;
      let totalWaste = 0;

      // Loop through each harvest to get its weights and wastes
      for (const harvestId of harvestIds) {
        // Get fruit weights for this harvest
        const weights = await this.db!.getAllAsync<{ weight: number }>(
          `SELECT weight FROM fruit_weights WHERE harvest_id = ? AND deleted_at IS NULL`,
          [harvestId],
        );

        totalHarvest += weights.length;
        totalWeight += weights.reduce((sum, w) => sum + w.weight, 0);

        // Get wastes for this harvest
        const wastes = await this.db!.getAllAsync<{ waste_quantity: number }>(
          `SELECT waste_quantity FROM wastes WHERE harvest_id = ? AND deleted_at IS NULL`,
          [harvestId],
        );

        totalWaste += wastes.reduce((sum, w) => sum + w.waste_quantity, 0);
      }

      console.log(`📊 Completed harvest stats:`, {
        totalHarvest,
        totalWeight,
        totalWaste,
      });

      return {
        totalHarvest,
        totalWeight,
        totalWaste,
      };
    } catch (error) {
      console.error("Error getting completed harvest stats:", error);
      return {
        totalHarvest: 0,
        totalWeight: 0,
        totalWaste: 0,
      };
    }
  }

  /**
   * Check if harvests need sync from server
   */
  async checkAndSync(): Promise<{ needsSync: boolean; harvestCount: number }> {
    await this.ensureDatabaseReady();

    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.log("📴 Offline - Cannot check harvest sync status");
        return { needsSync: false, harvestCount: 0 };
      }

      // Get harvests from server (paginated response)
      const response = await client.get("/harvests");

      if (!response.data.success) {
        console.warn("Failed to get harvests from server");
        return { needsSync: false, harvestCount: 0 };
      }

      // Extract total count from pagination data
      const remoteCount = response.data.data?.total || 0;

      // Always need sync if there are harvests on server
      return {
        needsSync: remoteCount > 0,
        harvestCount: remoteCount,
      };
    } catch (error: any) {
      console.error("Error checking harvest sync status:", error);
      return { needsSync: false, harvestCount: 0 };
    }
  }

  /**
   * Get harvests by fruit ID with weights and wastes
   */
  async getHarvestsByFruitId(fruitId: string): Promise<{
    harvests: Harvest[];
    fruitWeights: FruitWeight[];
    wastes: Waste[];
  }> {
    await this.ensureDatabaseReady();

    try {
      // Get all harvests for this fruit
      const harvests = await this.db!.getAllAsync<Harvest>(
        `SELECT * FROM harvests WHERE fruit_id = ? AND deleted_at IS NULL ORDER BY harvest_at DESC`,
        [fruitId],
      );

      let allFruitWeights: FruitWeight[] = [];
      let allWastes: Waste[] = [];

      for (const harvest of harvests) {
        const weights = await this.getFruitWeightsByHarvestId(harvest.id);
        const wastes = await this.getWastesByHarvestId(harvest.id);

        allFruitWeights = [...allFruitWeights, ...weights];
        allWastes = [...allWastes, ...wastes];
      }

      return {
        harvests,
        fruitWeights: allFruitWeights,
        wastes: allWastes,
      };
    } catch (error) {
      console.error(`Error fetching harvests for fruit ${fruitId}:`, error);
      return { harvests: [], fruitWeights: [], wastes: [] };
    }
  }

  // Sync all unsynced harvests (for background sync) - UPDATED to return results
  async syncAllUnsyncedHarvests(): Promise<{
    synced: number;
    errors: string[];
  }> {
    await this.ensureDatabaseReady();

    const unsyncedHarvests = await this.db!.getAllAsync<Harvest>(
      `SELECT * FROM harvests WHERE (is_synced = 0 OR is_synced IS NULL) AND deleted_at IS NULL`,
    );

    const results = {
      synced: 0,
      errors: [] as string[],
    };

    console.log(`Found ${unsyncedHarvests.length} unsynced harvest(s) to sync`);

    for (const harvest of unsyncedHarvests) {
      try {
        const success = await this.syncCompleteHarvest(harvest.id);

        if (success) {
          results.synced++;
          console.log(
            `✅ Successfully synced harvest ID: ${harvest.id} (${results.synced}/${unsyncedHarvests.length})`,
          );
        } else {
          results.errors.push(`Harvest ${harvest.id}: Sync failed`);
          console.warn(`❌ Failed to sync harvest ID: ${harvest.id}`);
        }
      } catch (err: any) {
        results.errors.push(`Harvest ${harvest.id}: ${err.message}`);
        console.error(`💥 Error syncing harvest ID ${harvest.id}:`, err);
      }
    }

    console.log(
      `📊 Finished syncing unsynced harvests: ${results.synced} synced, ${results.errors.length} errors`,
    );
    return results;
  }

  /**
   * Create harvest assignments for bagged fruits
   * This creates new harvest records with just fruit_id and user_id
   * Other fields (ripe_quantity, weights, wastes) will be filled during actual harvest
   */
  async createHarvestAssignments(
    fruitIds: string[],
    userId: string,
  ): Promise<{
    success: boolean;
    createdCount: number;
    harvests: Harvest[];
    errors: string[];
  }> {
    await this.ensureDatabaseReady();

    const results: Harvest[] = [];
    const errors: string[] = [];
    let createdCount = 0;

    // Start transaction
    await this.db!.execAsync("BEGIN TRANSACTION");

    try {
      for (const fruitId of fruitIds) {
        try {
          // Check if harvest already exists for this fruit
          const existingHarvest = await this.getHarvestByFruitId(fruitId);

          if (existingHarvest) {
            // If harvest exists but no user assigned, update it
            if (!existingHarvest.user_id) {
              await this.db!.runAsync(
                `UPDATE harvests 
               SET user_id = ?, updated_at = CURRENT_TIMESTAMP,status = 'pending', is_synced = 0
               WHERE id = ? AND deleted_at IS NULL`,
                [userId, existingHarvest.id],
              );

              const updatedHarvest = await this.db!.getFirstAsync<Harvest>(
                `SELECT * FROM harvests WHERE id = ?`,
                [existingHarvest.id],
              );

              if (updatedHarvest) {
                results.push(updatedHarvest);
                createdCount++;
              }
            } else {
              errors.push(`Fruit ${fruitId} already has a harvester assigned`);
            }
          } else {
            // Create NEW harvest record with just fruit_id and user_id
            const id = this.generateUUID();
            const now = new Date().toISOString();

            await this.db!.runAsync(
              `INSERT INTO harvests (
              id, 
              fruit_id, 
              user_id, 
              ripe_quantity, 
              is_synced, 
              created_at, 
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                id,
                fruitId,
                userId,
                0, // ripe_quantity set to 0 initially (will be updated during actual harvest)
                0, // is_synced = false
                now,
                now,
              ],
            );

            // Get created harvest
            const newHarvest = await this.db!.getFirstAsync<Harvest>(
              `SELECT * FROM harvests WHERE id = ?`,
              [id],
            );

            if (newHarvest) {
              results.push(newHarvest);
              createdCount++;
            }
          }
        } catch (error: any) {
          errors.push(`Fruit ${fruitId}: ${error.message}`);
          console.error(
            `Error creating harvest assignment for fruit ${fruitId}:`,
            error,
          );
        }
      }

      if (createdCount > 0) {
        await this.db!.execAsync("COMMIT");

        // Try to sync assignments to server if online
        try {
          const netInfo = await NetInfo.fetch();
          if (netInfo.isConnected) {
            for (const harvest of results) {
              await this.syncHarvestAssignment(harvest.id);
            }
          }
        } catch (syncError) {
          console.error("Error syncing assignments:", syncError);
        }
      } else {
        await this.db!.execAsync("ROLLBACK");
      }

      return {
        success: createdCount > 0,
        createdCount,
        harvests: results,
        errors,
      };
    } catch (error: any) {
      await this.db!.execAsync("ROLLBACK");
      console.error("Error in createHarvestAssignments:", error);
      throw new Error(`Failed to create harvest assignments: ${error.message}`);
    }
  }

  /**
   * Sync a harvest assignment to server
   */
  async syncHarvestAssignment(harvestId: string): Promise<boolean> {
    await this.ensureDatabaseReady();

    try {
      const harvest = await this.db!.getFirstAsync<Harvest>(
        `SELECT * FROM harvests WHERE id = ? AND deleted_at IS NULL`,
        [harvestId],
      );

      if (!harvest) {
        console.warn(`No harvest found for sync with ID: ${harvestId}`);
        return false;
      }

      // Prepare payload for assignment only
      const payload = {
        id: harvest.id,
        fruit_id: harvest.fruit_id,
        user_id: harvest.user_id,
        harvest_at: new Date().toISOString().split("T")[0],
        ripe_quantity: 0, // Will be updated during actual harvest
        status: "assigned", // Mark as assigned, not yet harvested
      };

      const response = await client.post("/harvest/assign", payload);

      if (response.data.success) {
        // Mark as synced
        await this.db!.runAsync(
          `UPDATE harvests SET is_synced = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [harvestId],
        );
        console.log(`✅ Harvest assignment ${harvestId} synced successfully`);
        return true;
      }

      return false;
    } catch (error: any) {
      console.error(`Error syncing harvest assignment ${harvestId}:`, error);
      return false;
    }
  }
  /**
   * Get assigned harvests with fruit and tree details
   * Aligned with actual schema
   */
  async getAssignedHarvests(): Promise<any[]> {
    await this.ensureDatabaseReady();

    try {
      const query = `
      SELECT 
        h.*,
        f.id as fruit_id,
        f.flower_id as fruit_flower_id,
        f.tree_id as fruit_tree_id,
        f.quantity as fruit_quantity,
        f.bagged_at as fruit_bagged_at,
        f.image_uri as fruit_image_uri,
        f.status as fruit_status,
        f.created_at as fruit_created_at,
        f.updated_at as fruit_updated_at,
        f.deleted_at as fruit_deleted_at,
        t.id as tree_uuid,
        t.description as tree_description,
        t.latitude as tree_latitude,
        t.longitude as tree_longitude,
        t.status as tree_status,
        t.created_at as tree_created_at,
        t.updated_at as tree_updated_at
      FROM harvests h
      LEFT JOIN fruits f ON h.fruit_id = f.id AND f.deleted_at IS NULL
      LEFT JOIN trees t ON f.tree_id = t.id AND t.deleted_at IS NULL
      WHERE h.user_id IS NOT NULL 
        AND h.user_id != '' 
        AND (h.ripe_quantity = 0 OR h.ripe_quantity IS NULL)
        AND h.deleted_at IS NULL 
      ORDER BY h.created_at DESC
    `;

      const results = await this.db!.getAllAsync(query);

      // Transform the results to include nested objects
      return results.map((row: any) => ({
        id: row.id,
        fruit_id: row.fruit_id,
        user_id: row.user_id,
        ripe_quantity: row.ripe_quantity,
        harvest_at: row.harvest_at,
        is_synced: Boolean(row.is_synced),
        created_at: row.created_at,
        updated_at: row.updated_at,
        deleted_at: row.deleted_at,
        // Fruit details
        fruit: row.fruit_id
          ? {
              id: row.fruit_id,
              flower_id: row.fruit_flower_id,
              tree_id: row.fruit_tree_id,
              quantity: row.fruit_quantity,
              bagged_at: row.fruit_bagged_at,
              image_uri: row.fruit_image_uri,
              status: row.fruit_status,
              created_at: row.fruit_created_at,
              updated_at: row.fruit_updated_at,
              deleted_at: row.fruit_deleted_at,
              // Tree details nested inside fruit
              tree: row.tree_uuid
                ? {
                    uuid: row.tree_uuid,
                    description: row.tree_description,
                    latitude: row.tree_latitude,
                    longitude: row.tree_longitude,
                    status: row.tree_status,
                    created_at: row.tree_created_at,
                    updated_at: row.tree_updated_at,
                  }
                : null,
            }
          : null,
      }));
    } catch (error) {
      console.error("Error fetching assigned harvests:", error);
      return [];
    }
  }

  /**
   * Get assigned harvests by user ID with fruit and tree details
   */
  async getAssignmentsByUserId(userId: string): Promise<any[]> {
    await this.ensureDatabaseReady();

    try {
      const query = `
      SELECT 
        h.*,
        f.id as fruit_id,
        f.flower_id as fruit_flower_id,
        f.tree_id as fruit_tree_id,
        f.tag_id as fruit_tag_id,
        f.quantity as fruit_quantity,
        f.remaining_quantity as fruit_remaining_quantity,
        f.bagged_at as fruit_bagged_at,
        f.image_uri as fruit_image_uri,
        f.status as fruit_status,
        f.farmer_extra_days as fruit_farmer_extra_days,
        f.farmer_assessed_at as fruit_farmer_assessed_at,
        f.next_check_date as fruit_next_check_date,
        f.farmer_notes as fruit_farmer_notes,
        f.created_at as fruit_created_at,
        f.updated_at as fruit_updated_at,
        f.deleted_at as fruit_deleted_at,
        t.id as tree_uuid,
        t.description as tree_description,
        t.latitude as tree_latitude,
        t.longitude as tree_longitude,
        t.status as tree_status,
        t.created_at as tree_created_at,
        t.updated_at as tree_updated_at
      FROM harvests h
      LEFT JOIN fruits f ON h.fruit_id = f.id AND f.deleted_at IS NULL
      LEFT JOIN trees t ON f.tree_id = t.id 
      WHERE h.user_id = ? 
        AND h.deleted_at IS NULL 
      ORDER BY 
        CASE 
          WHEN h.status = 'pending' THEN 1
          WHEN h.status = 'partial' THEN 2
          ELSE 3
        END,
        h.created_at DESC
    `;

      const results = await this.db!.getAllAsync(query, [userId]);

      // ✅ Fetch fruit_weights and wastes for each harvest
      const enrichedResults = await Promise.all(
        results.map(async (row: any) => {
          const fruitWeights = await this.getFruitWeightsByHarvestId(row.id);
          const wastes = await this.getWastesByHarvestId(row.id);

          return {
            id: row.id,
            fruit_id: row.fruit_id,
            user_id: row.user_id,
            ripe_quantity: row.ripe_quantity,
            status: row.status,
            harvest_at: row.harvest_at,
            is_synced: Boolean(row.is_synced),
            created_at: row.created_at,
            updated_at: row.updated_at,
            deleted_at: row.deleted_at,
            fruit_weights: fruitWeights, // ✅ ADD THIS
            wastes: wastes, // ✅ ADD THIS
            fruit: row.fruit_id
              ? {
                  id: row.fruit_id,
                  flower_id: row.fruit_flower_id,
                  tree_id: row.fruit_tree_id,
                  tag_id: row.fruit_tag_id,
                  quantity: row.fruit_quantity,
                  remaining_quantity: row.fruit_remaining_quantity,
                  bagged_at: row.fruit_bagged_at,
                  image_uri: row.fruit_image_uri,
                  status: row.fruit_status,
                  created_at: row.fruit_created_at,
                  updated_at: row.fruit_updated_at,
                  deleted_at: row.fruit_deleted_at,
                  farmer_extra_days: row.fruit_farmer_extra_days,
                  farmer_assessed_at: row.fruit_farmer_assessed_at,
                  next_check_date: row.fruit_next_check_date,
                  farmer_notes: row.fruit_farmer_notes,
                  tree: row.tree_uuid
                    ? {
                        uuid: row.tree_uuid,
                        description: row.tree_description,
                        latitude: row.tree_latitude,
                        longitude: row.tree_longitude,
                        status: row.tree_status,
                        created_at: row.tree_created_at,
                        updated_at: row.tree_updated_at,
                      }
                    : null,
                }
              : null,
          };
        }),
      );

      return enrichedResults;
    } catch (error) {
      console.error(
        `Error fetching assigned harvests for user ${userId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Get a single assigned harvest by ID with fruit and tree details
   */

  async getAssignedHarvestById(harvestId: string): Promise<any | null> {
    await this.ensureDatabaseReady();

    try {
      const query = `
      SELECT 
        h.*,
        f.id as fruit_id,
        f.flower_id as fruit_flower_id,
        f.tree_id as fruit_tree_id,
        f.tag_id as fruit_tag_id,
        f.quantity as fruit_quantity,
        f.remaining_quantity as fruit_remaining_quantity,  
        f.bagged_at as fruit_bagged_at,
        f.image_uri as fruit_image_uri,
        f.status as fruit_status,
        f.created_at as fruit_created_at,
        f.updated_at as fruit_updated_at,
        f.deleted_at as fruit_deleted_at,
        t.id as tree_uuid,
        t.description as tree_description,
        t.latitude as tree_latitude,
        t.longitude as tree_longitude,
        t.status as tree_status,
        t.created_at as tree_created_at,
        t.updated_at as tree_updated_at
      FROM harvests h
      LEFT JOIN fruits f ON h.fruit_id = f.id AND f.deleted_at IS NULL
      LEFT JOIN trees t ON f.tree_id = t.id AND t.deleted_at IS NULL
      WHERE h.id = ? 
        AND h.deleted_at IS NULL
    `;

      const row = await this.db!.getFirstAsync(query, [harvestId]);

      if (!row) return null;

      return {
        id: row.id,
        fruit_id: row.fruit_id,
        user_id: row.user_id,
        ripe_quantity: row.ripe_quantity,
        harvest_at: row.harvest_at,
        is_synced: Boolean(row.is_synced),
        created_at: row.created_at,
        updated_at: row.updated_at,
        deleted_at: row.deleted_at,
        status: row.status, // ✅ Also add status field
        fruit: row.fruit_id
          ? {
              id: row.fruit_id,
              flower_id: row.fruit_flower_id,
              tree_id: row.fruit_tree_id,
              tag_id: row.fruit_tag_id,
              quantity: row.fruit_quantity,
              remaining_quantity: row.fruit_remaining_quantity, // ✅ Now this will work
              bagged_at: row.fruit_bagged_at,
              image_uri: row.fruit_image_uri,
              status: row.fruit_status,
              created_at: row.fruit_created_at,
              updated_at: row.fruit_updated_at,
              deleted_at: row.fruit_deleted_at,
              tree: row.tree_uuid
                ? {
                    uuid: row.tree_uuid,
                    description: row.tree_description,
                    latitude: row.tree_latitude,
                    longitude: row.tree_longitude,
                    status: row.tree_status,
                    created_at: row.tree_created_at,
                    updated_at: row.tree_updated_at,
                  }
                : null,
            }
          : null,
      };
    } catch (error) {
      console.error(`Error fetching assigned harvest ${harvestId}:`, error);
      return null;
    }
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
        status: harvest.status,
        is_synced: harvest.is_synced,
        user_id: harvest.user_id,
      });

      // FIRST: Check if harvest exists on the server
      let harvestExists = false;
      try {
        console.log(`🔍 Checking if harvest ${harvestId} exists on server...`);
        const checkResponse = await client.get(`/harvests/${harvestId}`);

        if (checkResponse.status === 200 && checkResponse.data) {
          harvestExists = true;
          console.log(`✅ Harvest ${harvestId} exists on server`);
        }
      } catch (checkError: any) {
        // If 404, harvest doesn't exist on server
        if (checkError.response?.status === 404) {
          console.log(
            `📝 Harvest ${harvestId} not found on server - will create assignment first`,
          );
          harvestExists = false;
        } else {
          // Other error (network, etc.) - log but continue to try sync
          console.warn(
            `⚠️ Error checking harvest existence:`,
            checkError.message,
          );
        }
      }

      // If harvest doesn't exist on server, create assignment first
      if (!harvestExists) {
        console.log(
          `🔄 Creating harvest assignment for ID: ${harvestId} first...`,
        );
        const assignmentSuccess = await this.syncHarvestAssignment(harvestId);

        if (!assignmentSuccess) {
          console.error(
            `❌ Failed to create harvest assignment for ID: ${harvestId}`,
          );
          return false;
        }

        console.log(
          `✅ Harvest assignment created successfully for ID: ${harvestId}`,
        );

        // Wait a bit for server to process the assignment
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Now proceed with full harvest sync (weights and wastes)
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
        status: harvest.status || "harvested", // Default to 'harvested' if status is not set
        harvest_at: new Date().toISOString().split("T")[0],
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
        const response = await client.put("/harvests/" + harvestId, payload);

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
          console.error(`  No response received:`, apiError.request);
        } else {
          console.error(`  Request setup error:`, apiError.message);
        }

        return false;
      }
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
      // ✅ Make sure these are called
      fruitWeights = await this.getFruitWeightsByHarvestId(harvest.id);
      wastes = await this.getWastesByHarvestId(harvest.id);

      totalWeight = fruitWeights.reduce((sum, w) => sum + w.weight, 0);
      averageWeight =
        fruitWeights.length > 0 ? totalWeight / fruitWeights.length : 0;
      totalWaste = wastes.reduce((sum, w) => sum + w.waste_quantity, 0);
    }

    console.log(`📊 Harvest details for fruit ${fruitId}:`);
    console.log(`   - Fruit weights: ${fruitWeights.length}`);
    console.log(`   - Wastes: ${wastes.length}`);

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
