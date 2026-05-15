import { config } from "../config.js";

export type LLMProvider = "anthropic" | "openai" | "openrouter" | "together" | "groq";

const provider = (process.env["LLM_PROVIDER"] || "openai") as LLMProvider;

console.log("[LLM-CLIENT] Using provider:", provider, "| Env:", process.env["LLM_PROVIDER"]);

interface LLMResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export async function callLLM(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
  switch (provider) {
    case "anthropic":
      return callAnthropic(prompt, systemPrompt);
    case "openai":
      return callOpenAI(prompt, systemPrompt);
    case "openrouter":
      return callOpenRouter(prompt, systemPrompt);
    case "together":
      return callTogether(prompt, systemPrompt);
    case "groq":
      return callGroq(prompt, systemPrompt);
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

async function callAnthropic(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

  const messageParams: any = {
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  };

  if (systemPrompt) {
    messageParams.system = systemPrompt;
  }

  const message = await anthropic.messages.create(messageParams);

  const text = message.content[0];
  if (text?.type !== "text") throw new Error("Unexpected response type");

  return {
    content: text.text,
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    },
  };
}

async function callOpenAI(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const model = process.env["OPENAI_MODEL"] || "gpt-4o-mini";

  console.log(`[OpenAI] Calling API with model ${model}, prompt length: ${prompt.length}`);
  const fetchStart = Date.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout

  try {
    console.log(`[OpenAI] Starting fetch at ${new Date().toISOString()} with 30s timeout`);

    const fetchPromise = fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
          { role: "user", content: prompt },
        ],
        max_tokens: 4096,
      }),
      signal: controller.signal,
    });

    const timeoutMs = 60000; // 60 second timeout for large context
    const response = await new Promise<Response>((resolve, reject) => {
      let completed = false;

      fetchPromise
        .then(r => {
          if (!completed) {
            completed = true;
            resolve(r);
          }
        })
        .catch(e => {
          if (!completed) {
            completed = true;
            reject(e);
          }
        });

      setTimeout(() => {
        if (!completed) {
          completed = true;
          controller.abort();
          reject(new Error(`OpenAI API timeout after ${timeoutMs}ms`));
        }
      }, timeoutMs);
    });

    const fetchMs = Date.now() - fetchStart;
    console.log(`[OpenAI] Response received in ${fetchMs}ms, status: ${response.status}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
    }

    const data = (await response.json()) as any;
    console.log(`[OpenAI] Response parsed, content length: ${data.choices[0].message.content.length}`);
    return {
      content: data.choices[0].message.content,
      usage: {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callOpenRouter(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const model = process.env["OPENROUTER_MODEL"] || "nvidia/nemotron-3-70b-instruct";

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "rivaleye.com",
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        { role: "user", content: prompt },
      ],
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenRouter API error: ${JSON.stringify(error)}`);
  }

  const data = (await response.json()) as any;
  return {
    content: data.choices[0].message.content,
    usage: {
      inputTokens: data.usage.prompt_tokens,
      outputTokens: data.usage.completion_tokens,
    },
  };
}

async function callTogether(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
  const apiKey = process.env["TOGETHER_API_KEY"];
  if (!apiKey) throw new Error("TOGETHER_API_KEY not set");

  const model = process.env["TOGETHER_MODEL"] || "nvidia/Nemotron-3-70B-Instruct";

  const response = await fetch("https://api.together.xyz/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        { role: "user", content: prompt },
      ],
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Together API error: ${JSON.stringify(error)}`);
  }

  const data = (await response.json()) as any;
  return {
    content: data.choices[0].message.content,
    usage: {
      inputTokens: data.usage.prompt_tokens,
      outputTokens: data.usage.completion_tokens,
    },
  };
}

async function callGroq(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const model = process.env["GROQ_MODEL"] || "llama-3.1-70b-versatile";

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        { role: "user", content: prompt },
      ],
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Groq API error: ${JSON.stringify(error)}`);
  }

  const data = (await response.json()) as any;
  return {
    content: data.choices[0].message.content,
    usage: {
      inputTokens: data.usage.prompt_tokens,
      outputTokens: data.usage.completion_tokens,
    },
  };
}
