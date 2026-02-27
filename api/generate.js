export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt } = req.body;

  // 校验 prompt
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: "Invalid or missing 'prompt'" });
  }

  try {
    const response = await fetch(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.DASHSCOPE_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "qwen-max", 
          input: {
            messages: [
              {
                role: "user",
                content: prompt
              }
            ]
          },
          parameters: {
            result_format: "message"
            // 可选：添加 temperature, max_tokens 等
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("DashScope API Error:", data); // 方便调试
      return res.status(response.status).json({
        error: data.message || "DashScope 调用失败"
      });
    }

    // 安全访问嵌套属性
    const content = data?.output?.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(500).json({ error: "Unexpected response format from DashScope" });
    }

    return res.status(200).json({ result: content.trim() });

  } catch (error) {
    console.error("Server error:", error); // 建议记录日志
    return res.status(500).json({ error: "服务器内部错误" });
  }
}
