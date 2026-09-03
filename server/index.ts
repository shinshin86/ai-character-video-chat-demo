import { createFalClient } from "@fal-ai/client";
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { archiveVideo, ensureArchive, readArchive } from "./archive";
import { toPublicErrorMessage } from "./errors";
import { getOpenRouterModelCatalog } from "./models";
import {
  detectReferenceImageType,
  ensureReferenceStore,
  findReferenceImage,
  getReferenceImagesRoot,
  readReferenceImages,
  saveReferenceImage,
} from "./references";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const dataRoot = path.join(projectRoot, "data");
const archiveRoot = path.join(dataRoot, "archive");
const referenceImagesRoot = getReferenceImagesRoot(dataRoot);
const port = Number(process.env.PORT ?? 5180);
const isProduction = process.argv.includes("--production");

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    const allowedTypes = new Set([
      "image/png",
      "image/jpeg",
      "image/webp",
    ]);
    if (allowedTypes.has(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new Error("Unsupported image type."));
    }
  },
});

function readApiKey(request: Request): string | null {
  const authorization = request.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function requireApiKey(request: Request, response: Response): string | null {
  const apiKey = readApiKey(request);
  if (!apiKey) {
    response.status(401).json({
      error: "fal API Keyを設定してください。",
    });
    return null;
  }
  return apiKey;
}

function getFalProxyError(status: number): string {
  if (status === 401 || status === 403) {
    return "fal API Keyを確認してください。";
  }
  if (status === 422) {
    return "LLMが会話内容を処理できませんでした。入力やモデル名を確認してください。";
  }
  if (status === 429) {
    return "falの利用上限に達しました。しばらく待ってから再試行してください。";
  }
  return "AIの返答生成に失敗しました。時間をおいて再試行してください。";
}

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/api/fal/openrouter/models", async (_request, response, next) => {
  try {
    response.setHeader("Cache-Control", "public, max-age=900");
    response.json(await getOpenRouterModelCatalog());
  } catch (error) {
    next(error);
  }
});

