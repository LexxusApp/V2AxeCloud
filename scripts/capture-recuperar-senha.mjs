import { chromium } from "playwright";
import path from "path";

const baseUrl = "https://axecloud.com.br";
const artifactDir = "C:/Users/Lucas A/.gemini/antigravity/brain/9d158178-6619-41e8-8027-3b042f4c880d";

async function capture() {
  const browser = await chromium.launch({ headless: true });

  try {
    // 1. Desktop Screenshot (with prefilled email like the user had)
    const pageDesk = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    console.log("Navigating desktop...");
    await pageDesk.goto(`${baseUrl}/recuperar-senha?email=miriambarbosa222%40yahoo.com.br`, { waitUntil: "domcontentloaded" });
    await pageDesk.waitForTimeout(2000);
    const deskPath = path.join(artifactDir, "nova-recuperar-senha-desktop.png");
    await pageDesk.screenshot({ path: deskPath });
    console.log("Desktop screenshot saved:", deskPath);
    await pageDesk.close();

    // 2. Mobile Screenshot (iPhone 14)
    const pageMob = await browser.newPage({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    });
    console.log("Navigating mobile...");
    await pageMob.goto(`${baseUrl}/recuperar-senha?email=miriambarbosa222%40yahoo.com.br`, { waitUntil: "domcontentloaded" });
    await pageMob.waitForTimeout(2000);
    const mobPath = path.join(artifactDir, "nova-recuperar-senha-mobile.png");
    await pageMob.screenshot({ path: mobPath });
    console.log("Mobile screenshot saved:", mobPath);
    await pageMob.close();

  } catch (err) {
    console.error("Capture error:", err);
  } finally {
    await browser.close();
  }
}

capture();
