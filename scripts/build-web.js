const { execSync } = require("child_process");

function stripProtocol(raw) {
  let s = (raw || "").trim();
  if (s.startsWith("https://")) s = s.slice(8);
  if (s.startsWith("http://")) s = s.slice(7);
  return s.split(",")[0].trim();
}

function resolveProductionDomain() {
  if (process.env.REPLIT_INTERNAL_APP_DOMAIN) {
    return stripProtocol(process.env.REPLIT_INTERNAL_APP_DOMAIN);
  }
  if (process.env.REPLIT_DOMAINS) {
    return stripProtocol(process.env.REPLIT_DOMAINS);
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return process.env.REPLIT_DEV_DOMAIN;
  }
  if (process.env.EXPO_PUBLIC_DOMAIN) {
    return stripProtocol(process.env.EXPO_PUBLIC_DOMAIN);
  }
  console.error(
    "ERROR: No domain found. Set REPLIT_DOMAINS, REPLIT_INTERNAL_APP_DOMAIN, or EXPO_PUBLIC_DOMAIN"
  );
  process.exit(1);
}

const domain = resolveProductionDomain();
console.log(`Building Expo web app with EXPO_PUBLIC_DOMAIN=${domain}`);

execSync("npx expo export --platform web", {
  stdio: "inherit",
  env: { ...process.env, EXPO_PUBLIC_DOMAIN: domain },
});

console.log("Expo web build complete → dist/");
