---
name: prd-review-loop
description: 在已有 PRD 基础上执行结构化的作者-评审迭代闭环。适用于多位专家对 PRD 进行多轮评审、修订、再评审的场景；必须显式指定 `mode=review` 或 `mode=author`。
---

# PRD Review Loop

## Trigger

Use this skill when:

- a PRD already exists
- the task is to review or iterate that PRD rather than create it from scratch
- the user wants a repeatable author-reviewer loop with explicit outputs

Do not use this skill for zero-to-one requirement discovery. Use a separate cocreation
workflow first if the PRD does not yet exist.

## Required Mode

This skill must run in exactly one mode:

- `mode=review`
- `mode=author`

If the mode is missing, ask one concise question before proceeding.

## Scope Rule

The PRD is the main document. Do not force a standalone technical design document by
default.

Add a `技术实现附录` section inside the PRD only when at least one of these is true:

- the change crosses frontend/backend or multiple services
- the change affects data models or state transitions
- the change touches payments, permissions, risk control, messaging, or migration
- the change has clear performance, stability, rollout, or rollback constraints

## Minimum PRD Checklist

When reviewing or revising, ensure the PRD covers at least:

- background and goals
- target users or roles
- scope and out-of-scope
- key flows
- business rules
- edge cases and exceptions
- acceptance criteria
- risks and open questions

## File Outputs

Assume the PRD file already exists, for example:

- `<topic>PRD.md`

This skill writes these companion files in the same directory:

- `mode=review` -> `<topic>PRD_审核意见.md`
- `mode=author` -> `<topic>PRD_处理记录.md`

Do not merge review comments or handling records into the PRD file unless the user
explicitly asks for that.

## Review Mode

In `mode=review`:

1. Read the latest PRD.
2. Identify the PRD version from the document body.
3. Score the document on a 1.0-10.0 scale with one decimal place.
4. Judge findings by severity, not by score alone.
5. Write `<topic>PRD_审核意见.md`.

The review output must contain:

- PRD file path
- PRD version read
- review round
- overall score
- pass recommendation: `通过` / `有条件通过` / `不通过`
- summary
- strong parts
- issue list
- next-step recommendation

Each issue must use this structure:

- issue id
- severity: `Critical` / `Major` / `Minor` / `Suggestion`
- section
- problem
- why it matters
- suggested revision
- blocking: `yes` / `no`

### Review Exit Standard

A PRD is considered ready to pass when all conditions are met:

- no `Critical` issues
- no unresolved blocking `Major` issues
- score >= `9.0`

Borderline pass is allowed only when:

- no `Critical` issues
- at most one `Major` issue remains
- that issue is non-blocking or already has a strong rejection rationale from the author
- score >= `8.8`

## Author Mode

In `mode=author`:

1. Read the latest PRD.
2. Read the latest review file.
3. Evaluate each issue independently.
4. Accept, partially accept, or reject each issue based on product and web engineering
   judgment.
5. Update the PRD directly without change markers.
6. Bump the version in the PRD body.
7. Write `<topic>PRD_处理记录.md`.

The handling record must contain:

- PRD version read
- review file read
- handling round
- accepted items
- partially accepted items
- rejected items
- rejection reasons
- summary of PRD changes
- new PRD version
- whether another review round is requested

### Allowed Rejection Reasons

Reject only with explicit reasoning. Valid reasons include:

- outside the current scope
- conflicts with known system constraints
- complexity cost is too high for the expected benefit
- the review comment is based on a misread of the PRD
- the concern is already covered elsewhere in the PRD

Do not reject feedback with vague wording such as "not suitable" or "not needed" without
technical or product reasoning.

## Versioning Rule

The version must live inside the PRD body, not in the file name.

Recommended bump rules:

- major structural rewrite: `v0.1 -> v0.2`
- clarification or local refinement: `v0.2 -> v0.2.1`
- release candidate quality: `v1.0-rc1`
- approved final baseline: `v1.0`

## Loop Contract

The default loop is:

1. `mode=review`
2. `mode=author`
3. `mode=review`
4. repeat until the exit standard is met

The reviewer must judge the current PRD version on its own quality, while using the latest
handling record only as context for unresolved disagreements.

## References

- `references/review-template.md`: Review output template.
- `references/author-template.md`: Author handling record template.
