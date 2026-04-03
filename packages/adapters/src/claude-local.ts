import { BaseAdapter, type TaskRequest, type TaskResponse, type HeartbeatResponse } from './base.js';
import { execSync, spawn } from 'child_process';

export class ClaudeLocalAdapter extends BaseAdapter {
  get name() { return 'claude_local'; }

  async heartbeat(): Promise<HeartbeatResponse> {
    try {
      execSync('claude --version', { stdio: 'pipe' });
      return { alive: true };
    } catch {
      return { alive: false };
    }
  }

  async runTask(request: TaskRequest): Promise<TaskResponse> {
    // プロンプトを stdin で渡す（シェルインジェクション対策: シェル文字列展開を使わない）
    const prompt = request.context
      ? `Context:\n${request.context}\n\nTask:\n${request.prompt}`
      : request.prompt;

    return new Promise((resolve) => {
      // spawn でシェルを介さず直接 claude を起動する
      const proc = spawn('claude', ['-p', '--allowedTools', 'none'], {
        timeout: (this.config.timeout || 120) * 1000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const stdout: string[] = [];
      const stderr: string[] = [];

      proc.stdout?.on('data', (d: Buffer) => stdout.push(d.toString()));
      proc.stderr?.on('data', (d: Buffer) => stderr.push(d.toString()));

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ taskId: request.taskId, output: stdout.join('').trim(), finishReason: 'complete' });
        } else {
          resolve({
            taskId: request.taskId,
            output: '',
            finishReason: 'error',
            error: stderr.join('').trim() || `exit code ${code}`,
          });
        }
      });

      proc.on('error', (err) => {
        resolve({ taskId: request.taskId, output: '', finishReason: 'error', error: err.message });
      });

      // stdin にプロンプトを書き込んで閉じる
      proc.stdin?.write(prompt, 'utf8');
      proc.stdin?.end();
    });
  }
}
