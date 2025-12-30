const { connect } = require("puppeteer-real-browser");
const fs = require("fs");
const path = require("path");
const https = require("https");
const { spawn } = require("child_process");

const TARGET_URL = "https://accounts.x.ai/sign-up?redirect=grok-com";
const EMAIL_URL = "https://internxt.com/temporary-email";
const EMAIL_VALUE_XPATH =
  '//*[@id="__next"]/div[4]/section[1]/div[2]/div[2]/div/div/button/p';
const GROK_EMAIL_INPUT_XPATH = "/html/body/div[2]/div/div[1]/div[2]/div/form/div[1]/div/input";
const GROK_NEXT_BUTTON_XPATH = "/html/body/div[2]/div/div[1]/div[2]/div/form/div[2]/button[1]";
const EMAIL_INBOX_BUTTON_XPATH = '//*[@id="inbox"]/div[2]/div/div/div[2]/button';
const EMAIL_INBOX_REFRESH_XPATH = '//*[@id="inbox"]/div[2]/div/div/div[2]/button/p';
const EMAIL_CODE_TEXT_XPATH = '//*[@id="inbox"]/div[1]/div/div[2]/button/div/p[2]';
const GROK_CODE_INPUT_XPATH =
  "/html/body/div[2]/div/div[1]/div[2]/div/form/div[1]/div/div[1]/div[4]/input";
const GROK_FIRST_NAME_XPATH =
  "/html/body/div[2]/div/div[1]/div[2]/div/form/div/div[1]/div[1]/div[1]/div/input";
const GROK_LAST_NAME_XPATH =
  "/html/body/div[2]/div/div[1]/div[2]/div/form/div/div[1]/div[1]/div[2]/div/input";
const GROK_PASSWORD_XPATH =
  "/html/body/div[2]/div/div[1]/div[2]/div/form/div/div[1]/div[2]/div/input";
const GROK_FINAL_BUTTON_XPATH =
  "/html/body/div[2]/div/div[1]/div[2]/div/form/div/div[3]/button[1]";
const GROK_IMAGINE_PATH = "/imagine";
const GROK_UPLOAD_INPUT_XPATH =
  "/html/body/div[2]/div[2]/div/div/div/div[2]/div/form/div/input";
const GROK_PROMPT_INPUT_XPATH =
  "/html/body/div[2]/div[2]/div/div/div/main/article/div[2]/div[1]/div/div[1]/div/textarea";
const GROK_SUBMIT_PROMPT_BUTTON_XPATH =
  "/html/body/div[2]/div[2]/div/div/div/main/article/div[2]/div[1]/div/div[1]/div/div/button[2]";
const GROK_RESULT_VIDEO_XPATH =
  "/html/body/div[2]/div[2]/div/div/div/main/article/div[1]/div/div/div[1]/video[1]";
const GROK_IMAGE_PROMPT_FORM_XPATH =
  "/html/body/div[2]/div[2]/div/div/div/div/div[2]/div/form";
const GROK_IMAGE_SUBMIT_PROMPT_BUTTON_XPATH =
  "/html/body/div[2]/div[2]/div/div/div/div/div[2]/div/form/div/div/div[2]/div[2]/div[2]/div[3]/button";
const GROK_IMAGE_RESULT_XPATH = '//img[@alt="Generated image"]';
const RATE_LIMIT_XPATH = "/html/body/section/ol/li/div/span/div/span";
const RATE_LIMIT_TEXT = "Upgrade to unlock more";

