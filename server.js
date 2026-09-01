import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import RunwayML from "@runwayml/sdk";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
const runway = new RunwayML({ apiKey: process.env.RUNWAYML_API_SECRET });
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => res.json({ status: "online", service: "AI TikTok Generator", provider: "Runway" }));

app.post("/generate-video", async (req, res) => {
  try {
    const { imageUrl, prompt, resolution = "HD 720p" } = req.body;
    if (!imageUrl) return res.status(400).json({ success:false, error:"imageUrl wajib diisi." });
    if (!prompt) return res.status(400).json({ success:false, error:"prompt wajib diisi." });
    const task = await runway.imageToVideo.create({
      model: "gen4.5",
      promptImage: imageUrl,
      promptText: prompt,
      ratio: "768:1280",
      duration: 10
    });
    res.json({ success:true, taskId:task.id, model:"gen4.5", ratio:"768:1280", requestedResolution:resolution });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success:false, error:error?.message || "Gagal membuat video." });
  }
});

app.get("/video-status/:taskId", async (req, res) => {
  try {
    const task = await runway.tasks.retrieve(req.params.taskId);
    const outputUrl = Array.isArray(task.output) && task.output.length ? task.output[0] : null;
    res.json({ success:true, id:task.id, status:task.status, outputUrl, failure:task.failure || null, failureCode:task.failureCode || null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success:false, error:error?.message || "Gagal mengecek status video." });
  }
});

app.listen(PORT, () => console.log(`AI TikTok Generator backend running on port ${PORT}`));
