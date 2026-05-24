/**
 * Installed Skills Database
 * Manages the local database of installed skills
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { InstalledSkill } from './types';
import { SkillMetadata } from '../types';

/**
 * Database file path
 */
const DB_FILE = path.join(os.homedir(), '.kode', 'skills', 'installed.json');

/**
 * Database structure
 */
interface InstalledDatabase {
  version: string;
  skills: InstalledSkill[];
}

/**
 * Get all installed skills
 */
export async function getInstalledSkills(
  installDir: string
): Promise<InstalledSkill[]> {
  try {
    const db = await readDatabase();
    return db.skills.filter(s => s.installPath.startsWith(installDir));
  } catch {
    return [];
  }
}

/**
 * Save installed skill to database
 */
export async function saveInstalledSkill(
  installDir: string,
  skill: Omit<InstalledSkill, 'metadata'> & { metadata: any }
): Promise<void> {
  const db = await readDatabase();

  // Remove existing entry with same ID
  db.skills = db.skills.filter(s => s.metadata.id !== skill.metadata.id);

  // Add new entry
  db.skills.push(skill as InstalledSkill);

  await writeDatabase(db);
}

/**
 * Remove installed skill from database
 */
export async function removeInstalledSkill(
  installDir: string,
  skillId: string
): Promise<void> {
  const db = await readDatabase();
  db.skills = db.skills.filter(s => s.metadata.id !== skillId);
  await writeDatabase(db);
}

/**
 * Read database from file
 */
async function readDatabase(): Promise<InstalledDatabase> {
  try {
    const content = await fs.readFile(DB_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // Create new database
      const db: InstalledDatabase = {
        version: '1.0.0',
        skills: [],
      };
      await writeDatabase(db);
      return db;
    }
    throw error;
  }
}

/**
 * Write database to file
 */
async function writeDatabase(db: InstalledDatabase): Promise<void> {
  const dir = path.dirname(DB_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}
