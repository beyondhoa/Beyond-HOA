const { execSync } = require("child_process");

function getDeploymentDomain() {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return process.env.VERCEL_PROJECT_PRODUCTION_URL;
  }

  if (process.env.VERCEL_URL) {
    return process.env.VERCEL_URL;
  }

  if (process.env.EXPO_PUBLIC_DOMAIN) {
    return process.env.EXPO_PUBLIC_DOMAIN;
  }

  console.error(
    "ERROR: No deployment domain found. Expected VERCEL_URL / VERCEL_PROJECT_PRODUCTION_URL " +
      "(set automatically by Vercel) or EXPO_PUBLIC_DOMAIN.",
  );
  process.exit(1);
}

function main() {
  const domain = getDeploymentDomain();
  console.log("=== Building Expo web app for Vercel (dist/) ===");
  console.log(`Setting EXPO_PUBLIC_DOMAIN=${domain}`);

  try {
    execSync("npx expo export --platform web", {
      stdio: "inherit",
      env: { ...process.env, EXPO_PUBLIC_DOMAIN: domain },
    });
    console.log("Expo web build complete -> dist/");
  } catch (err) {
    console.error(`Expo web build failed: ${err.message || err}`);
    process.exit(1);
  }
}

main();
