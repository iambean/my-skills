#!/usr/bin/env node
/**
 * Publish or list static share pages on iambean/for-share (GitHub Pages).
 *
 *   node for-share.mjs import --src ./out --slug jijian-linmo --title "标题"
 *   → 顶层目录 2026-09-01-jijian-linmo/
 *   node for-share.mjs list
 *   node for-share.mjs enable-pages
 */

import { execFileSync, execSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_OWNER = "iambean";
const DEFAULT_REPO = "for-share";
const PAGES_HOST = (owner, repo) => `https://${owner}.github.io/${repo}`;
const SKIP_DIR_NAMES = new Set([".git", ".github", "node_modules"]);

const TEXT_EXT = new Set([
  ".html",
  ".js",
  ".css",
  ".json",
  ".txt",
  ".xml",
  ".svg",
  ".map",
  ".webmanifest",
]);

const DATE_SLUG_PREFIX = /^(\d{4}-\d{2}-\d{2})-/;

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function sanitizeSlug(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** One top-level folder: 2026-09-01-my-page. Do not nest extra directories. */
function datedSlug(raw) {
  const cleaned = sanitizeSlug(raw) || "share";
  if (DATE_SLUG_PREFIX.test(cleaned)) return cleaned;
  return `${todayStamp()}-${cleaned}`;
}

function headingFromSlug(slug) {
  const clean = String(slug || "").replace(/\/+$/, "");
  return `${clean}/`;
}

function rewriteExistingPrefix(dir, fromPrefix, toPrefix) {
  const from = fromPrefix.endsWith("/") ? fromPrefix.slice(0, -1) : fromPrefix;
  const to = toPrefix.endsWith("/") ? toPrefix.slice(0, -1) : toPrefix;
  if (!from || from === to) return;
  for (const file of walkFiles(dir)) {
    if (!TEXT_EXT.has(path.extname(file).toLowerCase())) continue;
    const text = readFileSync(file, "utf8");
    const next = text.replaceAll(from, to);
    if (next !== text) writeFileSync(file, next);
  }
}

function foldHumanTitle(description, title, slug) {
  const heading = headingFromSlug(slug);
  const human = String(title || "").trim();
  let desc = String(description || "").trim();
  if (
    human &&
    human !== heading &&
    human !== slug &&
    !DATE_SLUG_PREFIX.test(sanitizeSlug(human)) &&
    !desc.includes(human)
  ) {
    desc = desc ? `${human}。${desc}` : human;
  }
  return desc;
}

function migrateUndatedPages(root, repo, pages) {
  const result = [];
  for (const page of pages) {
    const original = String(page.slug || "").replace(/\/+$/, "");
    if (!original || SKIP_DIR_NAMES.has(original)) continue;
    let slug = sanitizeSlug(original) || original;
    if (!DATE_SLUG_PREFIX.test(slug)) {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(page.updated || "")
        ? page.updated
        : todayStamp();
      const newSlug = `${date}-${sanitizeSlug(original) || original}`;
      const fromDir = path.join(root, original);
      const toDir = path.join(root, newSlug);
      if (existsSync(fromDir) && fromDir !== toDir) {
        if (existsSync(toDir)) rmSync(toDir, { recursive: true, force: true });
        renameSync(fromDir, toDir);
        rewriteExistingPrefix(toDir, `/${repo}/${original}`, `/${repo}/${newSlug}`);
      }
      slug = newSlug;
    }
    result.push({
      slug,
      title: headingFromSlug(slug),
      description: foldHumanTitle(page.description, page.title, slug),
      updated: page.updated || todayStamp(),
    });
  }
  return result;
}

function undatedSlug(slug) {
  return sanitizeSlug(slug).replace(DATE_SLUG_PREFIX, "");
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const cur = argv[i];
    if (cur.startsWith("--")) {
      const key = cur.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i += 1;
      }
    } else {
      args._.push(cur);
    }
  }
  return args;
}

function tokenFromEnv() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  try {
    const t = execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return t || "";
  } catch {
    return "";
  }
}

