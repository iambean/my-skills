---
name: github-for-share
description: 把纯静态网页一键导入 iambean/for-share 的独立目录并给出 GitHub Pages 链接；也可查询已有 share page。Use when the user wants to publish/import a static site to for-share, 一键导入, list share pages, or enable GitHub Pages on https://github.com/iambean/for-share.
---

# github-for-share

把**纯静态 Web 产出物**发布到 `iambean/for-share`。每个资源包占仓库里的**一个顶层目录**（平铺，不要再套一层），GitHub Pages 地址为：

    `https://iambean.github.io/for-share/<YYYY-MM-DD>-<slug>/`

例如 `https://iambean.github.io/for-share/2026-09-01-jijian-linmo/`。

## When to use

- 用户要把 HTML/CSS/JS 静态目录「一键导入」到 GitHub
- 用户问 for-share 里**已经有哪些页面**、链接是什么
- 用户提到 `iambean/for-share`、share page、静态托管

Do not use this for server-rendered apps that still need Node 运行时。先导出静态文件（例如 `out/`），再导入。

## Modes

Run **exactly one** mode.

### `mode=import` — 一键导入

1. 确认源目录里有 `index.html`（Next 静态导出通常是项目里的 `out/`）。
2. 确定 `slug`（小写、数字、连字符，**不要**自己加日期）。若用户没给，从目录名生成。脚本会自动加上当天日期前缀，变成一个顶层目录 `YYYY-MM-DD-slug/`，不增加目录层级。若传入的 slug 已经以 `YYYY-MM-DD-` 开头，则不再重复加日期。
3. 需要 GitHub **写权限** token：`GITHUB_TOKEN` / `GH_TOKEN`，或已 `gh auth login`。
4. 执行本 skill 自带脚本（把 `SKILL_DIR` 换成 skill 所在目录）：

```bash
export GITHUB_TOKEN=...   # 若尚未登录 gh
node "$SKILL_DIR/scripts/for-share.mjs" import \
  --src /absolute/path/to/static-dir \
  --slug jijian-linmo \
  --title "页面标题" \
  --description "一句话说明"
```

实际目录和链接会是 `2026-09-01-jijian-linmo/`（日期以导入当天为准）。页面标题（`--title`）仍用人类可读文案，不必把日期写进标题。

脚本会：

- 仓库不存在时创建公开仓库 `iambean/for-share`
- 把静态文件拷到独立目录 `<YYYY-MM-DD>-<slug>/`（不覆盖其他包）
- 若仓库里已有同名的无日期目录（例如先有 `jijian-linmo/`），导入日期版时删掉旧目录，避免两份并存
- 把根路径资源改写成 `/for-share/<YYYY-MM-DD>-<slug>/...`，以便项目 Pages 子路径能打开
- 更新根目录 `shares.json` 和目录页 `index.html`
- 写入 `.github/workflows/pages.yml` 并尝试开启 GitHub Pages
- 打印页面链接

导入成功后把链接发给用户。若 Pages 环境第一次部署需要在 GitHub 上确认 `github-pages` environment，提醒用户打开仓库 Settings → Pages，Source 选 **GitHub Actions**。

### `mode=list` — 查询现有页面

```bash
node "$SKILL_DIR/scripts/for-share.mjs" list
```

把结果整理成列表发给用户，每条包含标题和完整 URL：

`https://iambean.github.io/for-share/<YYYY-MM-DD>-<slug>/`

没有 token 时脚本会读公开的 `shares.json`。

### `mode=enable-pages`

只开启（或重新请求）GitHub Pages，不上传文件：

```bash
node "$SKILL_DIR/scripts/for-share.mjs" enable-pages
```

## Rules

- 一个静态包 = 仓库里的一个顶层目录，目录名是 `YYYY-MM-DD-slug`，不要再往下套一层日期文件夹。
- 不要删掉别人的 slug 目录，除非用户明确要求覆盖**同一个**页面（含把旧的无日期目录换成日期版）。
- 默认 owner/repo 是 `iambean/for-share`。用户指定其他仓库时加 `--owner` `--repo`。
- Token 不要写进仓库，不要在日志里打印 token。

## 本页一键写入（本仓库）

在本机（有 `repo` + `workflow` 写权限）执行：

```bash
export GITHUB_TOKEN=ghp_换成你的token
bash github-for-share/write-now.sh
```

PAT：https://github.com/settings/tokens/new?scopes=repo,workflow&description=for-share-write

## Install (user-level, all agents)

在本机执行 skill 目录里的安装脚本，会复制到 Cursor / Codex / Claude 的用户 skill 路径：

```bash
bash github-for-share/install.sh
```

目标目录：

- `~/.cursor/skills/github-for-share/`
- `~/.agents/skills/github-for-share/`
- `~/.codex/skills/github-for-share/`
- `~/.claude/skills/github-for-share/`

也可把整个 `github-for-share/` 文件夹放进 `iambean/my-skills` 后 `git push`，供 Codex 全局技能包使用。
