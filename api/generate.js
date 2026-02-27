export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt } = req.body;

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
  model: "qwen-3",
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
  }
})
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.message || "DashScope 调用失败"
      });
    }

    const result = data.output.choices[0].message.content.trim();

    return res.status(200).json({ result });

  } catch (error) {
    return res.status(500).json({ error: "服务器错误" });
  }
}
