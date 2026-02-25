
import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, "db.json");

// Initial data structure
const defaultData = {
  seals: [],
  users: [],
  cities: ['BOGOTÁ', 'MEDELLÍN', 'CALI', 'BARRANQUILLA'],
  settings: { 
    title: 'GESTION DE SELLOS CNCH', 
    logo: null, 
    sealTypes: ['Botella', 'Cable', 'Plástico', 'Metálico'], 
    themeColor: '#003594' 
  }
};

// Load or initialize data
function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    } catch (e) {
      return defaultData;
    }
  }
  return defaultData;
}

function saveData(data: any) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  let db = loadData();

  // API Routes
  app.get("/api/db", (req, res) => {
    res.json(db);
  });

  app.post("/api/db", (req, res) => {
    db = req.body;
    saveData(db);
    res.json({ status: "ok" });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
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
