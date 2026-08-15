# dsh-reply-usage

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) web client plugin that appends a per-reply token-usage stat to the reply footer, right after the official run-time facts (`用时 / 首 token / tok/s`).

```
14:56 · 用时 17秒 · 首 token 3秒 · 132 tok/s · ＋ 3.1K · 缓存 100% · 上下文 41%
```

## What each stat means

- **＋ [number]** — tokens this reply actually added to the conversation context: uncached input + cache writes + generated output of the turn's final model request. Cached reads (already-present history) are excluded, so this is real growth, not total prompt size.
- **缓存 [n%]** — cache-hit share of this turn's billed input.
- **上下文 [n%]** — the occupancy the *next* request would start at if you sent an instruction right after this reply: the turn's final request prompt (which already carries the whole history) plus the reply itself, over the model's context window. This is per-reply and monotonic — useful for judging where a fork would start.

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

- `dsh` with the web profile, `@deepseek-ai/*` peer packages at `^0.1.0-rc.5` or later.

## Known limitations

- **`conversation.chat.messageMeta` slot is not yet in the published `@deepseek-ai/dsh-client-ui-conversation`.** The slot is currently a local upstream change; on an npm-only profile the plugin registers a slot the running UI does not render, so the footer stat silently does not appear. Track the upstream `messageMeta` slot or use a fork of `ui-conversation` that ships it.

## Development

```sh
pnpm install
pnpm run build   # tsc + tsdown; emits lib/index.js (node) and lib/client.js (browser)
```

## License

MIT
