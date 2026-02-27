// api/generate.js

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end('Method not allowed');
  }

  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).end('Invalid prompt');
  }

  // 设置流式响应头
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const dashResponse = await fetch(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-turbo', // ⚡️ 最快模型
          input: {
            messages: [{ role: 'user', content: prompt }],
          },
          parameters: {
            result_format: 'message',
            stream: true,
          },
        }),
      }
    );

    if (!dashResponse.ok || !dashResponse.body) {
      throw new Error(`DashScope error: ${dashResponse.status}`);
    }

    const reader = dashResponse.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6);
          if (dataStr === '[DONE]') continue;

          try {
            const json = JSON.parse(dataStr);
            const content = json.output?.choices?.[0]?.message?.content;
            if (content) {
              res.write(content);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }

    res.end();

  } catch (error) {
    console.error('Streaming error:', error);
    if (!res.writableEnded) {
      res.status(500).end('Internal Server Error');
    }
  }
}
