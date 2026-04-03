import { BaseAdapter, type TaskRequest, type TaskResponse, type HeartbeatResponse } from './base.js';
import { execSync, spawn } from 'child_process';

export class OpencodeLocalAdapter extends BaseAdapter {
  get name() { return 'opencode_local'; }

  async heartbeat(): Promise<HeartbeatResponse> {
    try {
      execSync('opencode --version', { stdio: 'pipe' });
      return { alive: true };
    } catch {
      return { alive: false };
    }
  }

  async runTask(request: TaskRequest): Promise<TaskResponse> {
    // プロンプトを stdin で渡す（シェルインジェクション対策: echo|pipe を使わない）
    const prompt = request.context
      ? `${request.context}\n\n${request.prompt}`
      : request.prompt;

    return new Promise((resolve) => {
      const proc = spawn('opencode', ['run', '-'], {
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

      proc.stdin?.write(prompt, 'utf8');
      proc.stdin?.end();
    });
  }
}
