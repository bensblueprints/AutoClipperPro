// Cloud LLM provider for BBB cloud mode. Claude via the official Anthropic SDK,
// or any OpenAI-compatible endpoint (set BBB_CLOUD_PROVIDER=openai + BBB_CLOUD_BASEURL).
// Env: BBB_CLOUD_PROVIDER (anthropic|openai), BBB_CLOUD_KEY, BBB_CLOUD_MODEL, BBB_CLOUD_BASEURL
export async function complete({ system = "", text, images = [], maxTokens = 8000 }) {
  const provider = (process.env.BBB_CLOUD_PROVIDER || "anthropic").toLowerCase();
  const key = process.env.BBB_CLOUD_KEY;
  if (!key) throw new Error("BBB_CLOUD_KEY not set");

  if (provider === "anthropic") {
    const model = process.env.BBB_CLOUD_MODEL || "claude-opus-4-8";
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: key });
    const content = [];
    for (const img of images) content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: img } });
    content.push({ type: "text", text });
    const resp = await client.messages.create({
      model, max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages: [{ role: "user", content }],
    });
    return resp.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  }

  // OpenAI-compatible (OpenAI, Groq, OpenRouter, local LM Studio, etc.)
  const model = process.env.BBB_CLOUD_MODEL || "gpt-4o";
  const base = process.env.BBB_CLOUD_BASEURL || "https://api.openai.com/v1";
  const content = [];
  for (const img of images) content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${img}` } });
  content.push({ type: "text", text });
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content });
  const r = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`cloud LLM ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return (j.choices?.[0]?.message?.content || "").trim();
}
