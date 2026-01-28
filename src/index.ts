import 'dotenv/config';
import {
  ChatInputCommandInteraction,
  Client,
  Events,
  GatewayIntentBits,
  Interaction,
  ButtonInteraction,
} from 'discord.js';
import { data as giveData, execute as executeGive } from './commands/give.js';
import { data as pointsData, execute as executePoints } from './commands/points.js';
import { data as leaderboardData, execute as executeLeaderboard } from './commands/leaderboard.js';
import { data as tipData, execute as executeTip } from './commands/tip.js';
import { data as setupRulesAgreeData, execute as executeSetupRulesAgree } from './commands/setupRulesAgree.js';
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
    'setup-rules-agree': executeSetupRulesAgree,
  };

  const tipCommandMap: Record<string, TipCommandHandler> = {
    tip: executeTip,
  };

  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    // ボタン処理
    if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    Logger.debug(`📥 interaction received: /${interaction.commandName}`);

    // /tipコマンドは特別処理（repoを直接渡す）
    const tipHandler = tipCommandMap[interaction.commandName];
    if (tipHandler) {
      try {
        await tipHandler(interaction, repo);
      } catch (err) {
        Logger.error('Tip command error', err);
        await interaction.reply({ content: '内部エラーが発生しました', ephemeral: true });
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

async function handleButtonInteraction(interaction: ButtonInteraction) {
  if (interaction.customId !== 'rules_agree') return;

  // guildIdチェック
  if (!interaction.guildId || !interaction.guild || !interaction.member) {
    await interaction.reply({ 
      content: 'この操作はサーバー内でのみ使用できます', 
      ephemeral: true 
    });
    return;
  }

  try {
    const guild = interaction.guild;
    const member = interaction.member;
    const memberRoleId = process.env.MEMBER_ROLE_ID;

    if (!memberRoleId) {
      await interaction.reply({ 
        content: '❌ MEMBER_ROLE_IDが設定されていません。管理者に連絡してください。', 
        ephemeral: true 
      });
      return;
    }

    // 既にMemberロールを持っているか確認
    if (!('roles' in member) || !('cache' in member.roles)) {
      await interaction.reply({ 
        content: '❌ メンバー情報の取得に失敗しました', 
        ephemeral: true 
      });
      return;
    }

    if (member.roles.cache.has(memberRoleId)) {
      await interaction.reply({ 
        content: '✅ すでに同意済みです', 
        ephemeral: true 
      });
      return;
    }

    // Memberロールを取得
    const memberRole = guild.roles.cache.get(memberRoleId);
    if (!memberRole) {
      await interaction.reply({ 
        content: '❌ Memberロールが見つかりません。MEMBER_ROLE_IDを確認してください。', 
        ephemeral: true 
      });
      return;
    }

    // Botのロール位置チェック
    const botMember = guild.members.me;
    if (!botMember) {
      await interaction.reply({ 
        content: '❌ Botの情報が取得できません', 
        ephemeral: true 
      });
      return;
    }

    const botHighestRole = botMember.roles.highest;
    if (botHighestRole.comparePositionTo(memberRole) <= 0) {
      await interaction.reply({ 
        content: '❌ BotのロールがMemberロールより低い位置にあります。サーバー設定でBotのロールをMemberより上に配置してください。', 
        ephemeral: true 
      });
      return;
    }

    // ロール付与
    if (!('add' in member.roles)) {
      await interaction.reply({ 
        content: '❌ ロールの付与に失敗しました', 
        ephemeral: true 
      });
      return;
    }

    await member.roles.add(memberRole);
    
    await interaction.reply({ 
      content: '✅ 同意ありがとうございます。Memberロールを付与しました', 
      ephemeral: true 
    });

    const userTag = 'tag' in member.user ? member.user.tag : member.user.username;
    Logger.info(`✅ Member role assigned to ${userTag} (${member.user.id})`);

  } catch (error) {
    Logger.error('Failed to assign member role', error);
    
    let errorMessage = '❌ ロールの付与に失敗しました';
    
    if (error instanceof Error) {
      if (error.message.includes('Missing Permissions')) {
        errorMessage = '❌ Botにロール管理権限がありません。サーバー設定を確認してください。';
      } else if (error.message.includes('Missing Access')) {
        errorMessage = '❌ Botに必要な権限がありません。';
      }
    }

    await interaction.reply({ 
      content: errorMessage, 
      ephemeral: true 
    });
  }
}

  client.login(token).catch((err) => {
    console.error('Failed to login:', err);
    process.exit(1);
  });
}

startBot().catch((err) => {
  console.error('Failed to start bot:', err);
  process.exit(1);
});
