# dsh-reply-usage

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) web client plugin that appends a per-reply token-usage stat to the reply's action row, right after the official run-time facts (`用时 / 首 token / tok/s`).

```
15:15 · 用时 2分44秒 · 首 token 6秒 · 119 tok/s · ＋ 342.7K · 缓存 92%
```

Synced with the official **deepseek-harness rc.8** client contract.

## What each stat means

- **＋ [number]** — tokens this reply actually added to the conversation context: uncached input + cache writes + generated output of the turn's final model request. Cached reads (already-present history) are excluded, so this is real growth, not total prompt size.
- **缓存 [n%]** — cache-hit share of this turn's billed input.

The badge lives inside the assistant message's action row (`conversation.chat.assistant-actions`, the additive list slot shared with feedback and `memory-footer`), styled as a continuation of the official clock label (14px tertiary text). Hovering shows the full definition.

## How it works (rc.8)

- **Host half** (`lib/index.js`) — listens to `session/event`, folds every provider-reported usage sample of one turn (each model step is a separate request; a step's provisional `assistant/chunk` usage is replaced by its final `assistant/message` sample so streaming re-reports never double count), and serves the fold over `GET /reply-usage/by-message?sessionId=..&messageId=..`.
- **Client half** (`lib/client.js`) — registers a `conversation.chat.assistant-actions` entry (`id: reply-usage`, `order: 15`); for the closing message of a turn it fetches the host route and renders the compact badge. Hidden while the fetch is pending or the turn reported nothing usable.

> Why not `conversation.chat.turnTail` / `messageMeta`? Both were the original targets, but neither is usable on rc.8: `messageMeta` was removed from the published `@deepseek-ai/dsh-client-ui-conversation`, and the `turnTail` chain is a single-winner election (first `select` hit wins) claimed by the official produced-files entry. `assistant-actions` is additive, so per-reply metadata must ride it instead.

## Install

```sh
dsh plugin --profile <name> add github:GammaChineYov/dsh-reply-usage
```

The first `add` needs the git-install build allowance — copy the package key pnpm prints into the profile's `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  dsh-reply-usage: true
```

and re-run the `add`. Pin a commit (`github:GammaChineYov/dsh-reply-usage#<sha>`) if you only want to run reviewed code.

## Requirements

- `dsh` with the web profile, `@deepseek-ai/*` peer packages at `^0.1.0-rc.5` or later (validated against rc.8).

## Development

```sh
pnpm install
pnpm run build   # tsc + tsdown; emits lib/index.js (node) and lib/client.js (browser)
```

## License

MIT
