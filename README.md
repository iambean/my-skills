# my-skills

Personal global skills for Codex. This repository is intentionally independent from any
single project so the skills can be reused across different workspaces.

## Structure

- `prd-review-loop/`: A structured author-reviewer loop for PRD iteration.
- `github-for-share/`: Import a static site into `iambean/for-share` as its own directory and list Pages URLs.

## Skill Summary

### `github-for-share`

Use this skill to publish a folder of static HTML/CSS/JS to
[`iambean/for-share`](https://github.com/iambean/for-share). Each package lives in its
own top-level directory. Pages URL:

`https://iambean.github.io/for-share/<slug>/`

- `mode=import`: create the repo if needed, copy `--src` into `--slug/`, enable Pages.
- `mode=list`: print existing share pages and URLs.

```text
使用 skill: github-for-share
mode=import
--src /absolute/path/to/out
--slug mac-icloud-overlay
```

Needs a GitHub token with `repo` and `workflow` (`GITHUB_TOKEN` / `GH_TOKEN`, or `gh auth login`).

### `prd-review-loop`

Use this skill when a PRD already exists and needs to go through repeated review and
revision rounds.

- `mode=review`: Read the latest PRD and produce a structured review file.
- `mode=author`: Read the PRD plus the latest review file, decide what to accept or
  reject, update the PRD version, and write a structured handling record.

The skill is designed for mixed teams of AI and human experts and emphasizes:

- explicit version tracking
- severity-based review findings
- author-side acceptance and rejection decisions
- a stable exit condition for ending the loop

## Quick Start

Typical usage:

1. Create or locate an existing PRD such as `支付体系重构PRD.md`.
2. Run the skill with `mode=review` to produce `支付体系重构PRD_审核意见.md`.
3. Run the skill with `mode=author` to update the PRD and produce
   `支付体系重构PRD_处理记录.md`.
4. Repeat the loop until the review exit standard is met.

The skill keeps the version inside the PRD body instead of encoding it in the file name.

## How To Use

Use the skill explicitly by naming the skill and passing the mode plus the PRD path.

### Review Mode

Use `mode=review` when a reviewer should read an existing PRD and write a structured
review file in the same directory.

```text
使用 skill: prd-review-loop
mode=review

请评审这个 PRD：
/absolute/path/付费体系重构PRD.md

要求：
1. 读取 PRD 当前版本号
2. 按 skill 规则输出结构化审核意见
3. 生成同目录文件：付费体系重构PRD_审核意见.md
4. 明确给出总分、是否通过、优点、问题清单、修改建议
```

### Author Mode

Use `mode=author` when the PRD author should read the latest PRD plus the latest review,
then decide what to accept, partially accept, or reject.

```text
使用 skill: prd-review-loop
mode=author

请处理下面这轮评审：
PRD: /absolute/path/付费体系重构PRD.md
Review: /absolute/path/付费体系重构PRD_审核意见.md

要求：
1. 逐条判断采纳、部分采纳、拒绝
2. 允许坚持不合理意见，但必须说明理由
3. 直接更新 PRD 正文，不保留修改痕迹
4. 更新 PRD 内版本号
5. 生成同目录文件：付费体系重构PRD_处理记录.md
```

### Example Loop

1. The author creates `付费体系重构PRD.md`.
2. A reviewer runs `mode=review`.
3. The author runs `mode=author`.
4. Another reviewer or the same reviewer runs `mode=review` again.
5. Repeat until there are no blocking `Critical` or `Major` issues and the score reaches
   the passing threshold.

### Templates

- Review template:
  `prd-review-loop/references/review-template.md`
- Author handling template:
  `prd-review-loop/references/author-template.md`

## Notes

- Keep this repository focused on reusable skills and their bundled references.
- Project-specific conventions should stay in project repositories, not here.
