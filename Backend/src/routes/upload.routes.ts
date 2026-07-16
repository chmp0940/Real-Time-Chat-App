import { Router, Request } from "express";
import multer from "multer";
import { cloudinary } from "../config/cloudinary.js";
export const uploadRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

uploadRouter.post(
  "/image-upload",
  upload.single("file"),
  async (req: Request, res, _next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const file = req.file;

      if (!file.mimetype.startsWith("image/")) {
        return res.status(400).json({ error: "Uploaded file is not an image" });
      }

      const result = await new Promise<{
        secure_url: string;
        width: number;
        height: number;
      }>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "resl_time_chats_threads_app",
          },
          (error, uploaded) => {
            if (error || !uploaded) {
              return reject(error || new Error("Image upload failed"));
            } else {
              resolve({
                secure_url: uploaded.secure_url,
                width: uploaded.width,
                height: uploaded.height,
              });
            }
          },
        );
        uploadStream.end(file.buffer);
      });
      return res.status(200).json({
        url: result.secure_url,
        width: result.width,
        height: result.height,
      });
    } catch (err) {
      throw err;
    }
  },
);
