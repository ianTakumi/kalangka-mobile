export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  gender: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

// types/index.ts
export interface Tree {
  id: string;
  type: string;
  description: string;
  latitude: number;
  longitude: number;
  status: "active" | "inactive";
  created_at: Date | null;
  image_path: string;
  updated_at: Date | null;
  is_synced: boolean;
  role: string;
}

export interface Flower {
  id: string;
  tree_id: string;
  quantity: number;
  wrapped_at: Date;
  image_url: string;
  created_at: Date | null;
  updated_at: Date | null;
  deleted_at: Date | null;
  is_synced: boolean;
}

export interface Fruit {
  id: string;
  flower_id: string;
  tree_id: string;
  quantity: number;
  bagged_at: Date;
  image_uri: string;
  created_at: Date | null;
  updated_at: Date | null;
  deleted_at: Date | null;
  is_synced?: boolean;
}

export interface FruitWeight {
  id: string;
  weight_id: number;
  harvest_id: number;
  weight: number; // decimal(4,2) - 2 decimal places
  status: string;
  deleted_at: Date | null;
  created_at: Date | null;
  updated_at: Date | null;
}

export interface Harvest {
  id: string;
  fruit_id: string;
  ripe_quantity: number;
  harvest_date: Date;
  created_at: Date | null;
  updated_at: Date | null;
  deleted_at: Date | null;
}

// Optional: Combined types for UI
export interface TreeWithDetails extends Tree {
  flowers_count?: number;
  fruits_count?: number;
  harvests_count?: number;
  total_weight?: number;
}

export interface FlowerWithTree extends Flower {
  tree?: Tree;
}

export interface FruitWithDetails extends Fruit {
  flower?: Flower;
  tree?: Tree;
  harvests?: Harvest[];
  weights?: FruitWeight[];
}

export interface HarvestWithFruit extends Harvest {
  fruit?: Fruit;
  weights?: FruitWeight[];
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

// Form/Request types
export interface CreateTreeInput {
  description: string;
  latitude: number;
  longitude: number;
  status: "active" | "inactive";
}

export interface CreateFlowerInput {
  tree_id: string;
  quantity: number;
  wrapped_at: Date | string;
  image_uri: string;
}

export interface CreateFruitInput {
  flower_id: string;
  tree_id: string;
  quantity: number;
  bagged_at: Date | string;
  image_uri: string;
}

export interface CreateHarvestInput {
  fruit_id: string;
  ripe_quantity: number;
  harvest_date: Date | string;
}

export interface CreateFruitWeightInput {
  weight_id: number;
  harvest_id: number;
  weight: number;
  status: string;
}