function redact(value) {
  return String(value)
    .replace(/bearer [^\s"]+/gi, "bearer ***")
    .replace(/x-access-token:[^@\s]+/gi, "x-access-token:***")
    .replace(/ghp_[A-Za-z0-9_]+/g, "ghp_***")
    .replace(/github_pat_[A-Za-z0-9_]+/g, "github_pat_***");
}

function gitEnv(token) {
  return {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
    GIT_ASKPASS: "true",
    GITHUB_TOKEN: token,
    GH_TOKEN: token,
  };
}

function githubRemoteUrl(token, owner, repo) {
  return `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
}

function run(cmd, extra = {}) {
  console.log(`$ ${redact(cmd)}`);
  try {
    execSync(cmd, { stdio: "inherit", ...extra });
  } catch (error) {
    throw new Error(redact(error.message || error));
  }
}

function runGit(args, extra = {}) {
  console.log(`$ git ${redact(args.join(" "))}`);
  try {
    execFileSync("git", args, { stdio: "inherit", ...extra });
  } catch (error) {
    throw new Error(redact(error.message || error));
  }
}

function walkFiles(root) {
  const out = [];
  for (const name of readdirSync(root)) {
    const full = path.join(root, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

function rewriteAssetPrefix(dir, prefix) {
  const normalized = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  const topFiles = readdirSync(dir).filter((name) =>
    statSync(path.join(dir, name)).isFile()
  );
  for (const file of walkFiles(dir)) {
    if (!TEXT_EXT.has(path.extname(file).toLowerCase()) && path.extname(file)) {
      continue;
    }
    if (!TEXT_EXT.has(path.extname(file).toLowerCase())) continue;
    let text = readFileSync(file, "utf8");
    const before = text;
    text = text.replaceAll("/_next/", `${normalized}/_next/`);
    for (const name of topFiles) {
      if (name.startsWith(".")) continue;
      text = text.replaceAll(`/${name}`, `${normalized}/${name}`);
    }
    if (text !== before) writeFileSync(file, text);
  }
}

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(src)) {
    if (name === ".git") continue;
    const from = path.join(src, name);
    const to = path.join(dest, name);
    const st = statSync(from);
    if (st.isDirectory()) copyDir(from, to);
    else copyFileSync(from, to);
  }
}

function catalogHtml(owner, repo, pages) {
  const cards = pages
    .map((page) => {
      const url = `${PAGES_HOST(owner, repo)}/${page.slug}/`;
      const heading = headingFromSlug(page.slug);
      const note = page.description || "";
      return `<a class="card" href="${url}">
  <h2>${escapeHtml(heading)}</h2>
  ${note ? `<p>${escapeHtml(note)}</p>` : ""}
</a>`;
    })
    .join("\n");

  const empty = pages.length
    ? ""
    : `<p class="empty">还没有 share page。用 github-for-share skill 的 import 导入一个静态目录。</p>`;

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>for-share</title>
  <style>
    :root { color-scheme: light; font-family: "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", sans-serif; }
    body { margin: 0; background: #f6f1e8; color: #2a241c; }
    main { max-width: 840px; margin: 0 auto; padding: 48px 20px 80px; }
    h1 { font-size: 2rem; letter-spacing: -0.03em; }
    .grid { display: grid; gap: 12px; }
    .card { display: block; padding: 16px 18px; background: #fffcf7; border-radius: 14px; text-decoration: none; color: inherit; box-shadow: 0 0 0 1px #00000012; }
    .card h2 { margin: 0 0 6px; font-size: 1.05rem; font-family: ui-monospace, Menlo, monospace; letter-spacing: -0.02em; }
    .card p { margin: 0; color: #6b6258; font-size: 0.92rem; }
    .empty { color: #6b6258; }
  </style>
</head>
<body>
  <main>
    <h1>for-share</h1>
    <p>独立静态页目录，由 github-for-share skill 导入。</p>
    <div class="grid">
      ${cards || empty}
    </div>
  </main>
</body>
</html>
`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pagesWorkflow() {
  return [
    "name: Deploy for-share to GitHub Pages",
    "",
    "on:",
    '  push:',
    '    branches: ["main"]',
    "  workflow_dispatch:",
    "",
    "permissions:",
    "  contents: read",
    "  pages: write",
    "  id-token: write",
    "",
    "concurrency:",
    "  group: pages",
    "  cancel-in-progress: false",
    "",
    "jobs:",
    "  deploy:",
    "    runs-on: ubuntu-latest",
    "    environment:",
    "      name: github-pages",
    "      url: ${{ steps.deployment.outputs.page_url }}",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - uses: actions/configure-pages@v5",
    "      - uses: actions/upload-pages-artifact@v3",
    "        with:",
    "          path: .",
    "      - id: deployment",
    "        uses: actions/deploy-pages@v4",
    "",
  ].join("\n");
}

function repoReadme(owner, repo) {
  return `# for-share

每个独立的静态网页包占一个目录，由 \`github-for-share\` skill 一键导入。

GitHub Pages：${PAGES_HOST(owner, repo)}/

| 目录 | 页面 |
| --- | --- |
| \`<slug>/\` | ${PAGES_HOST(owner, repo)}/<slug>/ |

用 skill 查询现有页面：

\`\`\`text
使用 skill: github-for-share
mode=list
\`\`\`
`;
}

async function githubFetch(token, url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "github-for-share-skill",
      ...(init.headers || {}),
    },
  });
  return res;
}

