import express from "express";
import RunwayML from "@runwayml/sdk";
import { env } from "cloudflare:workers";
import { httpServerHandler } from "cloudflare:node";

const app = express();

/*
 * ============================
 * MIDDLEWARE
 * ============================
 */


app.use(
  express.json({
    limit: "10mb",
  })
);

/*
 * ============================
 * RUNWAY CLIENT
 * ============================
 *
 * API key disimpan di Cloudflare Secret.
 *
 * Nama secret yang disarankan:
 * RUNWAY_API_KEY
 *
 * Kita juga menerima:
 * RUNWAYML_API_SECRET
 * sebagai fallback.
 */

function getRunwayClient() {
  const apiKey =
    env.RUNWAY_API_KEY ||
    env.RUNWAYML_API_SECRET;

  if (!apiKey) {
    throw new Error(
      "RUNWAY_API_KEY belum dikonfigurasi di Cloudflare."
    );
  }

  return new RunwayML({
    apiKey,
  });
}

/*
 * ============================
 * HEALTH CHECK
 * ============================
 */

app.get("/", (req, res) => {
  res.json({
    success: true,
    status: "online",
    service: "AI TikTok Backend",
    platform: "Cloudflare Workers",
    runway: "Gen-4.5",
  });
});

/*
 * ============================
 * GENERATE VIDEO
 * ============================
 *
 * POST /generate-video
 *
 * Body:
 *
 * {
 *   "imageUrl": "https://....",
 *   "prompt": "A person walking..."
 * }
 *
 */

app.post("/generate-video", async (req, res) => {
  try {
    const {
      imageUrl,
      prompt,
      ratio,
      duration,
    } = req.body || {};

    // Validasi image URL
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        error: "imageUrl wajib diisi.",
      });
    }

    // Validasi prompt
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: "prompt wajib diisi.",
      });
    }

    /*
     * Gen-4.5 mendukung beberapa ratio.
     *
     * Default kita gunakan portrait 720:1280
     * karena cocok untuk TikTok / Reels / Shorts.
     */

    const selectedRatio = ratio || "720:1280";

    /*
     * Gen-4.5 mendukung duration 2-10 detik.
     * Default 10 detik.
     */

    const selectedDuration = Number(duration) || 10;

    if (selectedDuration < 2 || selectedDuration > 10) {
      return res.status(400).json({
        success: false,
        error: "duration harus antara 2 dan 10 detik.",
      });
    }

    const runway = getRunwayClient();

    console.log("Creating Runway video task...");

    const task = await runway.imageToVideo.create({
      model: "gen4.5",
      promptImage: imageUrl,
      promptText: prompt,
      ratio: selectedRatio,
      duration: selectedDuration,
    });

    console.log("Runway task created:", task.id);

    return res.json({
      success: true,
      taskId: task.id,
      status: task.status || "PENDING",
      message: "Video generation started.",
    });

  } catch (error) {
    console.error("Generate video error:", error);

    return res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Gagal membuat video.",
    });
  }
});

/*
 * ============================
 * VIDEO STATUS
 * ============================
 *
 * GET /video-status/:taskId
 *
 */

app.get("/video-status/:taskId", async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: "taskId wajib diisi.",
      });
    }

    const runway = getRunwayClient();

    const task = await runway.tasks.retrieve(taskId);

    /*
     * Ambil URL video kalau generation
     * sudah selesai.
     */

    let outputUrl = null;

    if (
      task.output &&
      Array.isArray(task.output) &&
      task.output.length > 0
    ) {
      outputUrl = task.output[0];
    }

    return res.json({
      success: true,
      id: task.id,
      taskId: task.id,
      status: task.status,
      outputUrl,
      output: task.output || null,
      createdAt: task.createdAt || null,
    });

  } catch (error) {
    console.error("Video status error:", error);

    return res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Gagal mengambil status video.",
    });
  }
});

/*
 * ============================
 * 404 HANDLER
 * ============================
 */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint tidak ditemukan.",
    path: req.path,
  });
});

/*
 * ============================
 * CLOUDFLARE WORKERS
 * ============================
 *
 * Express berjalan pada port 3000
 * dan httpServerHandler menghubungkannya
 * ke Cloudflare Workers.
 */

app.listen(3000);

export default httpServerHandler({
  port: 3000,
});
