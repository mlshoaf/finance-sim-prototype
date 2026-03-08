// db.js — SQLite schema initialization
// Uses better-sqlite3 for synchronous database operations

'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'finance_sim.db');

function initDb() {
  const db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS scenarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'draft',
      scenario_config TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scenario_id INTEGER REFERENCES scenarios(id),
      filename TEXT NOT NULL,
      doc_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      display_name TEXT
    );

    CREATE TABLE IF NOT EXISTS rubric (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scenario_id INTEGER REFERENCES scenarios(id),
      document_id INTEGER REFERENCES documents(id),
      correct_action TEXT NOT NULL,
      error_description TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scenario_id INTEGER REFERENCES scenarios(id),
      started_at DATETIME,
      submitted_at DATETIME,
      score_correct INTEGER,
      score_total INTEGER
    );

    CREATE TABLE IF NOT EXISTS decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER REFERENCES sessions(id),
      document_id INTEGER REFERENCES documents(id),
      action TEXT NOT NULL,
      error_category TEXT,
      notes TEXT,
      decided_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER REFERENCES sessions(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      attached_doc_ids TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS instructor_chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scenario_id INTEGER REFERENCES scenarios(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrations for existing databases
  try { db.exec("ALTER TABLE scenarios ADD COLUMN scenario_config TEXT DEFAULT '{}'"); } catch (_) {}

  return db;
}

module.exports = { initDb, DB_PATH };