const CONFIG_PATH = path.join(__dirname, "config.json");
const OUTPUT_DIR = path.join(__dirname, "outputs");
const GROK_MODEL_SELECT_TRIGGER_XPATH = '//*[@id="model-select-trigger"]';
const GROK_MODEL_SELECT_PANEL_VIDEO_XPATH = "/html/body/div[6]/div/div[3]";
const GROK_MODEL_SELECT_PANEL_IMAGE_XPATH = "/html/body/div[6]/div/div[4]";
const GROK_MODEL_SELECT_CLOSE_XPATH = "/html/body/div[6]/div/div[1]/div/button[3]";
const DEBUG_LOGS = process.env.DEBUG_LOGS === "1";
const DEFAULT_ACCEPT_LANGUAGE = "en-US,en;q=0.9";
const DEFAULT_DOWNLOAD_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function formatUrlForLog(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.origin}${parsed.pathname}`;
  } catch (err) {
    if (typeof rawUrl === "string" && rawUrl.startsWith("blob:")) return "<blob>";
    return "<invalid-url>";
  }
}

function redactHeaderValue(value, keep = 0) {
  if (!value) return "";
  if (keep <= 0) return "<redacted>";
  return `${value.slice(0, keep)}…<redacted>`;
}


const checkTurnstile = ({ page }) => {
  return new Promise(async (resolve, reject) => {
      var waitInterval = setTimeout(() => { clearInterval(waitInterval); resolve(false) }, 5000);
      try {
          const elements = await page.$$('[name="cf-turnstile-response"]');
          if (elements.length <= 0) {

              const coordinates = await page.evaluate(() => {
                  let coordinates = [];
                  document.querySelectorAll('div').forEach(item => {
                      try {
                          let itemCoordinates = item.getBoundingClientRect()
                          let itemCss = window.getComputedStyle(item)
                          if (itemCss.margin == "0px" && itemCss.padding == "0px" && itemCoordinates.width > 290 && itemCoordinates.width <= 310 && !item.querySelector('*')) {
                              coordinates.push({ x: itemCoordinates.x, y: item.getBoundingClientRect().y, w: item.getBoundingClientRect().width, h: item.getBoundingClientRect().height })
                          }
                      } catch (err) { }
                  });

                  if (coordinates.length <= 0) {
                      document.querySelectorAll('div').forEach(item => {
                          try {
                              let itemCoordinates = item.getBoundingClientRect()
                              if (itemCoordinates.width > 290 && itemCoordinates.width <= 310 && !item.querySelector('*')) {
                                  coordinates.push({ x: itemCoordinates.x, y: item.getBoundingClientRect().y, w: item.getBoundingClientRect().width, h: item.getBoundingClientRect().height })
                              }
                          } catch (err) { }
                      });

                  }

                  return coordinates
              })

              for (const item of coordinates) {
                  try {
                      let x = item.x + 30;
                      let y = item.y + item.h / 2;
                      await page.mouse.click(x, y);
                  } catch (err) { }
              }
              return resolve(true)
          }

          for (const element of elements) {
              try {
                  const parentElement = await element.evaluateHandle(el => el.parentElement);
                  const box = await parentElement.boundingBox();
                  let x = box.x + 30;
                  let y = box.y + box.height / 2;
                  await page.mouse.click(x, y);
              } catch (err) { }
          }
          clearInterval(waitInterval)
          resolve(true)
      } catch (err) {
          clearInterval(waitInterval)
          resolve(false)
      }
  })
}
function startBackgroundTurnstileSolver(page, options = {}) {

  const pollInterval = Number(options.pollInterval) || 2000;
  const pollTime = Number(options.pollTime) || 10000;
  const debug = options.debug === true;
  const start = Date.now();
  let attempt = 0;

  return (async () => {
    while (Date.now() - start < pollTime) {
      attempt += 1;
      await checkTurnstile({page})
      if (debug) {
        console.log(
          `[background-loop] attempt=${attempt} elapsed=${Date.now() - start}ms interval=${pollInterval}ms`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
    return true;
  })();
}

async function waitForXPath(page, xpath, timeout = 60000) {
  const handle = await page.waitForFunction(
    (xp) => {
      const node = document.evaluate(
        xp,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue;
      return node || false;
    },
    { timeout },
    xpath
  );
  const el = handle.asElement();
  if (!el) {
    throw new Error(`XPath did not resolve to an element: ${xpath}`);
  }
  return el;
}

async function ensureDir(dirPath) {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

function downloadToFile(url, filePath, headers = {}) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers }, (res) => {
        if ((res.statusCode || 0) >= 300 && (res.statusCode || 0) < 400 && res.headers.location) {
          res.resume();
          downloadToFile(new URL(res.headers.location, url).toString(), filePath, headers)
            .then(resolve)
            .catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`Download failed: ${res.statusCode}`));
          return;
        }
        const file = fs.createWriteStream(filePath);
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
      })
      .on("error", reject);
  });
}

function downloadToFileWithCurl(url, filePath, headers = {}) {
  return new Promise((resolve, reject) => {
    const args = ["-L", "--fail", "--silent", "--show-error", "-o", filePath, url];
    for (const [key, value] of Object.entries(headers)) {
      args.push("-H", `${key}: ${value}`);
    }
    const child = spawn("curl", args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`curl exited with code ${code}`));
      }
    });
  });
}

async function downloadWithCookies(page, url, filePath) {
  console.log(`Downloading from URL: ${formatUrlForLog(url)}`);
  let cookieHeader = "";
  let userAgent = "";
  let language = DEFAULT_ACCEPT_LANGUAGE;
  try {
    const cookies = await page.cookies(url);
    cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  } catch (err) {
    console.log("Cookie fetch failed, continuing without cookies.", err.message);
  }
  try {
    userAgent = DEFAULT_DOWNLOAD_UA;
  } catch (err) {
    console.log("User agent fetch failed, continuing without UA.", err.message);
  }
  if (!userAgent) {
    userAgent = DEFAULT_DOWNLOAD_UA;
  }

  const headers = {};
  headers.accept = "*/*";
  headers["accept-language"] = language.includes(",") ? language : `${language},en;q=0.9`;
  if (cookieHeader) headers.cookie = cookieHeader;
  headers.origin = "https://grok.com";
  headers.priority = "u=1, i";
  headers.referer = "https://grok.com/";
  headers["sec-ch-ua"] =
    '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"';
  headers["sec-ch-ua-mobile"] = "?0";
  headers["sec-ch-ua-platform"] = '"Linux"';
  headers["sec-fetch-dest"] = "empty";
  headers["sec-fetch-mode"] = "cors";
  headers["sec-fetch-site"] = "same-site";
  headers["user-agent"] = userAgent;

  if (DEBUG_LOGS) {
    console.log(`Download request: GET ${formatUrlForLog(url)}`);
    const safeHeaders = {
      ...headers,
      cookie: redactHeaderValue(headers.cookie),
      "user-agent": redactHeaderValue(headers["user-agent"], 12),
    };
    console.log(`Request headers: ${JSON.stringify(safeHeaders)}`);
  }

  await downloadToFileWithCurl(url, filePath, headers);
  cookieHeader = "";
  userAgent = "";
}

async function downloadFromPage(page, url, filePath) {
  if (url.startsWith("blob:")) {
    const base64 = await page.evaluate(async (blobUrl) => {
      const res = await fetch(blobUrl);
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result || "";
          const [, data] = String(result).split(",", 2);
          resolve(data || "");
        };
        reader.readAsDataURL(blob);
      });
    }, url);
    if (!base64) {
      throw new Error("Failed to read blob data from page.");
    }
    await fs.promises.writeFile(filePath, Buffer.from(base64, "base64"));
    return;
  }
  await downloadWithCookies(page, url, filePath);
}

function decodeDataUrl(dataUrl) {
  const match = /^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    return null;
  }
  return { mime: match[1], data: match[2] };
}

async function saveDataUrlToFile(dataUrl, filePath) {
  const decoded = decodeDataUrl(dataUrl);
  if (!decoded) {
    throw new Error("Unsupported data URL format.");
  }
  await fs.promises.writeFile(filePath, Buffer.from(decoded.data, "base64"));
}

async function collectImageSources(page) {
  return page.evaluate((xp) => {
    const results = [];
    const snapshot = document.evaluate(
      xp,
      document,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );
    for (let i = 0; i < snapshot.snapshotLength; i += 1) {
      const node = snapshot.snapshotItem(i);
      if (!node) continue;
      if (node.getAttribute("alt") !== "Generated image") continue;
      const src = node.getAttribute("src") || "";
      if (!src || !src.startsWith("data:image/jpeg;base64,")) continue;
      const container = node.closest("div.relative");
      const listItem = node.closest('div[role="listitem"]');
      if (!container && !listItem) {
        results.push({ src, ready: false });
        continue;
      }
      const invisibleInContainer = container
        ? Array.from(container.children).some(
            (child) => child.classList && child.classList.contains("invisible")
          )
        : false;
      const invisibleInListItem = listItem
        ? Boolean(listItem.querySelector(".invisible"))
        : false;
      const hasInvisible = invisibleInContainer || invisibleInListItem;
      results.push({ src, ready: !hasInvisible });
    }
    return results;
  }, GROK_IMAGE_RESULT_XPATH);
}

async function isImageReadyBySrc(page, src) {
  return page.evaluate((targetSrc) => {
    const imgs = Array.from(document.querySelectorAll('img[alt="Generated image"]'));
    const img = imgs.find((node) => (node.getAttribute("src") || "") === targetSrc);
    if (!img) return false;
    const container = img.closest("div.relative");
    const listItem = img.closest('div[role="listitem"]');
    if (!container && !listItem) return false;
    const invisibleInContainer = container
      ? Array.from(container.children).some(
          (child) => child.classList && child.classList.contains("invisible")
        )
      : false;
    const invisibleInListItem = listItem
      ? Boolean(listItem.querySelector(".invisible"))
      : false;
    return !(invisibleInContainer || invisibleInListItem);
  }, src);
}

async function logImageDom(page, src, label) {
  const html = await page.evaluate((targetSrc) => {
    const truncate = (value) => {
      if (!value) return value;
      if (value.startsWith("data:")) {
        const parts = value.split(",", 2);
        if (parts.length === 2) {
          return `${parts[0]},${parts[1].slice(0, 10)}...`;
        }
      }
      return value.slice(0, 10) + "...";
    };
    const imgs = Array.from(document.querySelectorAll('img[alt="Generated image"]'));
    const img = imgs.find((node) => (node.getAttribute("src") || "") === targetSrc);
    if (!img) return "";
    const container =
      img.closest('div[role="listitem"]') || img.closest("div.relative") || img;
    const clone = container.cloneNode(true);
    const cloneImgs = clone.querySelectorAll("img");
    cloneImgs.forEach((node) => {
      const src = node.getAttribute("src") || "";
      if (src) node.setAttribute("src", truncate(src));
    });
    return clone.outerHTML;
  }, src);
  if (html) {
    console.log(`[image-dom] ${label}: ${html}`);
  } else {
    console.log(`[image-dom] ${label}: element not found for src.`);
  }
}

async function clickXPath(page, xpath) {
  const el = await waitForXPath(page, xpath);
  await el.evaluate((node) => {
    node.scrollIntoView({ block: "center", inline: "center" });
  });
  try {
    await el.click();
  } catch (error) {
    await page.evaluate((node) => node.click(), el);
  }
}

async function realClick(page, xpath, delayMs = 250) {
  const el = await waitForXPath(page, xpath);
  await el.evaluate((node) => {
    node.scrollIntoView({ block: "center", inline: "center" });
  });
  const box = await el.boundingBox();
  if (box) {
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.up();
  } else {
    await el.click();
  }
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function typeXPath(page, xpath, value) {
  const el = await waitForXPath(page, xpath);
  await el.evaluate((node) => {
    node.scrollIntoView({ block: "center", inline: "center" });
  });
  await el.click({ clickCount: 3 });
  await page.evaluate((node) => {
    node.focus();
    node.value = "";
    node.dispatchEvent(new Event("input", { bubbles: true }));
  }, el);
  const clipboardWritten = await page
    .evaluate(async (val) => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(val);
          return true;
        }
      } catch (err) {
        return false;
      }
      return false;
    }, value)
    .catch(() => false);
  if (clipboardWritten) {
    await page.keyboard.down("Control");
    await page.keyboard.press("V");
    await page.keyboard.up("Control");
  } else {
    await page.evaluate(
      (node, val) => {
        const data = new DataTransfer();
        data.setData("text/plain", val);
        const pasteEvent = new ClipboardEvent("paste", {
          clipboardData: data,
          bubbles: true,
          cancelable: true
        });
        node.dispatchEvent(pasteEvent);
      },
      el,
      value
    );
  }
  await page.evaluate((node, val) => {
    if (node.value !== val) {
      node.value = val;
      node.dispatchEvent(new Event("input", { bubbles: true }));
    }
    node.dispatchEvent(new Event("change", { bubbles: true }));
  }, el, value);
}

async function typeIntoForm(page, xpath, value) {
  const el = await waitForXPath(page, xpath);
  await el.evaluate((node) => {
    node.scrollIntoView({ block: "center", inline: "center" });
  });
  await el.click();
  await page.keyboard.down("Control");
  await page.keyboard.press("A");
  await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");
  const clipboardWritten = await page
    .evaluate(async (val) => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(val);
          return true;
        }
      } catch (err) {
        return false;
      }
      return false;
    }, value)
    .catch(() => false);
  if (clipboardWritten) {
    await page.keyboard.down("Control");
    await page.keyboard.press("V");
    await page.keyboard.up("Control");
  } else {
    await page.evaluate((node, val) => {
      node.textContent = val;
      node.dispatchEvent(new Event("input", { bubbles: true }));
    }, el, value);
  }
}

async function getTextByXPath(page, xpath) {
  const el = await waitForXPath(page, xpath);
  const text = await page.evaluate((node) => node.textContent || "", el);
  return text.trim();
}

async function getTextIfExistsByXPath(page, xpath) {
  const text = await page.evaluate((xp) => {
    const node = document.evaluate(
      xp,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;
    if (!node) return "";
    return (node.textContent || "").trim();
  }, xpath);
  return text;
}

function extractConfirmationCode(text) {
  const match = text.match(/([A-Z0-9]{3})-([A-Z0-9]{3})/i);
  if (!match) {
    throw new Error(`Could not find confirmation code in: ${text}`);
  }
  return `${match[1]}${match[2]}`.toUpperCase();
}


function makeRandomName() {
  const first = ["Ava", "Noah", "Mia", "Eli", "Zoe", "Leo", "Nina", "Owen"];
  const last = ["Carter", "Reed", "Lopez", "Kim", "Patel", "Nguyen", "Brooks", "Diaz"];
  return {
    first: first[Math.floor(Math.random() * first.length)],
    last: last[Math.floor(Math.random() * last.length)],
  };
}

function makePassword() {
  return `Str0ng!${Date.now()}`;
}

async function focusPage(page) {
  await page.bringToFront();
  await new Promise((resolve) => setTimeout(resolve, 200));
}

async function clickXPathWithDelay(page, xpath, delayMs = 250) {
  await clickXPath(page, xpath);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function waitForXPathPresence(page, xpath, timeoutMs = 60000, pollMs = 500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const exists = await page.evaluate((xp) => {
      return Boolean(
        document.evaluate(
          xp,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        ).singleNodeValue
      );
    }, xpath);
    if (exists) return true;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return false;
}
async function getTurnstileTokenStatus(page) {
  return page.evaluate(() => {
    const field = document.querySelector('[name="cf-turnstile-response"]');
    const value = (field && "value" in field ? field.value : "") || "";
    return { hasField: Boolean(field), valueLength: value.length };
  });
}

async function waitForTurnstileToken({ page, timeoutMs = 10_000, intervalMs = 2_000 }) {
  const start = Date.now();
  let attempt = 0;
  while (Date.now() - start < timeoutMs) {
    attempt += 1;
    let status = { hasField: false, valueLength: 0 };
    try {
      status = await getTurnstileTokenStatus(page);
    } catch (err) {
      console.log(`[turnstile] poll ${attempt}: status check failed: ${err?.message || err}`);
    }

    console.log(
      `[turnstile] poll ${attempt}: hasField=${status.hasField} valueLength=${status.valueLength}`
    );
    if (!status.hasField) return true; // No turnstile on page.
    if (status.valueLength > 0) return true; // Solved by user, token present.
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

class RateLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = "RateLimitError";
  }
}

class ImageNotReadyError extends Error {
  constructor(message) {
    super(message);
    this.name = "ImageNotReadyError";
  }
}

function startRateLimitWatcher(page, state, pollMs = 2000) {
  let stopped = false;
  const task = (async () => {
    while (!stopped) {
      if (!state.rateLimited) {
        try {
          const match = await page.evaluate((xp, expected) => {
            const node = document.evaluate(
              xp,
              document,
              null,
              XPathResult.FIRST_ORDERED_NODE_TYPE,
              null
            ).singleNodeValue;
            if (!node) return false;
            const text = (node.textContent || "").trim();
            return text === expected;
          }, RATE_LIMIT_XPATH, RATE_LIMIT_TEXT);
          if (match) {
            state.rateLimited = true;
            console.log("[rate-limit] Upgrade to unlock more detected. Restarting session.");
          }
        } catch (err) {
          // Ignore transient evaluation errors.
        }
      }
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  })();

  return () => {
    stopped = true;
  };
}

function assertNotRateLimited(state) {
  if (state.rateLimited) {
    throw new RateLimitError("Rate limit detected.");
  }
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Missing config file: ${path.relative(__dirname, CONFIG_PATH)}`);
  }
  const raw = fs.readFileSync(CONFIG_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.prompts) || parsed.prompts.length === 0) {
    throw new Error("config.json must include a non-empty prompts array.");
  }
  return parsed.prompts;
}

