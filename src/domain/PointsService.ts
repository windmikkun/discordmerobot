import { randomUUID } from 'node:crypto';
import { PointsRepository } from '../infra/PointsRepository.js';
import { PointType, BalanceRow } from '../infra/types.js';
import {
  ValidationError,
  SelfSendNotAllowedError,
  BotTargetNotAllowedError,
  PointTypeNotFoundError,
  PointTypeDisabledError,
  DailyLimitExceededError,
} from './errors.js';
import { getTodayRangeJstIso } from '../utils/jstDate.js';

export interface GiveParams {
  guildId: string;
  typeKey: string;
  giverUserId: string;
  giverIsBot: boolean;
  receiverUserId: string;
  receiverIsBot: boolean;
  amount: number;
  message: string;
}

export interface GiveResult {
  newBalance: number;
  txId: string;
}

export class PointsService {
  constructor(private repo: PointsRepository) {}

  async give(params: GiveParams): Promise<GiveResult> {
    // 1) バリデーション
    if (params.amount < 1 || params.amount > 100) {
      throw new ValidationError('amount', 'ポイント数は1〜100の範囲で指定してください');
    }
    if (params.message.length < 1 || params.message.length > 200) {
      throw new ValidationError('message', 'メッセージは1〜200文字で指定してください');
    }

    // 2) self/bot 宛チェック
    if (params.giverUserId === params.receiverUserId) {
      throw new SelfSendNotAllowedError();
    }
    if (params.receiverIsBot) {
      throw new BotTargetNotAllowedError();
    }
    if (params.giverIsBot) {
      throw new BotTargetNotAllowedError();
    }

    // 3) point_types の確認
    const pointType = await this.repo.getPointType(params.typeKey);
    if (!pointType) {
      throw new PointTypeNotFoundError(params.typeKey);
    }
    if (!pointType.isEnabled) {
      throw new PointTypeDisabledError(params.typeKey);
    }

    // 4) JST日次送信回数制限チェック
    const { fromIso, toIso } = getTodayRangeJstIso();
    const todayCount = await this.repo.countGiverTransactionsInRange(
      params.guildId,
      params.typeKey,
      params.giverUserId,
      fromIso,
      toIso
    );

    if (todayCount >= pointType.dailyLimitCount) {
      throw new DailyLimitExceededError(pointType.dailyLimitCount, todayCount);
    }

    // 5) 永続化
    const txId = randomUUID();
    const createdAt = new Date().toISOString();

    // 取引ログを先に保存（検証しやすくするため）
    await this.repo.insertTransaction({
      id: txId,
      guildId: params.guildId,
      typeKey: params.typeKey,
      giverUserId: params.giverUserId,
      receiverUserId: params.receiverUserId,
      amount: params.amount,
      message: params.message,
      createdAt,
    });

    // 残高を更新
    const newBalance = await this.repo.upsertBalance(
      params.guildId,
      params.receiverUserId,
      params.typeKey,
      params.amount
    );

    // 6) 戻り値
    return { newBalance, txId };
  }

  async getBalances(
    guildId: string,
    userId: string,
    typeKey?: string
  ): Promise<BalanceRow[]> {
    if (typeKey) {
      const balance = await this.repo.getBalance(guildId, userId, typeKey);
      if (balance > 0) {
        return [{
          guildId,
          userId,
          typeKey,
          balance,
        }];
      }
      return [];
    }

    return await this.repo.getAllBalances(guildId, userId);
  }

  async getLeaderboard(
    guildId: string,
    typeKey: string,
    limit: number = 10
  ): Promise<BalanceRow[]> {
    return await this.repo.topBalancesByType(guildId, typeKey, limit);
  }
}
