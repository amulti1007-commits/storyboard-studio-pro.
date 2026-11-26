import express from 'express';
import { GoogleGenAI } from '@google/genai';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const API_KEY = process.env.GEMINI_API_KEY;

app.disable('x-powered-by');
app.use(express.json({ limit: '24mb' }));

// Optional HTTP Basic Auth. Set APP_USER and APP_PASSWORD on the hosting dashboard.
if (process.env.APP_USER && process.env.APP_PASSWORD) {
  app.use((req, res, next) => {
    const header = req.headers.authorization || '';
    const [scheme, encoded] = header.split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const separator = decoded.indexOf(':');
      const user = decoded.slice(0, separator);
      const pass = decoded.slice(separator + 1);
      if (user === process.env.APP_USER && pass === process.env.APP_PASSWORD) return next();
    }
    res.set('WWW-Authenticate', 'Basic realm="Storyboard Studio Pro"');
    return res.status(401).send('Login diperlukan untuk membuka Storyboard Studio Pro.');
  });
}

app.get('/api/health', (_req, res) => res.json({ ok: true, model: MODEL, apiKeyConfigured: Boolean(API_KEY) }));

const clean = (v, max = 5000) => String(v ?? '').slice(0, max).trim();
function imagePart(item) {
  if (!item || typeof item.data !== 'string') return null;
  const match = item.data.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 8 * 1024 * 1024) return null;
  return { inlineData: { mimeType: match[1], data: bytes.toString('base64') } };
}

app.post('/api/generate', async (req, res) => {
  if (!API_KEY) return res.status(503).json({ error: 'GEMINI_API_KEY belum dipasang di Environment Variables hosting.' });
  const body = req.body || {};
  const idea = clean(body.idea, 6000);
  if (!idea) return res.status(400).json({ error: 'Ide cerita wajib diisi.' });
  const count = Math.max(1, Math.min(60, Number(body.count) || 6));
  const duration = Math.max(1, Math.min(120, Number(body.duration) || 5));
  const imageParts = [ ...(body.referenceImages || []).slice(0, 3), ...(body.backgroundImages || []).slice(0, 2) ]
    .map(imagePart).filter(Boolean);

  const instructions = `Kamu adalah penulis storyboard dan sutradara video AI profesional. Buat storyboard yang siap dipakai untuk produksi video dan kesinambungan antar-scene.
Kembalikan HANYA JSON valid berbentuk objek {"scenes":[...]}, tanpa markdown.
Jumlah scene tepat ${count}. Setiap scene wajib punya: title, duration, desc, camera, audio, dialog, manualDialog.
Gunakan durasi ${duration} detik untuk setiap scene kecuali alur menuntut sedikit penyesuaian; total durasi harus realistis.
Bahasa seluruh deskripsi, dialog, dan audio adalah Bahasa Indonesia. Deskripsi adegan harus konkret, visual, dapat dirender, menyebut aksi, ekspresi, posisi/arah gerak, lingkungan, dan keadaan akhir scene.
Setiap scene melanjutkan keadaan visual scene sebelumnya: posisi karakter, arah pandang, screen direction, lokasi, waktu, pencahayaan, cuaca, properti, senjata, pakaian, dan luka. Jangan mengulang aksi atau dialog. Buat akhir scene terakhir menjadi jembatan/cliffhanger sesuai instruksi.
Jangan mengganti detail karakter yang diberikan. Jika ada gambar referensi, analisis penampilan visualnya dan gunakan sebagai acuan; jangan menebak identitas orang.
Jika mode dialog tanpa dialog, isi dialog dengan instruksi tanpa dialog dan manualDialog kosong. Jika dialog/narasi diminta, tulis kalimat singkat yang alami dan tidak berulang. Setiap dialog baru harus melanjutkan konteks sebelumnya.
Jangan menambahkan karakter penting yang tidak diminta. Hindari teks acak/subtitle. `;

  const userBrief = `IDE CERITA: ${idea}
MASTER KARAKTER: ${clean(body.character, 5000) || 'Gunakan karakter dari gambar referensi jika ada; jika tidak, desain konsisten.'}
DUNIA/LATAR: ${clean(body.setting, 2000)}
ARAHAN LATAR: ${clean(body.backgroundVoice, 2000)}
GAYA VISUAL: ${clean(body.style, 200)}
RASIO: ${clean(body.ratio, 100)}
KAMERA UMUM: ${clean(body.camera, 200)}
AUDIO UMUM: ${clean(body.audio, 1000)}
MODE DIALOG: ${clean(body.dialog, 200)}
DIALOG/NARASI WAJIB: ${clean(body.manualDialog, 2000)}
TARGET PART: ${Number(body.partTarget) || 10} detik
ATURAN ENDING/KONTINUITAS: ${clean(body.extra, 2000)}
Buat tepat ${count} scene, tiap scene sekitar ${duration} detik.`;

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: instructions + '\n\n' + userBrief }, ...imageParts] }],
      config: { responseMimeType: 'application/json', temperature: 0.85 }
    });
    let parsed;
    try { parsed = JSON.parse(response.text || '{}'); }
    catch { throw new Error('Jawaban Gemini bukan JSON valid. Coba lagi.'); }
    if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) throw new Error('Gemini tidak mengembalikan array scenes.');
    const scenes = parsed.scenes.slice(0, count).map((s, i) => ({
      title: clean(s.title, 100) || `Scene ${String(i + 1).padStart(2, '0')}`,
      duration: Math.max(1, Math.min(120, Number(s.duration) || duration)),
      desc: clean(s.desc || s.description, 5000),
      camera: clean(s.camera, 300) || clean(body.camera, 200),
      audio: clean(s.audio, 1000) || clean(body.audio, 1000),
      dialog: clean(s.dialog, 300) || clean(body.dialog, 200),
      manualDialog: clean(s.manualDialog || s.dialogLine, 1500)
    }));
    if (scenes.length !== count) throw new Error(`Gemini hanya menghasilkan ${scenes.length} dari ${count} scene. Silakan ulangi.`);
    return res.json({ scenes, model: MODEL });
  } catch (error) {
    console.error('Gemini generate error:', error);
    return res.status(502).json({ error: error.message || 'Terjadi kesalahan saat menghubungi Gemini API.' });
  }
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('*path', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`Storyboard Studio Pro berjalan pada port ${PORT}; model=${MODEL}`));
