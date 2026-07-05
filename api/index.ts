import type { IncomingMessage, ServerResponse } from "http";
import { createApp } from "../server/app";
import type express from "express";

let appPromise: Promise<express.Application> | null = null;

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  if (!appPromise) {
    appPromise = createApp();
  }
  const app = await appPromise;
  app(req, res);
}