function normalizePromptEntry(entry, index) {
  const prompt = typeof entry?.prompt === "string" ? entry.prompt.trim() : "";
  const filePath = typeof entry?.filePath === "string" ? entry.filePath.trim() : "";
  const modalityRaw = typeof entry?.modality === "string" ? entry.modality.trim() : "";
  const modality = modalityRaw ? modalityRaw.toLowerCase() : "video";
  const iterationsRaw = entry?.iterations;
  const iterationsNum = typeof iterationsRaw === "number"
    ? iterationsRaw
    : Number(iterationsRaw);
  let iterations = Number.isFinite(iterationsNum)
    ? Math.max(1, Math.floor(iterationsNum))
    : 1;
  if (!prompt) {
    throw new Error(`Prompt at index ${index} is missing or empty.`);
  }
  if (modality !== "video" && modality !== "image") {
    throw new Error(`Prompt at index ${index} has invalid modality: ${modality}`);
  }
  if (modality === "image" && filePath) {
    throw new Error(`Prompt at index ${index} must not include filePath for images.`);
  }
  if (modality === "image" && iterations > 8) {
    console.log(`[image] Prompt ${index + 1} iterations capped at 8 (requested ${iterations}).`);
    iterations = 8;
  }
  return { prompt, filePath, iterations, modality };
}

