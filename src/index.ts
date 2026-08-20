/**
 * dsh-reply-usage, node half. Pure UI client plugin: the empty apply exists so
 * the plugin appears in the host cordis.yml / Loader; the browser half ships
 * via exports["./client"], discovered through the package.json dsh.client
 * declaration.
 *
 * The per-turn usage fold lives CLIENT-side (src/client/reply-usage-node.ts):
 * the conversation engine replays the full session log, so folds are complete
 * and stable across host restarts / plugin reloads — the previous host-side
 * in-memory fold only witnessed live `session/event` publications and lost
 * every step that predated the plugin (re)load.
 */

/** Host plugin body — no host-side behavior for this surface plugin. */
export function apply(): void {}
