export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end("Method not allowed");
  }

  const { prompt } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).end("Invalid or missing 'prompt'");
  }

  // 流式文本响应头
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  try {
    const dashResponse = await fetch(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
          "Content-Type": "application/json",
          "X-DashScope-SSE": "enable",
        },
        body: JSON.stringify({
          model: "qwen-turbo",
          input: {
            messages: [
              {
                role: "user",
                content: prompt,
              },
            ],
          },
          parameters: {
            result_format: "message",
            incremental_output: true,
          },
        }),
      }
    );

    // HTTP 状态非 2xx，直接按普通错误返回
    if (!dashResponse.ok) {
      const errorText = await dashResponse.text();
      return res
        .status(dashResponse.status)
        .end(errorText || "DashScope 请求失败");
    }

    if (!dashResponse.body) {
      return res.status(500).end("DashScope 无流式响应体");
    }

    const reader = dashResponse.body.getReader();
    const decoder = new TextDecoder("utf-8");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;

        const dataStr = line.slice("data:".length).trim();
        if (!dataStr || dataStr === "[DONE]") continue;

        try {
          const json = JSON.parse(dataStr);
          const choice = json.output?.choices?.[0];
          const content =
            choice?.message?.content || choice?.message?.reasoning_content;
          if (content) {
            res.write(content);
          }
        } catch {
          // 忽略单条解析错误，继续后续块
        }
      }
    }

    res.end();
  } catch (error) {
    console.error("Streaming error:", error);
    if (!res.writableEnded) {
      res.status(500).end("Internal Server Error");
    }
  }
}
