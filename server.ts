
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("database.sqlite");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    title TEXT,
    logo TEXT,
    sealTypes TEXT,
    themeColor TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    fullName TEXT,
    password TEXT,
    role TEXT,
    organization TEXT,
    city TEXT
  );

  CREATE TABLE IF NOT EXISTS seals (
    id TEXT PRIMARY KEY,
    type TEXT,
    status TEXT,
    creationDate TEXT,
    lastMovement TEXT,
    entryUser TEXT,
    orderNumber TEXT,
    containerId TEXT,
    notes TEXT,
    city TEXT
  );

  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sealId TEXT,
    date TEXT,
    fromStatus TEXT,
    toStatus TEXT,
    user TEXT,
    details TEXT,
    FOREIGN KEY(sealId) REFERENCES seals(id)
  );

  CREATE TABLE IF NOT EXISTS cities (
    name TEXT PRIMARY KEY
  );
`);

// Seed Data if empty
const seedData = () => {
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
  if (userCount.count === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (id, username, fullName, password, role, organization, city)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertUser.run('1', 'admin', 'Administrador Maestro', 'admin', 'ADMIN', 'Compañia Nacional de Chocolates', 'Bogotá');
    insertUser.run('2', 'gestor_medellin', 'Carlos Medellin', 'admin', 'GESTOR', 'Compañia Nacional de Chocolates', 'Medellín');
    insertUser.run('3', 'gestor_bogota', 'Juan Bogota', 'admin', 'GESTOR', 'Compañia Nacional de Chocolates', 'Bogotá');
  }

  const cityCount = db.prepare("SELECT COUNT(*) as count FROM cities").get() as any;
  if (cityCount.count === 0) {
    const insertCity = db.prepare("INSERT INTO cities (name) VALUES (?)");
    ['BOGOTÁ', 'MEDELLÍN', 'CALI', 'BARRANQUILLA'].forEach(city => insertCity.run(city));
  }

  const settingsCount = db.prepare("SELECT COUNT(*) as count FROM settings").get() as any;
  if (settingsCount.count === 0) {
    db.prepare(`
      INSERT INTO settings (id, title, logo, sealTypes, themeColor)
      VALUES (1, ?, ?, ?, ?)
    `).run(
      'GESTION DE SELLOS CNCH', 
      'https://chocolates.com.co/wp-content/uploads/2021/04/logo-cnch.png', 
      JSON.stringify(['Botella', 'Cable', 'Plástico', 'Metálico']), 
      '#003594'
    );
  }
};

seedData();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/cities", (req, res) => {
    const cities = db.prepare("SELECT name FROM cities").all();
    res.json(cities.map((c: any) => c.name));
  });

  app.post("/api/cities", (req, res) => {
    const { name } = req.body;
    try {
      db.prepare("INSERT INTO cities (name) VALUES (?)").run(name);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/cities/:name", (req, res) => {
    const { name } = req.params;
    try {
      db.prepare("DELETE FROM cities WHERE name = ?").run(name);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/seals", (req, res) => {
    const seals = db.prepare("SELECT * FROM seals").all();
    const sealsWithHistory = seals.map((s: any) => {
      const history = db.prepare("SELECT * FROM history WHERE sealId = ? ORDER BY id DESC").all(s.id);
      return { ...s, history };
    });
    res.json(sealsWithHistory);
  });

  app.post("/api/seals", (req, res) => {
    const { id, type, status, creationDate, lastMovement, entryUser, orderNumber, containerId, notes, city, history } = req.body;
    try {
      const insertSeal = db.prepare(`
        INSERT INTO seals (id, type, status, creationDate, lastMovement, entryUser, orderNumber, containerId, notes, city)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertSeal.run(id, type, status, creationDate, lastMovement, entryUser, orderNumber, containerId, notes, city);

      if (history && history.length > 0) {
        const insertHistory = db.prepare(`
          INSERT INTO history (sealId, date, fromStatus, toStatus, user, details)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const h of history) {
          insertHistory.run(id, h.date, h.fromStatus, h.toStatus, h.user, h.details);
        }
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/seals/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM history WHERE sealId = ?").run(id);
      db.prepare("DELETE FROM seals WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/seals/movement", (req, res) => {
    const { ids, status, details, user, date } = req.body;
    try {
      const updateSeal = db.prepare("UPDATE seals SET status = ?, lastMovement = ? WHERE id = ?");
      const insertHistory = db.prepare(`
        INSERT INTO history (sealId, date, fromStatus, toStatus, user, details)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const transaction = db.transaction((sealIds) => {
        for (const id of sealIds) {
          const seal: any = db.prepare("SELECT status FROM seals WHERE id = ?").get(id);
          if (seal) {
            updateSeal.run(status, date, id);
            insertHistory.run(id, date, seal.status, status, user, details);
          }
        }
      });

      transaction(ids);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/users", (req, res) => {
    const users = db.prepare("SELECT * FROM users").all();
    res.json(users);
  });

  app.delete("/api/users/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM users WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/users", (req, res) => {
    const { id, username, fullName, password, role, organization, city } = req.body;
    try {
      db.prepare(`
        INSERT OR REPLACE INTO users (id, username, fullName, password, role, organization, city)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, username, fullName, password, role, organization, city);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/settings", (req, res) => {
    const settings: any = db.prepare("SELECT * FROM settings WHERE id = 1").get();
    if (settings) {
      settings.sealTypes = JSON.parse(settings.sealTypes);
    }
    res.json(settings || null);
  });

  app.post("/api/settings", (req, res) => {
    const { title, logo, sealTypes, themeColor } = req.body;
    try {
      db.prepare(`
        INSERT OR REPLACE INTO settings (id, title, logo, sealTypes, themeColor)
        VALUES (1, ?, ?, ?, ?)
      `).run(title, logo, JSON.stringify(sealTypes), themeColor);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