async function prepareImagine(page, state, modality) {
  assertNotRateLimited(state);
  await page.goto("https://grok.com/imagine", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  const needsSetup = !state.settingsApplied || state.lastModality !== modality;
  if (needsSetup) {
    await clickXPathWithDelay(
      page,
      "/html/body/div[2]/div[1]/div/div/div[3]/div[1]/div/button"
    );
    await clickXPathWithDelay(page, "/html/body/div[6]/div/div[1]");
    await clickXPathWithDelay(page, "/html/body/div[7]/div[2]/div[1]/button[3]");
    await clickXPathWithDelay(page, "/html/body/div[7]/div[2]/div[2]/div/div[8]/div[2]/button");
    await clickXPathWithDelay(page, "/html/body/div[7]/button");
    console.log(`[model] clicking trigger xpath: ${GROK_MODEL_SELECT_TRIGGER_XPATH}`);
    await clickXPathWithDelay(page, GROK_MODEL_SELECT_TRIGGER_XPATH);
    const panelXpath =
      modality === "image"
        ? GROK_MODEL_SELECT_PANEL_IMAGE_XPATH
        : GROK_MODEL_SELECT_PANEL_VIDEO_XPATH;
    console.log(`[model] waiting for panel xpath: ${panelXpath}`);
    await waitForXPath(page, panelXpath);
    console.log(`[model] clicking panel xpath: ${panelXpath}`);
    await clickXPathWithDelay(page, panelXpath);
    console.log(`[model] re-clicking trigger xpath: ${GROK_MODEL_SELECT_TRIGGER_XPATH}`);
    await clickXPathWithDelay(page, GROK_MODEL_SELECT_TRIGGER_XPATH);
    console.log(`[model] clicking close xpath: ${GROK_MODEL_SELECT_CLOSE_XPATH}`);
    await clickXPathWithDelay(page, GROK_MODEL_SELECT_CLOSE_XPATH);
    state.settingsApplied = true;
    state.lastModality = modality;
  }
}

async function generateVideoForPrompt(page, entry, attempt) {
  if (entry.filePath) {
    const uploadInput = await waitForXPath(page, GROK_UPLOAD_INPUT_XPATH);
    await uploadInput.uploadFile(entry.filePath);
    await page.keyboard.press("Enter");
  }

  const promptReady = await waitForXPathPresence(page, GROK_PROMPT_INPUT_XPATH, 60000, 500);
  if (!promptReady) {
    throw new Error(`Prompt input not found: ${GROK_PROMPT_INPUT_XPATH}`);
  }
  // await new Promise((resolve) => setTimeout(resolve, 800000));
  await clickXPathWithDelay(page, GROK_PROMPT_INPUT_XPATH);
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await typeXPath(page, GROK_PROMPT_INPUT_XPATH, entry.prompt);
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await realClick(page, GROK_SUBMIT_PROMPT_BUTTON_XPATH);
  await new Promise((resolve) => setTimeout(resolve, 3000));
  await waitForXPath(page, GROK_RESULT_VIDEO_XPATH);
  const videoSrc = await page.evaluate((xp) => {
    const node = document.evaluate(
      xp,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;
    return node ? node.getAttribute("src") || "" : "";
  }, GROK_RESULT_VIDEO_XPATH);
  if (!videoSrc) {
    throw new Error("Video src not found.");
  }
  await ensureDir(OUTPUT_DIR);
  const outputPath = path.join(OUTPUT_DIR, `grok-output-${Date.now()}-a${attempt}.mp4`);
  await downloadFromPage(page, videoSrc, outputPath);
  console.log(`Downloaded output to ${path.relative(__dirname, outputPath)}`);
  return outputPath;
}

async function generateImagesForPrompt(page, entry, promptIndex, state) {
  const promptReady = await waitForXPathPresence(page, GROK_IMAGE_PROMPT_FORM_XPATH, 60000, 500);
  if (!promptReady) {
    throw new Error(`Image prompt form not found: ${GROK_IMAGE_PROMPT_FORM_XPATH}`);
  }
  await clickXPathWithDelay(page, GROK_IMAGE_PROMPT_FORM_XPATH);
  await new Promise((resolve) => setTimeout(resolve, 500));
  await typeIntoForm(page, GROK_IMAGE_PROMPT_FORM_XPATH, entry.prompt);
  await new Promise((resolve) => setTimeout(resolve, 500));
  await realClick(page, GROK_IMAGE_SUBMIT_PROMPT_BUTTON_XPATH);
  await new Promise((resolve) => setTimeout(resolve, 3000));

  await ensureDir(OUTPUT_DIR);
  await waitForXPathPresence(page, GROK_IMAGE_RESULT_XPATH, 120000, 1000);
  const promptOutputDir = path.join(OUTPUT_DIR, `prompt-${promptIndex + 1}`);
  await ensureDir(promptOutputDir);
  const baseName = `grok-image-p${promptIndex + 1}`;
  const imageState = state.imageDownloads.get(promptIndex) || { seen: new Set(), count: 0 };
  state.imageDownloads.set(promptIndex, imageState);
  const seen = imageState.seen;
  let downloadedCount = imageState.count;
  let scrollAttempts = 0;
  const maxScrolls = Math.max(20, entry.iterations * 3);
  let readinessRetries = 0;
  const maxReadinessRetries = 10;

  const minRequired = Math.min(8, entry.iterations);
  while (downloadedCount < entry.iterations && scrollAttempts <= maxScrolls) {
    const items = await collectImageSources(page);
    if (items.length < minRequired) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      continue;
    }
    let sawUnready = items.length === 0;
    for (const item of items) {
      if (!item.ready) {
        sawUnready = true;
        continue;
      }
      const src = item.src;
      if (seen.has(src)) continue;
      const readyNow = await isImageReadyBySrc(page, src);
      if (!readyNow) {
        sawUnready = true;
        continue;
      }
      const imageIndex = downloadedCount + 1;
      const outputPath = path.join(promptOutputDir, `${baseName}-i${imageIndex}.jpg`);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const stillReady = await isImageReadyBySrc(page, src);
      if (!stillReady) {
        sawUnready = true;
        continue;
      }
      await logImageDom(page, src, `download ${imageIndex}/${entry.iterations}`);
      if (src.startsWith("data:image/")) {
        await saveDataUrlToFile(src, outputPath);
      } else {
        await downloadFromPage(page, src, outputPath);
      }
      seen.add(src);
      downloadedCount += 1;
      imageState.count = downloadedCount;
      console.log(
        `Downloaded image ${imageIndex}/${entry.iterations} to ${path.relative(__dirname, outputPath)}`
      );
      if (downloadedCount >= entry.iterations) break;
    }
    if (downloadedCount >= entry.iterations) break;
    if (sawUnready) {
      readinessRetries += 1;
      if (readinessRetries > maxReadinessRetries) {
        throw new ImageNotReadyError("Image elements never finished loading.");
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
      continue;
    }
    readinessRetries = 0;
    scrollAttempts += 1;
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  if (downloadedCount < entry.iterations) {
    throw new Error(
      `Only downloaded ${downloadedCount}/${entry.iterations} images before reaching scroll limit.`
    );
  }

  return true;
}

async function runPromptWithRetry(
  page,
  entry,
  index,
  state,
  maxAttempts = 5,
  iterationIndex = 0
) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      assertNotRateLimited(state);
      console.log(
        `Starting prompt ${index + 1} iteration ${iterationIndex + 1} attempt ${attempt}`
      );
      await prepareImagine(page, state, entry.modality);
      assertNotRateLimited(state);
      if (entry.modality === "image") {
        await generateImagesForPrompt(page, entry, index, state);
      } else {
        await generateVideoForPrompt(page, entry, attempt);
      }
      assertNotRateLimited(state);
      await page.goto("https://grok.com/imagine", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      return true;
    } catch (err) {
      if (err instanceof RateLimitError) {
        throw err;
      }
      console.error(
        `Prompt ${index + 1} iteration ${iterationIndex + 1} failed, retrying after refresh:`,
        err
      );
      try {
        await page.goto("https://grok.com/imagine", {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });
      } catch (refreshErr) {
        console.error("Refresh failed, continuing to retry:", refreshErr);
      }
    }
  }
  throw new Error(`Prompt ${index + 1} exceeded ${maxAttempts} attempts.`);
}

async function signupAndPrepare({ grokPage, browser }) {
  let emailPage = null;
  await grokPage.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 60000 });

  const pagesBefore = await browser.pages();
  await grokPage.evaluate((url) => window.open(url, "_blank"), EMAIL_URL);
  for (let i = 0; i < 20; i += 1) {
    const pagesAfter = await browser.pages();
    emailPage = pagesAfter.find((p) => !pagesBefore.includes(p));
    if (emailPage) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!emailPage) {
    throw new Error("Failed to open email tab.");
  }
  await focusPage(emailPage);

  let emailAddress = "";
  for (;;) {
    emailAddress = await getTextByXPath(emailPage, EMAIL_VALUE_XPATH);
    if (!emailAddress.toLowerCase().includes("generating random email")) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  console.log("Temp email acquired.");

  await focusPage(grokPage);
  await clickXPath(grokPage, "/html/body/div[2]/div/div[1]/div[2]/div/div[2]/button[1]");
  await typeXPath(grokPage, GROK_EMAIL_INPUT_XPATH, emailAddress);
  await clickXPath(grokPage, GROK_NEXT_BUTTON_XPATH);
  emailAddress = "";

  await focusPage(emailPage);
  await clickXPath(emailPage, EMAIL_INBOX_BUTTON_XPATH);
  let codeText = "";
  for (;;) {
    console.log("Refreshing inbox...");
    await clickXPath(emailPage, EMAIL_INBOX_REFRESH_XPATH);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    codeText = await getTextIfExistsByXPath(emailPage, EMAIL_CODE_TEXT_XPATH);
    if (codeText) {
      break;
    }
  }
  let confirmationCode = extractConfirmationCode(codeText);

  await focusPage(grokPage);
  await typeXPath(grokPage, GROK_CODE_INPUT_XPATH, confirmationCode);
  await clickXPath(grokPage, GROK_NEXT_BUTTON_XPATH);
  codeText = "";
  confirmationCode = "";

  let { first, last } = makeRandomName();
  let password = makePassword();
  await typeXPath(grokPage, GROK_FIRST_NAME_XPATH, first);
  await typeXPath(grokPage, GROK_LAST_NAME_XPATH, last);
  await typeXPath(grokPage, GROK_PASSWORD_XPATH, password);
  console.log("Filled name/password.");
  first = "";
  last = "";
  password = "";

  startBackgroundTurnstileSolver(grokPage, { pollInterval: 2500, pollTime: 15000, debug: true });
  await new Promise((resolve) => setTimeout(resolve, 8000));
  console.log("[turnstile] ready, submitting once.");
  await clickXPath(grokPage, GROK_FINAL_BUTTON_XPATH);
  await grokPage.waitForFunction(() => document.readyState === "complete", {
    timeout: 60000,
  });
  await new Promise((resolve) => setTimeout(resolve, 5000));

  if (emailPage && !emailPage.isClosed()) {
    await emailPage.close();
  }
}