app.get("/api/archive", async (_request, response, next) => {
  try {
    response.setHeader("Cache-Control", "no-store");
    response.json({ entries: await readArchive(dataRoot) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/reference-images", async (_request, response, next) => {
  try {
    response.setHeader("Cache-Control", "no-store");
    response.json({ images: await readReferenceImages(dataRoot) });
  } catch (error) {
    next(error);
  }
});

app.use(
  "/local-media",
  express.static(archiveRoot, {
    dotfiles: "deny",
    fallthrough: false,
    index: false,
    immutable: true,
    maxAge: "1y",
  }),
);

app.use(
  "/reference-images",
  express.static(referenceImagesRoot, {
    dotfiles: "deny",
    fallthrough: false,
    index: false,
    immutable: true,
    maxAge: "1y",
  }),
);

app.post(
  "/api/fal/upload-character",
  upload.single("image"),
  async (request, response, next) => {
    const apiKey = requireApiKey(request, response);
    if (!apiKey) return;

    if (!request.file) {
      response.status(400).json({ error: "画像ファイルを選択してください。" });
      return;
    }

    try {
      const imageBytes = Buffer.from(request.file.buffer);
      const detectedType = detectReferenceImageType(imageBytes);
      if (!detectedType || detectedType !== request.file.mimetype) {
        response.status(400).json({
          error: "PNG、JPG、JPEG、WebPの画像を選択してください。",
        });
        return;
      }

      const existingReference = await findReferenceImage(dataRoot, imageBytes);
      if (existingReference) {
        response.setHeader("Cache-Control", "no-store");
        response.json({
          imageUrl: existingReference.remoteImageUrl,
          referenceImage: existingReference,
        });
        return;
      }

      const fal = createFalClient({ credentials: apiKey });
      const image = new File([imageBytes], request.file.originalname, {
        type: detectedType,
      });
      const imageUrl = await fal.storage.upload(image, {
        lifecycle: { expiresIn: "never" },
      });
      const referenceImage = await saveReferenceImage(dataRoot, {
        bytes: imageBytes,
        originalName: request.file.originalname,
        mimeType: detectedType,
        remoteImageUrl: imageUrl,
      });
      response.setHeader("Cache-Control", "no-store");
      response.json({ imageUrl, referenceImage });
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  "/api/fal/openrouter/chat/completions",
  async (request, response, next) => {
    const apiKey = requireApiKey(request, response);
    if (!apiKey) return;

    if (!Array.isArray(request.body?.messages) || !request.body?.model) {
      response.status(400).json({ error: "会話リクエストが不正です。" });
      return;
    }

    try {
      const upstream = await fetch(
        "https://fal.run/openrouter/router/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Key ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request.body),
          signal: AbortSignal.timeout(120_000),
        },
      );
      const body = await upstream.text();
      if (!upstream.ok) {
        response.status(upstream.status).json({
          error: getFalProxyError(upstream.status),
        });
        return;
      }
      response.status(upstream.status);
      response.setHeader("Cache-Control", "no-store");
      response.type(upstream.headers.get("content-type") ?? "application/json");
      response.send(body);
    } catch (error) {
      next(error);
    }
  },
);

interface VideoRequestBody {
  imageUrl?: string;
  prompt?: string;
  resolution?: "480P" | "768P";
  characterName?: string;
  userMessage?: string;
  assistantReply?: string;
  llmModel?: string;
}

app.post("/api/fal/generate-video", async (request, response) => {
  const apiKey = readApiKey(request);
  if (!apiKey) {
    response.status(401).json({ error: "fal API Keyを設定してください。" });
    return;
  }

  const body = request.body as VideoRequestBody;
  if (
    !body.imageUrl ||
    !body.prompt ||
    !body.userMessage ||
    !body.assistantReply ||
    !body.llmModel ||
    (body.resolution !== "480P" && body.resolution !== "768P")
  ) {
    response.status(400).json({ error: "動画生成リクエストが不正です。" });
    return;
  }

  response.status(200);
  response.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.flushHeaders();

  const sendEvent = (event: Record<string, unknown>) => {
    if (!response.writableEnded) {
      response.write(`${JSON.stringify(event)}\n`);
    }
  };

  try {
    const fal = createFalClient({ credentials: apiKey });
    const result = await fal.subscribe("minimax/h3-max/image-to-video", {
      input: {
        image_url: body.imageUrl,
        prompt: body.prompt,
        duration: 5,
        resolution: body.resolution,
        prompt_expansion_mode: "balanced",
        enable_safety_checker: true,
      },
      logs: true,
      onQueueUpdate(update) {
        const latestLog = "logs" in update ? update.logs.at(-1)?.message : undefined;
        sendEvent({
          type: "status",
          status: update.status,
          message: latestLog,
        });
      },
    });

    const data = result.data as { video?: { url?: string } };
    const remoteVideoUrl = data.video?.url;
    if (!remoteVideoUrl) {
      throw new Error("fal response did not include a video URL.");
    }

    sendEvent({
      type: "status",
      status: "ARCHIVING",
      message: "生成した動画をローカルに保存しています...",
    });

    const archive = await archiveVideo(dataRoot, {
      characterName: body.characterName?.trim() ?? "",
      userMessage: body.userMessage,
      assistantReply: body.assistantReply,
      videoPrompt: body.prompt,
      llmModel: body.llmModel,
      resolution: body.resolution,
      remoteVideoUrl,
      falRequestId: result.requestId,
    });

    sendEvent({ type: "result", archive });
  } catch (error) {
    sendEvent({ type: "error", message: toPublicErrorMessage(error) });
  } finally {
    response.end();
  }
});

await Promise.all([ensureArchive(dataRoot), ensureReferenceStore(dataRoot)]);

if (isProduction) {
  const distRoot = path.join(projectRoot, "dist");
  app.use(express.static(distRoot));
  app.use((request, response, next) => {
    if (request.method === "GET" && request.accepts("html")) {
      response.sendFile(path.join(distRoot, "index.html"));
      return;
    }
    next();
  });
} else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    root: projectRoot,
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

app.use(
  (error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const isImageValidationError =
      error instanceof multer.MulterError ||
      (error instanceof Error && error.message === "Unsupported image type.");
    const message = isImageValidationError
      ? "PNG、JPG、JPEG、WebPの15MB以下の画像を選択してください。"
      : toPublicErrorMessage(error);

    response.status(isImageValidationError ? 400 : 500).json({ error: message });
  },
);

app.listen(port, "127.0.0.1", () => {
  console.log(`AI Character Video Chat: http://127.0.0.1:${port}`);
});
