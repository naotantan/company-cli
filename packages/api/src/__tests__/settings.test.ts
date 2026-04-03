import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';
import { getDb } from '@company/db';

// authMiddleware をモック — 認証済み状態をシミュレート
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (req: unknown, _res: unknown, next: () => void) => {
    (req as Record<string, unknown>).companyId = 'company-test-id';
    next();
  },
}));

// ──────────────────────────────────────────────────────────────
// GET /api/settings
// ──────────────────────────────────────────────────────────────
describe('GET /api/settings', () => {
  const app = createApp();
  let mockDb: ReturnType<typeof buildMockDb>;

  // 共通モックビルダー（テストごとに settings を差し替え可能）
  function buildMockDb(settingsRow: unknown[] = []) {
    return {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(settingsRow),
    };
  }

  beforeEach(() => {
    mockDb = buildMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);
  });

  it('should return 200 with defaultAgentType when settings exist', async () => {
    mockDb.limit.mockResolvedValue([{ settings: { defaultAgentType: 'claude_local' } }]);

    const res = await request(app).get('/api/settings');

    expect(res.status).toBe(200);
    expect(res.body.data.defaultAgentType).toBe('claude_local');
  });

  it('should mask anthropicApiKey and expose hasAnthropicApiKey flag', async () => {
    mockDb.limit.mockResolvedValue([{
      settings: { defaultAgentType: 'claude_api', anthropicApiKey: 'sk-ant-secret123' },
    }]);

    const res = await request(app).get('/api/settings');

    expect(res.status).toBe(200);
    // 平文キーはレスポンスに含まれないこと（セキュリティ要件）
    expect(res.body.data.anthropicApiKey).toBe('***masked***');
    expect(res.body.data.anthropicApiKey).not.toBe('sk-ant-secret123');
    expect(res.body.data.hasAnthropicApiKey).toBe(true);
  });

  it('should return hasAnthropicApiKey=false when no key is set', async () => {
    mockDb.limit.mockResolvedValue([{ settings: { defaultAgentType: 'claude_local' } }]);

    const res = await request(app).get('/api/settings');

    expect(res.status).toBe(200);
    expect(res.body.data.hasAnthropicApiKey).toBe(false);
    expect(res.body.data.anthropicApiKey).toBeNull();
  });

  it('should return empty settings object when company has no settings row', async () => {
    mockDb.limit.mockResolvedValue([]);

    const res = await request(app).get('/api/settings');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ hasAnthropicApiKey: false, anthropicApiKey: null });
  });
});

// ──────────────────────────────────────────────────────────────
// PATCH /api/settings
// ──────────────────────────────────────────────────────────────
describe('PATCH /api/settings', () => {
  const app = createApp();
  let mockDb: ReturnType<typeof buildMockDb>;

  function buildMockDb(currentSettings: Record<string, unknown> = {}) {
    return {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(currentSettings
        ? [{ settings: currentSettings }]
        : []
      ),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };
  }

  beforeEach(() => {
    mockDb = buildMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);
  });

  it('should update defaultAgentType and call DB update', async () => {
    const res = await request(app)
      .patch('/api/settings')
      .send({ defaultAgentType: 'claude_local' });

    expect(res.status).toBe(200);
    expect(res.body.data.defaultAgentType).toBe('claude_local');
    // DB更新が実際に実行されたことを確認
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalled();
  });

  it('should accept claude_api type when apiKey is provided', async () => {
    const res = await request(app)
      .patch('/api/settings')
      .send({ defaultAgentType: 'claude_api', anthropicApiKey: 'sk-ant-valid' });

    expect(res.status).toBe(200);
    expect(res.body.data.defaultAgentType).toBe('claude_api');
    // レスポンスでキーがマスクされること
    expect(res.body.data.anthropicApiKey).toBe('***masked***');
    expect(res.body.data.hasAnthropicApiKey).toBe(true);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('should return 400 for unknown agentType', async () => {
    const res = await request(app)
      .patch('/api/settings')
      .send({ defaultAgentType: 'gpt_local' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
    expect(res.body.message).toContain('defaultAgentType が無効');
    // バリデーションエラーなのでDB更新が呼ばれないこと
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('should return 400 when claude_api selected with empty apiKey', async () => {
    const res = await request(app)
      .patch('/api/settings')
      .send({ defaultAgentType: 'claude_api', anthropicApiKey: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
    expect(res.body.message).toContain('anthropicApiKey が必要');
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('should preserve existing settings when only updating one field', async () => {
    // 既存設定: claude_api + anthropicApiKey あり
    mockDb = buildMockDb({ defaultAgentType: 'claude_api', anthropicApiKey: 'sk-ant-existing' });
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    // defaultAgentType だけ変更（anthropicApiKey は変更しない）
    const res = await request(app)
      .patch('/api/settings')
      .send({ defaultAgentType: 'claude_local' });

    expect(res.status).toBe(200);
    expect(res.body.data.defaultAgentType).toBe('claude_local');
    // 既存のAPIキーが残っていること（マスク表示）
    expect(res.body.data.hasAnthropicApiKey).toBe(true);
  });

  it('should remove anthropicApiKey when explicitly cleared via claude_local switch', async () => {
    // 既存設定: claude_api + キーあり → claude_local に切り替え、キーも削除
    mockDb = buildMockDb({ defaultAgentType: 'claude_api', anthropicApiKey: 'sk-ant-old' });
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    // anthropicApiKey を空文字で明示的にクリア
    const res = await request(app)
      .patch('/api/settings')
      .send({ defaultAgentType: 'claude_local', anthropicApiKey: '' });

    // claude_local + 空キー は claude_api チェックに引っかからないため400にならない
    // （バリデーションは claude_api + 空キー の組み合わせのみ）
    expect(res.status).toBe(200);
    expect(res.body.data.hasAnthropicApiKey).toBe(false);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('should return 400 when clearing apiKey while already in claude_api mode', async () => {
    // 既存: claude_api + キーあり → キーだけ削除（agentType 指定なし）
    // → マージ後 claude_api + キーなし = 不整合状態 → 400 が返るべき
    mockDb = buildMockDb({ defaultAgentType: 'claude_api', anthropicApiKey: 'sk-ant-existing' });
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/settings')
      .send({ anthropicApiKey: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
    // DBは更新されていないこと
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('should allow PATCH with only anthropicApiKey (no agentType)', async () => {
    mockDb = buildMockDb({ defaultAgentType: 'claude_api' });
    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const res = await request(app)
      .patch('/api/settings')
      .send({ anthropicApiKey: 'sk-ant-new' });

    expect(res.status).toBe(200);
    expect(res.body.data.hasAnthropicApiKey).toBe(true);
    expect(mockDb.update).toHaveBeenCalled();
  });
});
