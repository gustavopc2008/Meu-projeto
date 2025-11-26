import express from "express";
import fetch from "node-fetch";
import path from "path";
import fs from "fs";
import { google } from "googleapis";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json());

// ===== Caminho absoluto do frontend =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.join(__dirname, "frontend");

// Servir arquivos estáticos
app.use(express.static(frontendPath));

// ====== CONFIG GOOGLE SHEETS ======
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

// ✅ Carregar service account (tenta variável de ambiente primeiro, depois arquivo)
let serviceAccount;
try {
  if (process.env.SERVICE_ACCOUNT_JSON) {
    serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_JSON);
    console.log("✅ Service account carregado da variável de ambiente");
  } else {
    // Tenta carregar do arquivo service-account.json
    const serviceAccountPath = path.join(__dirname, "service-account.json");
    if (fs.existsSync(serviceAccountPath)) {
      serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));
      console.log("✅ Service account carregado do arquivo");
    } else {
      console.warn("⚠️ Service account não encontrado. Funcionalidade de salvar sugestões desabilitada.");
      serviceAccount = null;
    }
  }
} catch (err) {
  console.error("❌ Erro ao carregar service account:", err.message);
  serviceAccount = null;
}

let auth, sheets;
const SPREADSHEET_ID = "1GW3fBISBJjZY1DPpKwRA9TsoF5OI1GgkU88iJHnJKfw";

if (serviceAccount) {
  auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: SCOPES,
  });
  sheets = google.sheets({ version: "v4", auth });
}

// ====== CONFIG YOUTUBE ======
const API_KEY = "AIzaSyBmCzw6nPPFeLTTZLFwkQfokN_pTzNTJgc";

// ===== Rota para buscar músicas no YouTube =====
app.get("/search", async (req, res) => {
  const q = req.query.q;
  if (!q) return res.json({ error: "Faltando parâmetro q" });

  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
      q
    )}&type=video&maxResults=25&key=${API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("❌ Erro ao buscar músicas:", err);
    res.json({ error: "Erro ao buscar músicas" });
  }
});

// ===== Rota para enviar sugestão para Google Sheets =====
app.post("/suggest", async (req, res) => {
  const { nome, musica, canal, link } = req.body;
  if (!nome || !musica) return res.json({ error: "Nome ou música faltando" });

  if (!sheets) {
    console.log("📝 Sugestão recebida (mas não salva - service account não configurado):", { nome, musica, canal, link });
    return res.json({ success: true, message: "Sugestão recebida (service account não configurado)" });
  }

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "A:D",
      valueInputOption: "RAW",
      requestBody: { values: [[nome, musica, canal, link]] },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Erro ao salvar sugestão:", err);
    res.json({ error: "Erro ao salvar sugestão" });
  }
});

// ===== Todas as rotas que não forem API vão para o index.html =====
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// ===== Start server =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Backend rodando na porta ${PORT}`));

