import 'dotenv/config';
import {
  ChatInputCommandInteraction,
  Client,
  Events,
  GatewayIntentBits,
  Interaction,
} from 'discord.js';
import { data as giveData, execute as executeGive } from './commands/give.js';
import { data as pointsData, execute as executePoints } from './commands/points.js';
import { data as leaderboardData, execute as executeLeaderboard } from './commands/leaderboard.js';
import { data as tipData, execute as executeTip } from './commands/tip.js';
import { initDb, getDatabasePath } from './infra/db.js';
import { PointsRepository } from './infra/PointsRepository.js';
import { PointsService } from './domain/PointsService.js';
import { StreamPointService } from './domain/StreamPointService.js';
import {
  ValidationError,
  SelfSendNotAllowedError,
  BotTargetNotAllowedError,
  PointTypeNotFoundError,
  PointTypeDisabledError,
  DailyLimitExceededError,
} from './domain/errors.js';
import { Logger } from './utils/logger.js';

const token = process.env.DISCORD_TOKEN;

if (!token) {
  throw new Error('DISCORD_TOKEN is not set. Please configure .env before starting the bot.');
}

async function startBot() {
  const db = await initDb();
  Logger.info(`📦 Database initialized at ${getDatabasePath()}`);

  // RepositoryとServiceをシングルトンで生成
  const repo = new PointsRepository(db);
  const service = new PointsService(repo);

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates, // VC状態検出のため
      GatewayIntentBits.GuildMembers,   // VCメンバー検出のため
    ],
  });

  client.once(Events.ClientReady, (c: Client<true>) => {
    Logger.info(`✅ Logged in as ${c.user.tag}`);
    
    // 配信ポイントサービス開始
    const streamService = new StreamPointService(c, repo);
    streamService.start();
  });

  // SIGINTハンドラ（Ctrl+C対策）
  process.on('SIGINT', async () => {
    try {
      await db.close();
      Logger.info('🧹 Database closed');
    } finally {
      process.exit(0);
    }
  });

  type CommandHandler = (interaction: ChatInputCommandInteraction, service: PointsService) => Promise<void>;
  type TipCommandHandler = (interaction: ChatInputCommandInteraction, repo: PointsRepository) => Promise<void>;
  
  const commandMap: Record<string, CommandHandler> = {
    give: executeGive,
    points: executePoints,
    leaderboard: executeLeaderboard,
  };

  const tipCommandMap: Record<string, TipCommandHandler> = {
    tip: executeTip,
  };

  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

    console.log(`📥 interaction received: /${interaction.commandName}`);
    Logger.debug(`📥 interaction received: /${interaction.commandName}`);
    
    // /tipコマンドは特別処理（repoを直接渡す）
    const tipHandler = tipCommandMap[interaction.commandName];
    if (tipHandler) {
      try {
        await tipHandler(interaction, repo);
      } catch (err) {
        Logger.error('Tip command error', err);
        await interaction.reply({ 
          content: '内部エラーが発生しました', 
          ephemeral: true 
        });
      }
      return;
    }

    const handler = commandMap[interaction.commandName];

    if (!handler) {
      await interaction.reply({ content: 'Unknown command', ephemeral: true });
      return;
    }

    try {
      await handler(interaction, service);
    } catch (err) {
      Logger.error('Command execution error', err);

      const safe =
        err instanceof ValidationError ||
        err instanceof SelfSendNotAllowedError ||
        err instanceof BotTargetNotAllowedError ||
        err instanceof PointTypeNotFoundError ||
        err instanceof PointTypeDisabledError ||
        err instanceof DailyLimitExceededError;

      const message = safe ? err.message : '内部エラーが発生しました';

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: message, ephemeral: true });
      } else {
        await interaction.reply({ content: message, ephemeral: true });
      }
    }
  });

  client.login(token).catch((err) => {
    console.error('Failed to login:', err);
    process.exit(1);
  });
}

startBot().catch((err) => {
  console.error('Failed to start bot:', err);
  process.exit(1);
});
