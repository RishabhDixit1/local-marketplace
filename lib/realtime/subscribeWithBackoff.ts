import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

export type RealtimeReconnectStatus = "connecting" | "reconnecting" | "connected" | "failed";

interface SubscribeWithBackoffOptions {
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  maxRetries?: number;
  onStatus?: (status: RealtimeReconnectStatus) => void;
  logPrefix?: string;
}

const FAILED_STATES = new Set(["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"]);
const CONNECTED_STATES = new Set(["SUBSCRIBED", "JOINING"]);

export function subscribeWithBackoff(
  client: SupabaseClient,
  channelName: string,
  configureChannel: (channel: RealtimeChannel) => RealtimeChannel,
  options: SubscribeWithBackoffOptions = {},
): () => void {
  const {
    initialBackoffMs = 1000,
    maxBackoffMs = 30000,
    maxRetries = 20,
    onStatus,
    logPrefix = "[realtime]",
  } = options;

  let currentChannel: RealtimeChannel | null = null;
  let retryCount = 0;
  let destroyed = false;
  let retrying = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const log = (msg: string) => {
    if (logPrefix) console.log(`${logPrefix} ${channelName}: ${msg}`);
  };

  const cleanup = () => {
    if (destroyed) return;
    destroyed = true;
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (currentChannel) {
      void client.removeChannel(currentChannel);
      currentChannel = null;
    }
  };

  const attempt = () => {
    if (destroyed) return;

    if (retryCount > 0) {
      onStatus?.("reconnecting");
      log(`reconnecting (attempt ${retryCount})`);
    } else {
      onStatus?.("connecting");
    }

    const channel = configureChannel(client.channel(channelName));

    channel.subscribe((status) => {
      const statusStr = String(status);

      if (CONNECTED_STATES.has(statusStr)) {
        retrying = false;
        onStatus?.("connected");
        retryCount = 0;
        log(`connected (${statusStr})`);
        return;
      }

      if (FAILED_STATES.has(statusStr)) {
        if (retrying) return;
        retrying = true;

        log(`subscription failed: ${statusStr}`);
        if (retryCount >= maxRetries) {
          onStatus?.("failed");
          log(`giving up after ${maxRetries} retries`);
          cleanup();
          return;
        }

        void client.removeChannel(channel);

        const backoff = Math.min(initialBackoffMs * Math.pow(2, retryCount), maxBackoffMs);
        const jitter = backoff * 0.15 * Math.random();
        const delay = Math.round(backoff + jitter);
        retryCount += 1;
        log(`retrying in ${delay}ms`);

        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          attempt();
        }, delay);
      }
    });

    currentChannel = channel;
  };

  attempt();

  return cleanup;
}
