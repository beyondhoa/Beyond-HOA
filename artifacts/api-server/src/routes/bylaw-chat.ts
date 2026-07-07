// @ts-nocheck
import { Router, type IRouter } from "express";
import { openai, BYLAW_SYSTEM_PROMPT } from "../lib/openaiClient";

const router: IRouter = Router();

router.post("/bylaw-chat", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array is required" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: BYLAW_SYSTEM_PROMPT },
        ...messages,
      ],
      stream: true,
      max_completion_tokens: 8192,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    req.log.error({ error }, "Bylaw chat error");
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: "Failed to get response" })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: "Failed to process request" });
    }
  }
});

export default router;
