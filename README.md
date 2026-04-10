# my-skills

Personal global skills for Codex. This repository is intentionally independent from any
single project so the skills can be reused across different workspaces.

## Structure

- `prd-review-loop/`: A structured author-reviewer loop for PRD iteration.

## Skill Summary

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

## Notes

- Keep this repository focused on reusable skills and their bundled references.
- Project-specific conventions should stay in project repositories, not here.
