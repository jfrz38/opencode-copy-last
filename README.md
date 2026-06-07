# Opencode Copy Last

Copy the last agent, user, or user-agent pair messages from the current OpenCode session.

The npm package lives in `copy-last/` to keep the repository root focused on project-level docs and planning.

## Install

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-copy-last"]
}
```

Restart OpenCode after changing plugin configuration.

## Command

Create `.opencode/commands/copy-last.md` in a project, or `~/.config/opencode/commands/copy-last.md` globally:

```markdown
---
description: Copy recent session messages to the clipboard
---

OPENCODE_COPY_LAST_COMMAND $ARGUMENTS
```

Usage:

```text
/copy-last [agent|user|pair] [count]
```

Examples:

```text
/copy-last
/copy-last agent 2
/copy-last user
/copy-last pair 3
/copy-last me
/copy-last us 2
```

Defaults to `agent 1`. `me` maps to `user`; `us` maps to `pair`. `you` is intentionally not supported because it is ambiguous.

## Behavior

The plugin listens for OpenCode's `command.executed` event for `copy-last`, reads the current session, excludes the command message itself, formats the selected messages as Markdown, copies them to the clipboard, and shows a toast.

OpenCode currently does not expose a documented plugin API to cancel a custom command before it is submitted to the model. This plugin handles the command as early as the event stream allows and keeps the marker text isolated from copied output.

## Development

```bash
cd copy-last
pnpm install
pnpm build
pnpm test
```
