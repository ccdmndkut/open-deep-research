import { NextRequest, NextResponse } from "next/server";
import chrome from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { slugifyFilename } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body)
    return NextResponse.json({ error: "No body provided" }, { status: 400 });

  if (typeof body === "object" && !body.url)
    return NextResponse.json({ error: "No url provided" }, { status: 400 });

  const isProd = process.env.NODE_ENV === "production";

  let browser;

  if (isProd) {
    browser = await puppeteer.launch({
      args: chrome.args,
      defaultViewport: chrome.defaultViewport,
      executablePath: await chrome.executablePath(),
      headless: true, // Changed from "new" to true
    });
  } else {
    // Detect Chrome path based on OS
    let executablePath = "";
    if (process.platform === "win32") {
      // Windows paths
      const possiblePaths = [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe"
      ];
      for (const path of possiblePaths) {
        try {
          const fs = require('fs');
          if (fs.existsSync(path)) {
            executablePath = path;
            break;
          }
        } catch (e) {}
      }
    } else if (process.platform === "darwin") {
      executablePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    } else {
      executablePath = "/usr/bin/google-chrome";
    }
    
    browser = await puppeteer.launch({
      headless: true,
      executablePath: executablePath || undefined,
    });
  }

  const page = await browser.newPage();

  await page.setViewport({ width: 600, height: 600 });

  // const url = getAbsoluteURL(`?hash=${hash}`, path)
  const url = body.url;

  console.log("url", url);

  await page.goto(url, { waitUntil: "networkidle0" }); // Wait until the network is idle

  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: {
      top: "0.75in",   // Reduced from 1.5in
      bottom: "1.5in", // Increased from default
      left: "0.5in",
      right: "0.5in"
    }
  });

  await browser.close();

  const headers = new Headers();
  headers.set("Content-Type", "application/pdf");
  const fileName = slugifyFilename(body.fileName || "report");

  console.log("fileName", fileName);

  headers.set(
    "Content-Disposition",
    `attachment; filename=\"${fileName}.pdf\"; filename*=UTF-8''${fileName}.pdf`
  );
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT"
  );
  headers.set(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  // Return the PDF as a Blob to avoid ByteString errors and ensure correct filename
  return new NextResponse(new Blob([pdf]), { status: 200, headers });
}

export async function GET(req: NextRequest) {
  return new NextResponse("Method Not Allowed", { status: 405 });
}
export async function OPTIONS(req: NextRequest) {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT"
  );
  headers.set(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );
  return new NextResponse(null, { status: 200, headers });
}
