import { Router, type Router as RouterType } from 'express';
import { getDb, companies } from '@company/db';
import { eq } from 'drizzle-orm';
import type { AgentType } from '@company/shared';

export const settingsRouter: RouterType = Router();

const VALID_AGENT_TYPES: AgentType[] = ['claude_local', 'claude_api'];

// GET /api/settings — 組織設定取得
settingsRouter.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select({ settings: companies.settings })
      .from(companies)
      .where(eq(companies.id, req.companyId!))
      .limit(1);
    const settings = rows[0]?.settings ?? {};
    // APIキーはマスク（存在確認のみ）
    const masked = {
      ...settings,
      anthropicApiKey: settings.anthropicApiKey ? '***masked***' : null,
      hasAnthropicApiKey: !!settings.anthropicApiKey,
    };
    res.json({ data: masked });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/settings — 組織設定更新
settingsRouter.patch('/', async (req, res, next) => {
  try {
    const { defaultAgentType, anthropicApiKey } = req.body as {
      defaultAgentType?: string;
      anthropicApiKey?: string;
    };

    // バリデーション
    if (defaultAgentType && !VALID_AGENT_TYPES.includes(defaultAgentType as AgentType)) {
      res.status(400).json({
        error: 'validation_failed',
        message: `defaultAgentType が無効です。有効な値: ${VALID_AGENT_TYPES.join(', ')}`,
      });
      return;
    }
    if (defaultAgentType === 'claude_api' && anthropicApiKey === '') {
      res.status(400).json({
        error: 'validation_failed',
        message: 'claude_api モードには anthropicApiKey が必要です',
      });
      return;
    }

    const db = getDb();
    // 現在の settings を取得してマージ
    const rows = await db
      .select({ settings: companies.settings })
      .from(companies)
      .where(eq(companies.id, req.companyId!))
      .limit(1);
    const current = (rows[0]?.settings ?? {}) as Record<string, unknown>;

    const updated: Record<string, unknown> = { ...current };
    if (defaultAgentType !== undefined) updated.defaultAgentType = defaultAgentType;
    // anthropicApiKey が明示的に渡された場合のみ更新（空文字は削除）
    if (anthropicApiKey !== undefined) {
      if (anthropicApiKey === '') {
        delete updated.anthropicApiKey;
      } else {
        updated.anthropicApiKey = anthropicApiKey;
      }
    }

    // マージ後の整合性チェック — claude_api なのにキーがない状態を防ぐ
    if (updated.defaultAgentType === 'claude_api' && !updated.anthropicApiKey) {
      res.status(400).json({
        error: 'validation_failed',
        message: 'claude_api モードには anthropicApiKey が必要です',
      });
      return;
    }

    await db
      .update(companies)
      .set({ settings: updated, updated_at: new Date() })
      .where(eq(companies.id, req.companyId!));

    res.json({
      data: {
        ...updated,
        anthropicApiKey: updated.anthropicApiKey ? '***masked***' : null,
        hasAnthropicApiKey: !!updated.anthropicApiKey,
      },
    });
  } catch (err) {
    next(err);
  }
});
