import { Tree } from "@/types";

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

export const CREATE_FRUITS_TABLE = ``;
export const CREATE_USERS_TABLE = ``;
