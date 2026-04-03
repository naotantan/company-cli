import Anthropic from '@anthropic-ai/sdk';
import { BaseAdapter, type AdapterConfig, type TaskRequest, type TaskResponse, type HeartbeatResponse } from './base.js';

// claude_api アダプター — Anthropic API キーを使って Claude を呼び出す（サブスク不要）
export class ClaudeApiAdapter extends BaseAdapter {
  private client: Anthropic;
  // デフォルトモデル: claude-3-5-haiku（低コスト・高速）
  private model: string;

  constructor(config: AdapterConfig) {
    super(config);
    if (!config.apiKey) {
      throw new Error('claude_api adapter requires apiKey in config');
    }
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model || 'claude-3-5-haiku-20241022';
  }

  get name() { return 'claude_api'; }

  async heartbeat(): Promise<HeartbeatResponse> {
    try {
      // モデル一覧取得で接続確認（軽量）
      const models = await this.client.models.list({ limit: 1 });
      return {
        alive: true,
        model: this.model,
        version: models.data[0]?.id,
      };
    } catch {
      return { alive: false };
    }
  }

  async runTask(request: TaskRequest): Promise<TaskResponse> {
    try {
      const userContent = request.context
        ? `Context:\n${request.context}\n\nTask:\n${request.prompt}`
        : request.prompt;

      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: request.maxTokens || 4096,
        messages: [{ role: 'user', content: userContent }],
      });

      // テキストブロックを結合して出力
      const output = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('');

      const inputTokens = message.usage.input_tokens;
      const outputTokens = message.usage.output_tokens;

      return {
        taskId: request.taskId,
        output,
        tokensUsed: inputTokens + outputTokens,
        finishReason: message.stop_reason === 'end_turn' ? 'complete' : 'max_tokens',
      };
    } catch (err) {
      return {
        taskId: request.taskId,
        output: '',
        finishReason: 'error',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
