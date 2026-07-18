import Anthropic from "@anthropic-ai/sdk";
import { ProviderError, type ModelInstructions, type ModelProvider, type RawModelOutput } from "./model-provider.js";

/**
 * The `client` is injected so tests can supply a fake implementing only `messages.create`,
 * without making a real network call.
 */
export interface AnthropicProviderOptions {
  client: Pick<Anthropic, "messages">;
  model?: string;
  maxTokens?: number;
}

const DEFAULT_MODEL = "claude-sonnet-5";
const DEFAULT_MAX_TOKENS = 1024;

export class AnthropicProvider implements ModelProvider {
  readonly name = "anthropic";
  readonly model: string;
  private readonly client: Pick<Anthropic, "messages">;
  private readonly maxTokens: number;

  constructor(options: AnthropicProviderOptions) {
    this.client = options.client;
    this.model = options.model ?? DEFAULT_MODEL;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  }

  async generate(instructions: ModelInstructions): Promise<RawModelOutput> {
    let response;
    try {
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: instructions.system,
        messages: [{ role: "user", content: instructions.user }]
      });
    } catch (cause) {
      throw new ProviderError("Anthropic API call failed.", { cause });
    }

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    if (!textBlock) {
      throw new ProviderError("Anthropic response contained no text content.");
    }
    return { text: textBlock.text };
  }
}

export function createAnthropicProvider(options: {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}): AnthropicProvider {
  const client = new Anthropic({ apiKey: options.apiKey });
  return new AnthropicProvider({ client, model: options.model, maxTokens: options.maxTokens });
}
