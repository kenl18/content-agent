import { describe, expect, it } from "vitest";
import { AnthropicProvider } from "../../src/providers/anthropic-provider.js";
import { ProviderError } from "../../src/providers/model-provider.js";

function fakeClient(response: unknown) {
  return {
    messages: {
      create: async () => response
    }
  };
}

describe("AnthropicProvider", () => {
  it("returns the text block from a successful response", async () => {
    const provider = new AnthropicProvider({
      client: fakeClient({ content: [{ type: "text", text: '{"headline":"Hi"}' }] }) as any
    });
    const result = await provider.generate({ system: "sys", user: "usr" });
    expect(result.text).toBe('{"headline":"Hi"}');
  });

  it("throws ProviderError when the SDK call rejects", async () => {
    const client = {
      messages: {
        create: async () => {
          throw new Error("network down");
        }
      }
    };
    const provider = new AnthropicProvider({ client: client as any });
    await expect(provider.generate({ system: "sys", user: "usr" })).rejects.toBeInstanceOf(ProviderError);
  });

  it("throws ProviderError when the response has no text block", async () => {
    const provider = new AnthropicProvider({
      client: fakeClient({ content: [{ type: "tool_use" }] }) as any
    });
    await expect(provider.generate({ system: "sys", user: "usr" })).rejects.toBeInstanceOf(ProviderError);
  });

  it("defaults name and model", () => {
    const provider = new AnthropicProvider({ client: fakeClient({ content: [] }) as any });
    expect(provider.name).toBe("anthropic");
    expect(provider.model).toBe("claude-sonnet-5");
  });
});
