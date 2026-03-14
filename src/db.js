const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const config = require('./config');

const DB_PATH = path.join(__dirname, '..', 'database', 'snowadventure.db');
const SCHEMA_PATH = path.join(__dirname, '..', 'database', 'schema.sql');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);
  seedData();
}

function seedData() {
  const count = db.prepare('SELECT COUNT(*) as c FROM experiences').get().c;
  if (count === 0) {
    const insert = db.prepare(`
      INSERT INTO experiences (slug, name, duration, price_cents, max_sleds, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insert.run('sunset', 'Orobic Sunset Tour', '1.5 ore', 15000, 6,
      'Escursione al tramonto in motoslitta fino a 2.200m con aperitivo in quota.');
    insert.run('night', 'Night Tour Adventure', '3 ore', 17000, 6,
      'Escursione notturna in motoslitta con cena in rifugio nelle Alpi Orobie.');
    insert.run('freeride', 'Private Freeride Ski Shuttle', null, 0, 4,
      'Servizio motoslitta privato per raggiungere le piste fuoripista.');
  }

  const adminCount = db.prepare('SELECT COUNT(*) as c FROM admin_users').get().c;
  if (adminCount === 0) {
    const hash = bcrypt.hashSync(config.admin.password, 10);
    db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)')
      .run(config.admin.username, hash);
  }
}

module.exports = { getDb };
