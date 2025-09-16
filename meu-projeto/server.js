import express from "express";
import fetch from "node-fetch";
import path from "path";
import fs from "fs";
import { google } from "googleapis";

const app = express();
app.use(express.json());
app.use(express.static(path.join(new URL("../frontend", import.meta.url).pathname)));

// ====== CONFIG GOOGLE SHEETS ======
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const serviceAccount = JSON.parse(fs.readFileSync("./service-account.json", "utf-8"));

const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: SCOPES,
});

const sheets = google.sheets({ version: "v4", auth });
const SPREADSHEET_ID = "1GW3fBISBJjZY1DPpKwRA9TsoF5OI1GgkU88iJHnJKfw";

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

// ===== Servir frontend =====
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use((req, res) => res.sendFile(path.join(__dirname, "../frontend/index.html")));


app.listen(3000, () => console.log("✅ Backend rodando na porta 3000"));
