import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export interface Resident {
  id: number;
  name: string;
  unit: string;
  email: string | null;
  phone: string | null;
  status: "owner" | "tenant";
  move_in_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface InsertResident {
  name: string;
  unit: string;
  email?: string;
  phone?: string;
  status: "owner" | "tenant";
  move_in_date?: string;
  notes?: string;
}