async function ensureRepo(token, owner, repo) {
  const existing = await githubFetch(
    token,
    `https://api.github.com/repos/${owner}/${repo}`
  );
  if (existing.status === 200) {
    await ensurePublic(token, owner, repo);
    return { created: false };
  }
  if (existing.status !== 404) {
    throw new Error(`无法读取仓库：HTTP ${existing.status} ${await existing.text()}`);
  }
  const created = await githubFetch(token, "https://api.github.com/user/repos", {
    method: "POST",
    body: JSON.stringify({
      name: repo,
      private: false,
      visibility: "public",
      description:
        "Static share pages. Each independent static web package lives in its own directory.",
      has_issues: false,
      has_projects: false,
      has_wiki: false,
      auto_init: true,
    }),
  });
  if (!created.ok) {
    throw new Error(`创建仓库失败：HTTP ${created.status} ${await created.text()}`);
  }
  await ensurePublic(token, owner, repo);
  return { created: true };
}

async function ensurePublic(token, owner, repo) {
  const res = await githubFetch(token, `https://api.github.com/repos/${owner}/${repo}`, {
    method: "PATCH",
    body: JSON.stringify({ private: false, visibility: "public" }),
  });
  if (!res.ok && res.status !== 422) {
    console.log(`仓库可见性未改成 public：HTTP ${res.status}`);
  }
}

async function enablePages(token, owner, repo) {
  const workflow = await githubFetch(
    token,
    `https://api.github.com/repos/${owner}/${repo}/pages`,
    {
      method: "POST",
      body: JSON.stringify({ build_type: "workflow" }),
    }
  );
  if (workflow.status === 201 || workflow.status === 204 || workflow.status === 409) {
    return "workflow";
  }
  const branch = await githubFetch(
    token,
    `https://api.github.com/repos/${owner}/${repo}/pages`,
    {
      method: "POST",
      body: JSON.stringify({
        source: { branch: "main", path: "/" },
      }),
    }
  );
  if (branch.ok || branch.status === 409) return "branch";
  const put = await githubFetch(
    token,
    `https://api.github.com/repos/${owner}/${repo}/pages`,
    {
      method: "PUT",
      body: JSON.stringify({ build_type: "workflow" }),
    }
  );
  if (!put.ok && put.status !== 409) {
    throw new Error(
      `开启 GitHub Pages 失败：HTTP ${put.status} ${await put.text()}`
    );
  }
  return "workflow";
}

function writeBootstrapFiles(root, owner, repo, pages) {
  mkdirSync(path.join(root, ".github", "workflows"), { recursive: true });
  writeFileSync(path.join(root, ".github", "workflows", "pages.yml"), pagesWorkflow());
  writeFileSync(path.join(root, ".nojekyll"), "");
  writeFileSync(
    path.join(root, "shares.json"),
    `${JSON.stringify({ pages }, null, 2)}\n`
  );
  writeFileSync(path.join(root, "index.html"), catalogHtml(owner, repo, pages));
  writeFileSync(path.join(root, "README.md"), repoReadme(owner, repo));
}

function readShares(root) {
  const file = path.join(root, "shares.json");
  if (!existsSync(file)) return { pages: [] };
  try {
    const data = JSON.parse(readFileSync(file, "utf8"));
    return { pages: Array.isArray(data.pages) ? data.pages : [] };
  } catch {
    return { pages: [] };
  }
}

function upsertPage(pages, entry) {
  const next = pages.filter((page) => page.slug !== entry.slug);
  next.unshift(entry);
  return next.sort((a, b) => a.slug.localeCompare(b.slug));
}

function discoverPages(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((name) => !SKIP_DIR_NAMES.has(name) && !name.startsWith("."))
    .filter((name) => {
      const full = path.join(root, name);
      return (
        statSync(full).isDirectory() &&
        existsSync(path.join(full, "index.html"))
      );
    })
    .map((slug) => ({
      slug,
      title: slug,
      description: "",
      url: "",
    }));
}

