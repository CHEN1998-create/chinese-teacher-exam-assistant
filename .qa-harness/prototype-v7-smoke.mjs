import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const shotDir = path.resolve("prototype-v7-source");
const base = pathToFileURL(path.join(shotDir, "index.html")).href;
const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
});

async function freshPage(viewport) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(() => localStorage.clear());
  const page = await context.newPage();
  const externalRequests = [];
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("request", (request) => {
    const requestUrl = new URL(request.url());
    if (requestUrl.protocol !== "file:") {
      externalRequests.push(request.url());
    }
  });
  await page.goto(base, { waitUntil: "networkidle" });
  return { context, page, externalRequests, runtimeErrors };
}

try {
  const desktop = await freshPage({ width: 1366, height: 768 });
  const nextBox = await desktop.page.locator("[data-next]").boundingBox();
  if (!nextBox || nextBox.y + nextBox.height > 768) {
    throw new Error("桌面端首屏没有完整露出第一问的继续按钮");
  }
  if (desktop.externalRequests.length) {
    throw new Error(`发现第三方运行时请求：${desktop.externalRequests.join(", ")}`);
  }
  if (await desktop.page.locator("[data-menu]").isVisible()) {
    throw new Error("桌面端同时显示了完整导航和折叠菜单按钮");
  }
  await desktop.page.screenshot({
    path: path.join(shotDir, "qa-desktop-1366x768.png"),
    fullPage: false,
  });

  await desktop.page.getByPlaceholder("例如 杭州、浙江省、长三角").fill("北京市");
  await desktop.page.getByRole("button", { name: /北京市/ }).click();
  const feedback = await desktop.page.locator("[data-fb]").innerText();
  if (!feedback.includes("接下来只看你愿意去的地区")) {
    throw new Error("地区选择后没有出现明确的正向反馈");
  }
  if (!(await desktop.page.locator("[data-next]").innerText()).includes("已保存")) {
    throw new Error("完成第一问后，继续按钮没有显示保存反馈");
  }
  await desktop.page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("jzyj.v1") || "{}");
    saved.step = 6;
    saved.onboardingDone = true;
    localStorage.setItem("jzyj.v1", JSON.stringify(saved));
  });
  await desktop.page.goto(`${base}#/preview`, { waitUntil: "networkidle" });
  await desktop.page.waitForTimeout(700);
  const previewText = await desktop.page.locator("#main").innerText();
  if (!previewText.includes("你选的地区现在还没有收录到招聘")) {
    throw new Error("未覆盖地区没有进入真实空状态");
  }
  if (previewText.includes("杭州市西湖区 2026")) {
    throw new Error("未覆盖地区仍混入了其他地区的岗位");
  }
  await desktop.context.close();

  const mobile = await freshPage({ width: 390, height: 844 });
  const scrollWidth = await mobile.page.evaluate(() => document.documentElement.scrollWidth);
  if (scrollWidth > 390) {
    const offenders = await mobile.page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName,
            className: element.className,
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            text: (element.textContent || "").trim().slice(0, 60),
          };
        })
        .filter((item) => item.right > window.innerWidth + 1 || item.width > window.innerWidth + 1)
        .sort((a, b) => b.right - a.right)
        .slice(0, 8),
    );
    console.error(JSON.stringify(offenders, null, 2));
    throw new Error(`移动端出现横向滚动：${scrollWidth}px`);
  }
  const mobileNextBox = await mobile.page.locator("[data-next]").boundingBox();
  await mobile.page.screenshot({
    path: path.join(shotDir, "qa-mobile-390x844.png"),
    fullPage: false,
  });
  if (!mobileNextBox || mobileNextBox.y + mobileNextBox.height > 844) {
    throw new Error("移动端首屏没有完整露出第一问的继续按钮");
  }
  await mobile.context.close();

  const routeCheck = await freshPage({ width: 1024, height: 768 });
  await routeCheck.page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("jzyj.v1") || "{}");
    saved.authed = true;
    saved.onboardingDone = true;
    saved.step = 6;
    localStorage.setItem("jzyj.v1", JSON.stringify(saved));
  });
  const routes = [
    "/", "/onboarding", "/preview", "/opportunities",
    "/opportunities/hz-xh-2026-1", "/opportunities/hz-xh-2026-1/materials",
    "/opportunities/hz-xh-2026-1/changes", "/applications",
    "/applications/hz-xh-2026-1", "/plan", "/schedule", "/me",
    "/me/profile", "/me/notifications", "/me/privacy", "/me/corrections",
    "/coverage", "/login", "/about", "/privacy", "/states",
    "/console", "/console/draft", "/console/publish", "/console/diff",
    "/console/corrections",
  ];
  for (const route of routes) {
    await routeCheck.page.goto(`${base}#${route}`, { waitUntil: "networkidle" });
    const mainText = (await routeCheck.page.locator("#main").innerText()).trim();
    if (!mainText) throw new Error(`路由没有渲染内容：${route}`);
  }
  if (routeCheck.runtimeErrors.length) {
    throw new Error(`全路由检查发现脚本错误：${routeCheck.runtimeErrors.join(" | ")}`);
  }
  await routeCheck.context.close();

  const product = await freshPage({ width: 1440, height: 900 });
  await product.page.evaluate(() => {
    S.auth = { phone: "13800000000", at: Date.now() };
    S.profile.regions = [{ n: "杭州市", p: "浙江省", tier: "must" }];
    S.profile.edu = "本科";
    S.profile.degree = "学士";
    S.profile.major = "汉语言文学";
    S.profile.gradYm = "2026-06";
    S.profile.studyState = "已经毕业";
    S.profile.jobState = "没有工作";
    S.profile.cert = "已取得";
    S.profile.certStage = "小学";
    S.profile.certSubject = "语文";
    S.profile.forms = ["事业编"];
    S.onboardingDone = true;
    S.step = 6;
    follow("hz-xh-2026-1");
    setPrimary("hz-xh-2026-1");
    setApplicationState(OPPS[0], "准备报名");
    persist();
  });
  await product.page.goto(`${base}#/applications`, { waitUntil: "networkidle" });
  await product.page.waitForTimeout(500);
  const applicationText = await product.page.locator("#main").innerText();
  if (!applicationText.includes("我的报考") || !applicationText.includes("当前主目标")) {
    throw new Error("报考工作台没有呈现主目标和下一步");
  }
  await product.page.screenshot({ path: path.join(shotDir, "qa-applications-1440x900.png"), fullPage: false });
  await product.page.goto(`${base}#/plan`, { waitUntil: "networkidle" });
  await product.page.waitForTimeout(500);
  await product.page.locator("[data-create-plan]").click();
  await product.page.locator('[data-plan-days] [data-v="3"]').click();
  await product.page.locator('[data-plan-focus] [data-v="学科专业知识"]').click();
  await product.page.getByRole("button", { name: "生成计划", exact: true }).click();
  await product.page.waitForTimeout(500);
  const planText = await product.page.locator("#main").innerText();
  if (!planText.includes("学科专业知识") || !planText.includes("3 天")) {
    throw new Error("备考计划没有按用户选择生成");
  }
  const firstTask = product.page.locator("[data-plan-task]").first();
  await firstTask.click();
  await product.page.waitForTimeout(500);
  if ((await product.page.locator("[data-plan-task]").first().getAttribute("aria-pressed")) !== "true") {
    throw new Error("备考任务完成状态没有保存并反馈");
  }
  await product.page.screenshot({ path: path.join(shotDir, "qa-plan-1440x900.png"), fullPage: false });
  await product.page.goto(`${base}#/applications/hz-xh-2026-1`, { waitUntil: "networkidle" });
  await product.page.waitForTimeout(500);
  const detailText = await product.page.locator("#main").innerText();
  if (!detailText.includes("报名只能在官方系统完成") || !detailText.includes("眼下最该做的一件事")) {
    throw new Error("报考详情没有清楚展示官方边界或下一步");
  }
  await product.page.goto(`${base}#/`, { waitUntil: "networkidle" });
  await product.page.waitForTimeout(500);
  if (!(await product.page.locator("#main").innerText()).includes("今天先做这一件事")) {
    throw new Error("登录后首页没有切换为任务工作台");
  }
  await product.page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/applications", "/applications/hz-xh-2026-1", "/plan"]) {
    await product.page.goto(`${base}#${route}`, { waitUntil: "networkidle" });
    await product.page.waitForTimeout(500);
    const pageWidth = await product.page.evaluate(() => document.documentElement.scrollWidth);
    if (pageWidth > 390) throw new Error(`移动端产品页出现横向滚动：${route} → ${pageWidth}px`);
  }
  await product.page.screenshot({ path: path.join(shotDir, "qa-plan-mobile-390x844.png"), fullPage: false });
  await product.context.close();

  for (const viewport of [
    { width: 360, height: 800 }, { width: 430, height: 932 },
    { width: 768, height: 1024 }, { width: 1280, height: 800 },
    { width: 1920, height: 1080 },
  ]) {
    const check = await freshPage(viewport);
    const width = await check.page.evaluate(() => document.documentElement.scrollWidth);
    if (width > viewport.width) {
      throw new Error(`响应式检查出现横向滚动：${viewport.width}px → ${width}px`);
    }
    if (check.runtimeErrors.length) {
      throw new Error(`响应式检查发现脚本错误：${check.runtimeErrors.join(" | ")}`);
    }
    await check.context.close();
  }

  console.log("prototype-v7 smoke: onboarding feedback, application and plan flows, 26 routes, and 7 viewports passed");
} finally {
  await browser.close();
}
