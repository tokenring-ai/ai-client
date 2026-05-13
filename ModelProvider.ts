import type { TokenRingService } from "@tokenring-ai/app/types";

/**
 * Abstract base class for AI model providers that manage their own lifecycle.
 *
 * Subclasses are TokenRingServices that may be enrolled with the app so that
 * `run()` is invoked by the app loop. They are responsible for keeping the
 * various model registries (chat, embedding, etc.) in sync with the provider's
 * current set of available models.
 */
export abstract class ModelProvider<TConfig = unknown> implements TokenRingService {
  abstract readonly name: string;
  abstract readonly description: string;

  /**
   * Replace the provider's configuration and resync any registered models.
   */
  abstract reconfigure(config: TConfig): Promise<void>;

  /**
   * Resolves once the provider's initial model list has been scanned and
   * registered. Safe to call before or after `run()` has started.
   */
  abstract ready(): Promise<void>;

  /**
   * Optional. Periodically scan for models until the signal is aborted.
   * Providers with static model lists may omit this method.
   */
  run?(signal: AbortSignal): Promise<void>;
}