async function cloneRepo(token, owner, repo, dest) {
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  const env = gitEnv(token);
  try {
    execFileSync(
      "gh",
      ["repo", "clone", `${owner}/${repo}`, dest, "--", "--depth", "1"],
      { stdio: "inherit", env }
    );
    return;
  } catch {
    runGit(
      ["clone", "--depth", "1", githubRemoteUrl(token, owner, repo), dest],
      { env }
    );
  }
}

function commitAndPush(root, message, token, owner, repo) {
  const env = gitEnv(token);
  const publicRemote = `https://github.com/${owner}/${repo}.git`;
  try {
    runGit(["remote", "set-url", "origin", publicRemote], { cwd: root, env });
  } catch {
    runGit(["remote", "add", "origin", publicRemote], { cwd: root, env });
  }
  runGit(["add", "-A"], { cwd: root, env });
  try {
    runGit(
      [
        "-c",
        "user.name=iambean",
        "-c",
        "user.email=brynden.mao@qq.com",
        "commit",
        "-m",
        message,
      ],
      { cwd: root, env }
    );
  } catch {
    console.log("没有新的文件变更。");
    return false;
  }
  try {
    runGit(["push", "-u", "origin", "HEAD:main"], { cwd: root, env });
  } catch {
    runGit(["push", githubRemoteUrl(token, owner, repo), "HEAD:main"], {
      cwd: root,
      env,
    });
  }
  return true;
}

function printPages(owner, repo, pages) {
  if (!pages.length) {
    console.log("还没有 share page。");
    return;
  }
  for (const page of pages) {
    const url = page.url || `${PAGES_HOST(owner, repo)}/${page.slug}/`;
    console.log(`- ${headingFromSlug(page.slug)}`);
    if (page.description) console.log(`  ${page.description}`);
    console.log(`  ${url}`);
  }
}

async function cmdList({ owner, repo, token }) {
  if (token) {
    const res = await githubFetch(
      token,
      `https://api.github.com/repos/${owner}/${repo}/contents/shares.json`
    );
    if (res.ok) {
      const body = await res.json();
      const decoded = Buffer.from(body.content.replace(/\n/g, ""), "base64").toString(
        "utf8"
      );
      const data = JSON.parse(decoded);
      printPages(owner, repo, data.pages || []);
      return;
    }
    const dir = await githubFetch(
      token,
      `https://api.github.com/repos/${owner}/${repo}/contents/`
    );
    if (dir.ok) {
      const items = await dir.json();
      const pages = items
        .filter((item) => item.type === "dir" && !SKIP_DIR_NAMES.has(item.name))
        .map((item) => ({ slug: item.name, title: item.name }));
      printPages(owner, repo, pages);
      return;
    }
    if (dir.status === 404) {
      console.log(`仓库 https://github.com/${owner}/${repo} 还不存在，先跑 import。`);
      return;
    }
  }
  const res = await fetch(
    `https://raw.githubusercontent.com/${owner}/${repo}/main/shares.json`
  );
  if (res.ok) {
    const data = await res.json();
    printPages(owner, repo, data.pages || []);
    return;
  }
  console.log("读不到 shares.json。设置 GITHUB_TOKEN 后再执行 list。");
}