async function start() {
  const prompts = loadConfig();
  let currentIndex = 0;
  
  while (currentIndex < prompts.length) {
    const connection = await connect({
      headless: false,
      args: [
        "--disable-dev-shm-usage",
        "--start-maximized",
        "--incognito",
        "--no-first-run",
        "--no-default-browser-check",
      ],
      connectOption: {
        defaultViewport: null,
      },
      disableXvfb: true,
      ignoreAllFlags: false,
    });

    const { page, browser } = connection;
    const grokPage = page;
    const state = {
      settingsApplied: false,
      rateLimited: false,
      lastModality: null,
      imageDownloads: new Map(),
    };
    const stopWatcher = startRateLimitWatcher(grokPage, state, 2000);

    try {
      await signupAndPrepare({ grokPage, browser });
      for (; currentIndex < prompts.length; currentIndex += 1) {
        const entry = normalizePromptEntry(prompts[currentIndex], currentIndex);
        if (entry.modality === "image") {
          await runPromptWithRetry(grokPage, entry, currentIndex, state, 5, 0);
        } else {
          for (let iteration = 0; iteration < entry.iterations; iteration += 1) {
            await runPromptWithRetry(grokPage, entry, currentIndex, state, 5, iteration);
          }
        }
      }
      if (browser && browser.isConnected()) {
        await browser.close();
      }
      return;
    } catch (err) {
      if (err instanceof RateLimitError || state.rateLimited) {
        stopWatcher();
        if (browser && browser.isConnected()) {
          await browser.close();
        }
        console.log("Rate limit detected; stopping batch run.");
        return;
      }
      stopWatcher();
      console.error("Batch run failed:", err);
      // Keep process alive for manual inspection.
      setInterval(() => {}, 1000);
      return;
    }
  }
  await new Promise(() => {});
}

start().catch((err) => {
  console.error("Batch run failed:", err);
  // Keep process alive for manual inspection.
  setInterval(() => {}, 1000);
});
