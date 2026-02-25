export const CREATE_TREES_TABLE = `
  CREATE TABLE IF NOT EXISTS trees (
    uuid TEXT UNIQUE,
    description TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    status TEXT CHECK(status IN ('active', 'inactive')) NOT NULL DEFAULT 'active',
    is_synced BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

export const CREATE_FLOWERS_TABLE = `   
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
        );`;

export const CREATE_FLOWER_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_flowers_tree_id ON flowers(tree_id);
  CREATE INDEX IF NOT EXISTS idx_flowers_status ON flowers(status);
  CREATE INDEX IF NOT EXISTS idx_flowers_synced ON flowers(is_synced);
  CREATE INDEX IF NOT EXISTS idx_flowers_created ON flowers(created_at);
  CREATE INDEX IF NOT EXISTS idx_flowers_wrapped ON flowers(wrapped_at);
`;

export const CREATE_FRUITS_TABLE = `
   CREATE TABLE IF NOT EXISTS fruits (
          id TEXT PRIMARY KEY,
          flower_id TEXT NOT NULL,
          tree_id TEXT NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 1,
          bagged_at TEXT NOT NULL,
          image_uri TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          is_synced INTEGER DEFAULT 0,
          created_at TEXT,
          updated_at TEXT,
          deleted_at TEXT,
          FOREIGN KEY (flower_id) REFERENCES flowers(id) ON DELETE CASCADE,
          FOREIGN KEY (tree_id) REFERENCES trees(id) ON DELETE CASCADE
        );
`;

export const CREATE_USERS_TABLE_AND_INDEXES = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    gender TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'user',
    is_synced BOOLEAN DEFAULT 0,
    password TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL
  );
  
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
  CREATE INDEX IF NOT EXISTS idx_users_is_synced ON users(is_synced);
  CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
  CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
  CREATE INDEX IF NOT EXISTS idx_users_name_search ON users(first_name, last_name);
`;

export const CREATE_HARVESTS_TABLE = `
  CREATE TABLE IF NOT EXISTS harvests (
    id TEXT PRIMARY KEY,
    fruit_id TEXT NOT NULL,
    ripe_quantity INTEGER NOT NULL DEFAULT 1,
    harvest_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_synced BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    FOREIGN KEY (fruit_id) REFERENCES fruits(id) ON DELETE CASCADE
  );
`;

export const CREATE_HARVEST_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_harvests_fruit_id ON harvests(fruit_id);
  CREATE INDEX IF NOT EXISTS idx_harvests_harvest_at ON harvests(harvest_at);
  CREATE INDEX IF NOT EXISTS idx_harvests_synced ON harvests(is_synced);
  CREATE INDEX IF NOT EXISTS idx_harvests_deleted ON harvests(deleted_at);
`;

export const CREATE_FRUIT_WEIGHTS_TABLE = `
  CREATE TABLE IF NOT EXISTS fruit_weights (
    id TEXT PRIMARY KEY,
    harvest_id TEXT NOT NULL,
    weight DECIMAL(4,2) NOT NULL,
    status TEXT DEFAULT 'local' CHECK(status IN ('local', 'national')), 
    is_synced INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT,
    FOREIGN KEY (harvest_id) REFERENCES harvests(id) ON DELETE CASCADE
  );
`;

export const CREATE_FRUIT_WEIGHT_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_fruit_weights_harvest_id ON fruit_weights(harvest_id);
  CREATE INDEX IF NOT EXISTS idx_fruit_weights_synced ON fruit_weights(is_synced);
  CREATE INDEX IF NOT EXISTS idx_fruit_weights_deleted ON fruit_weights(deleted_at);
`;

export const CREATE_WASTES_TABLE = `
  CREATE TABLE IF NOT EXISTS wastes (
    id TEXT PRIMARY KEY,
    harvest_id TEXT NOT NULL,
    waste_quantity INTEGER NOT NULL DEFAULT 1,
    reason TEXT NOT NULL,
    reported_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_synced BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    FOREIGN KEY (harvest_id) REFERENCES harvests(id) ON DELETE CASCADE
  );
`;

export const CREATE_WASTE_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_wastes_harvest_id ON wastes(harvest_id);
  CREATE INDEX IF NOT EXISTS idx_wastes_reported_at ON wastes(reported_at);
  CREATE INDEX IF NOT EXISTS idx_wastes_synced ON wastes(is_synced);
  CREATE INDEX IF NOT EXISTS idx_wastes_deleted ON wastes(deleted_at);
`;