async function cmdImport({ owner, repo, token, src, slug, title, description }) {
  if (!token) {
    throw new Error("缺少 GITHUB_TOKEN / GH_TOKEN，或未 gh auth login。");
  }
  if (!src || !existsSync(src) || !existsSync(path.join(src, "index.html"))) {
    throw new Error(`--src 必须是含 index.html 的静态目录，收到：${src || "(空)"}`);
  }
  const requested =
    slug ||
    path.basename(path.resolve(src)) ||
    "share";
  const packageSlug = datedSlug(requested);
  const previousSlug = undatedSlug(packageSlug);

  await ensureRepo(token, owner, repo);
  await ensurePublic(token, owner, repo);
  const tmp = mkdtempSync(path.join(tmpdir(), "for-share-"));
  try {
    let cloned = false;
    for (let attempt = 0; attempt < 5 && !cloned; attempt += 1) {
      try {
        await cloneRepo(token, owner, repo, tmp);
        cloned = true;
      } catch {
        if (attempt === 4) break;
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
    if (!cloned) {
      mkdirSync(tmp, { recursive: true });
      run("git init -b main", { cwd: tmp });
      run(`git remote add origin https://github.com/${owner}/${repo}.git`, {
        cwd: tmp,
      });
    }

    const shares = readShares(tmp);
    const discovered = discoverPages(tmp);
    let pages = shares.pages.length ? shares.pages : discovered;
    pages = migrateUndatedPages(tmp, repo, pages);

    if (previousSlug && previousSlug !== packageSlug) {
      const oldDir = path.join(tmp, previousSlug);
      if (existsSync(oldDir)) rmSync(oldDir, { recursive: true, force: true });
      pages = pages.filter((page) => page.slug !== previousSlug);
    }

    const destDir = path.join(tmp, packageSlug);
    rmSync(destDir, { recursive: true, force: true });
    copyDir(src, destDir);
    rewriteAssetPrefix(destDir, `/${repo}/${packageSlug}`);

    pages = upsertPage(pages, {
      slug: packageSlug,
      title: headingFromSlug(packageSlug),
      description: foldHumanTitle(description, title, packageSlug),
      updated: todayStamp(),
    });
    writeBootstrapFiles(tmp, owner, repo, pages);
    if (cloned) {
      runGit(["checkout", "-B", "main"], { cwd: tmp, env: gitEnv(token) });
    }
    commitAndPush(tmp, `Publish static share page: ${packageSlug}`, token, owner, repo);
    await githubFetch(token, `https://api.github.com/repos/${owner}/${repo}`, {
      method: "PATCH",
      body: JSON.stringify({ default_branch: "main", private: false }),
    });
    try {
      await enablePages(token, owner, repo);
    } catch (error) {
      console.log(`Pages 自动开启未完成：${error.message}`);
      console.log(
        `请打开 https://github.com/${owner}/${repo}/settings/pages 选 GitHub Actions。`
      );
    }
    const url = `${PAGES_HOST(owner, repo)}/${packageSlug}/`;
    console.log(`\n已导入 ${packageSlug}`);
    console.log(url);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function cmdRefresh({ owner, repo, token }) {
  if (!token) throw new Error("缺少 GITHUB_TOKEN / GH_TOKEN，或未 gh auth login。");
  await ensureRepo(token, owner, repo);
  await ensurePublic(token, owner, repo);
  const tmp = mkdtempSync(path.join(tmpdir(), "for-share-"));
  try {
    await cloneRepo(token, owner, repo, tmp);
    const shares = readShares(tmp);
    const discovered = discoverPages(tmp);
    let pages = shares.pages.length ? shares.pages : discovered;
    const seen = new Set(pages.map((page) => page.slug));
    for (const extra of discovered) {
      if (!seen.has(extra.slug)) pages.push(extra);
    }
    pages = migrateUndatedPages(tmp, repo, pages);
    pages.sort((a, b) => a.slug.localeCompare(b.slug));
    writeBootstrapFiles(tmp, owner, repo, pages);
    runGit(["checkout", "-B", "main"], { cwd: tmp, env: gitEnv(token) });
    commitAndPush(tmp, "Refresh for-share catalog titles and dated slugs", token, owner, repo);
    console.log("\n目录已刷新");
    printPages(owner, repo, pages);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function cmdEnablePages({ owner, repo, token }) {
  if (!token) throw new Error("缺少 GITHUB_TOKEN / GH_TOKEN。");
  await ensureRepo(token, owner, repo);
  const mode = await enablePages(token, owner, repo);
  console.log(`GitHub Pages 已请求开启（${mode}）。`);
  console.log(PAGES_HOST(owner, repo) + "/");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || "list";
  const owner = args.owner || DEFAULT_OWNER;
  const repo = args.repo || DEFAULT_REPO;
  const token = tokenFromEnv();
  const ctx = { owner, repo, token };

  if (command === "list") {
    await cmdList(ctx);
    return;
  }
  if (command === "import") {
    await cmdImport({
      ...ctx,
      src: args.src,
      slug: args.slug,
      title: args.title,
      description: args.description,
    });
    return;
  }
  if (command === "refresh") {
    await cmdRefresh(ctx);
    return;
  }
  if (command === "enable-pages") {
    await cmdEnablePages(ctx);
    return;
  }
  console.error("用法: for-share.mjs <import|list|refresh|enable-pages> [--src DIR] [--slug NAME]");
  process.exit(1);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}

export { catalogHtml, datedSlug, headingFromSlug, rewriteAssetPrefix };
