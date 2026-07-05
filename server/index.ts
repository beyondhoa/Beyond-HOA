import { createApp } from "./app";

(async () => {
  const app = await createApp();

  const port = parseInt(process.env.PORT || "8081", 10);
  app.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      console.log(`express server serving on port ${port}`);
    },
  );
})();
