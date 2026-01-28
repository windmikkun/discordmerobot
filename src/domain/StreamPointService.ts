import { Client, Guild, VoiceChannel, GuildMember } from 'discord.js';
import { PointsRepository } from '../infra/PointsRepository.js';
import { randomUUID } from 'node:crypto';
import { Logger } from '../utils/logger.js';

interface StreamPointConfig {
  enabled: boolean;
  tickSeconds: number;
  viewerPointPerMin: number;
  streamerPointPerMin: number;
  minHumansInVc: number;
}

export class StreamPointService {
  private config: StreamPointConfig;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    private client: Client,
    private repo: PointsRepository
  ) {
    this.config = this.loadConfig();
  }

  private loadConfig(): StreamPointConfig {
    return {
      enabled: process.env.STREAM_ENABLED === 'true',
      tickSeconds: parseInt(process.env.STREAM_POINT_TICK_SECONDS || '60'),
      viewerPointPerMin: parseInt(process.env.STREAM_VIEWER_POINT_PER_MIN || '1'),
      streamerPointPerMin: parseInt(process.env.STREAM_STREAMER_POINT_PER_MIN || '2'),
      minHumansInVc: parseInt(process.env.STREAM_MIN_HUMANS_IN_VC || '2'),
    };
  }

  start(): void {
    if (!this.config.enabled) {
      Logger.info('📺 Stream points disabled');
      return;
    }

    if (this.intervalId) {
      Logger.warn('📺 Stream points already running');
      return;
    }

    Logger.info('📺 Starting stream point service...');
    Logger.debug('📺 Stream point config', this.config);

    this.intervalId = setInterval(
      () => this.processTick(),
      this.config.tickSeconds * 1000
    );
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      Logger.info('📺 Stream point service stopped');
    }
  }

  private async processTick(): Promise<void> {
    try {
      Logger.debug('📺 Processing stream point tick...');

      for (const guild of this.client.guilds.cache.values()) {
        await this.processGuild(guild);
      }

      Logger.debug('📺 Stream point tick completed');
    } catch (error) {
      Logger.error('📺 Error in stream point tick', error);
    }
  }

  private async processGuild(guild: Guild): Promise<void> {
    try {
      const voiceChannels = guild.channels.cache.filter(
        (channel): channel is VoiceChannel => channel.isVoiceBased()
      );

      for (const channel of voiceChannels.values()) {
        await this.processVoiceChannel(guild, channel);
      }
    } catch (error) {
      Logger.error(`📺 Error processing guild ${guild.id}`, error);
    }
  }

  private async processVoiceChannel(guild: Guild, channel: VoiceChannel): Promise<void> {
    try {
      // VCにいる人間ユーザーを取得
      const members = channel.members.filter(member => !member.user.bot);
      const humanCount = members.size;

      // 最小人数チェック
      if (humanCount < this.config.minHumansInVc) {
        return;
      }

      // 配信者と視聴者を判定
      const streamers: GuildMember[] = [];
      const viewers: GuildMember[] = [];

      for (const member of members.values()) {
        if (member.voice.streaming) { // VoiceState.streamingで判定
          streamers.push(member);
        } else {
          viewers.push(member);
        }
      }

      // 配信者がいない場合はスキップ
      if (streamers.length === 0) {
        return;
      }

      // ポイント付与
      await this.grantStreamPoints(guild, streamers, viewers);

    } catch (error) {
      Logger.error(`📺 Error processing voice channel ${channel.id}`, error);
    }
  }

  private async grantStreamPoints(
    guild: Guild,
    streamers: GuildMember[],
    viewers: GuildMember[]
  ): Promise<void> {
    const processedUsers = new Set<string>();

    // 配信者にポイント付与
    for (const streamer of streamers) {
      const userId = streamer.id;
      if (processedUsers.has(userId)) continue;

      try {
        await this.grantPoints(
          guild.id,
          userId,
          this.config.streamerPointPerMin,
          'STREAMING_REWARD'
        );
        processedUsers.add(userId);
        Logger.debug(`📺 Granted ${this.config.streamerPointPerMin} stream points to streamer ${streamer.user.tag}`);
      } catch (error) {
        Logger.error(`📺 Failed to grant points to streamer ${userId}`, error);
      }
    }

    // 視聴者にポイント付与
    for (const viewer of viewers) {
      const userId = viewer.id;
      if (processedUsers.has(userId)) continue;

      try {
        await this.grantPoints(
          guild.id,
          userId,
          this.config.viewerPointPerMin,
          'VIEWING_REWARD'
        );
        processedUsers.add(userId);
        Logger.debug(`📺 Granted ${this.config.viewerPointPerMin} stream points to viewer ${viewer.user.tag}`);
      } catch (error) {
        Logger.error(`📺 Failed to grant points to viewer ${userId}`, error);
      }
    }
  }

  private async grantPoints(
    guildId: string,
    userId: string,
    amount: number,
    reason: string
  ): Promise<void> {
    // 残高を加算
    await this.repo.upsertBalance(guildId, userId, 'stream', amount);

    // 取引ログを記録
    const txId = randomUUID();
    await this.repo.insertTransaction({
      id: txId,
      guildId,
      typeKey: 'stream',
      giverUserId: 'SYSTEM',
      receiverUserId: userId,
      amount,
      message: reason,
      createdAt: new Date().toISOString(),
    });
  }
}
