export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  gender: string;
  role: string;
  password?: string;
  is_synced: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface Tree {
  id: string;
  type: string;
  description: string;
  latitude: number;
  longitude: number;
  status: "active" | "inactive";
  is_synced: boolean;
  image_path: string;
  created_at: Date | null;
  updated_at: Date | null;
}

export interface Flower {
  id: string;
  tree_id: string;
  user_id: string;
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
  user_id: string;
  tag_id: number;
  quantity: number;
  bagged_at: Date;
  created_at: Date;
  updated_at: Date;
  image_uri: string;
  farmer_extra_days?: number;
  farmer_assessed_at?: Date;
  next_check_date?: Date;
  farmer_notes?: string;
  description?: string;
  type?: string;
  latitude?: number;
  longitude?: number;
  status?: string;
  is_synced?: boolean;
  image_path?: string;
  deleted_at?: string;
  tree?: Tree; // Add this if you want to access tree data
  treeName?: string; // Add this for displaying tree name in the UI
}

export interface FruitWeight {
  id: string;
  harvest_id: string;
  weight: number;
  status: string;
  created_at: Date | null;
  updated_at: Date | null;
  deleted_at: Date | null;
}

export interface Harvest {
  id: string;
  fruit_id: string;
  ripe_quantity: number;
  harvest_at: Date;
  status: string;
  is_synced: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface Waste {
  id: string;
  harvest_id: string;
  waste_quantity: number;
  reason: string;
  reported_at: Date;
  is_synced: boolean;
  created_at: Date;
  updated_at: Date;
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
