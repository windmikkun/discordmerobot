import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandUserOption,
  SlashCommandIntegerOption,
  SlashCommandStringOption,
} from 'discord.js';
import { PointsRepository } from '../infra/PointsRepository.js';
import { randomUUID } from 'node:crypto';

export const data = new SlashCommandBuilder()
  .setName('tip')
  .setDescription('配信者に投げ銭を送ります')
  .addUserOption((option: SlashCommandUserOption) =>
    option
      .setName('to')
      .setDescription('投げ銭先のユーザー')
      .setRequired(true),
  )
  .addIntegerOption((option: SlashCommandIntegerOption) =>
    option
      .setName('amount')
      .setDescription('投げ銭額')
      .setRequired(true)
      .setMinValue(1),
  )
  .addStringOption((option: SlashCommandStringOption) =>
    option
      .setName('message')
      .setDescription('メッセージ（任意）')
      .setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction, repo: PointsRepository) {
  // guildIdチェック
  if (!interaction.guildId) {
    await interaction.reply({ 
      content: 'このコマンドはサーバー内でのみ使用できます', 
      ephemeral: true 
    });
    return;
  }

  try {
    const toUser = interaction.options.getUser('to', true);
    const amount = interaction.options.getInteger('amount', true);
    const message = interaction.options.getString('message') || '';

    // バリデーション
    if (interaction.user.id === toUser.id) {
      await interaction.reply({ 
        content: '自分自身に投げ銭することはできません', 
        ephemeral: true 
      });
      return;
    }

    if (toUser.bot) {
      await interaction.reply({ 
        content: 'Botに投げ銭することはできません', 
        ephemeral: true 
      });
      return;
    }

    const maxAmount = parseInt(process.env.STREAM_TIP_MAX_AMOUNT || '1000');
    if (amount > maxAmount) {
      await interaction.reply({ 
        content: `投げ銭額は${maxAmount}以下で指定してください`, 
        ephemeral: true 
      });
      return;
    }

    // 送金元の残高チェック
    const giverBalance = await repo.getBalance(interaction.guildId, interaction.user.id, 'stream');
    if (giverBalance < amount) {
      await interaction.reply({ 
        content: `配信ポイントが不足しています。残高: ${giverBalance}，必要額: ${amount}`, 
        ephemeral: true 
      });
      return;
    }

    // 同じVCチェック
    const giverMember = interaction.guild?.members.cache.get(interaction.user.id);
    const receiverMember = interaction.guild?.members.cache.get(toUser.id);

    if (!giverMember || !receiverMember) {
      await interaction.reply({ 
        content: 'ユーザー情報の取得に失敗しました', 
        ephemeral: true 
      });
      return;
    }

    const giverVoiceChannel = giverMember.voice.channel;
    const receiverVoiceChannel = receiverMember.voice.channel;

    if (!giverVoiceChannel || !receiverVoiceChannel || giverVoiceChannel.id !== receiverVoiceChannel.id) {
      await interaction.reply({ 
        content: '投げ銭するには同じボイスチャンネルにいる必要があります', 
        ephemeral: true 
      });
      return;
    }

    // 配信中チェック
    if (!receiverMember.voice.streaming) {
      await interaction.reply({ 
        content: '投げ銭先は現在配信中ではありません', 
        ephemeral: true 
      });
      return;
    }

    // 原子的にポイント移動（トランザクション）
    const txId = randomUUID();
    const timestamp = new Date().toISOString();

    await repo.runInTransaction(async (db) => {
      // トランザクション内で残高を再チェック
      const currentBalance = await repo.getBalance(interaction.guildId!, interaction.user.id, 'stream');
      if (currentBalance < amount) {
        throw new Error(`配信ポイントが不足しています。残高: ${currentBalance}，必要額: ${amount}`);
      }

      // 送金元から減算
      await repo.upsertBalance(interaction.guildId!, interaction.user.id, 'stream', -amount);

      // 送金先に加算
      await repo.upsertBalance(interaction.guildId!, toUser.id, 'stream', amount);

      // 取引ログを記録
      await repo.insertTransaction({
        id: txId,
        guildId: interaction.guildId!,
        typeKey: 'stream',
        giverUserId: interaction.user.id,
        receiverUserId: toUser.id,
        amount,
        message: message ? `TIP: ${message}` : 'TIP',
        createdAt: timestamp,
      });
    });

    // 成功メッセージ
    const successMessage = [
      '💰 投げ銭完了！',
      `<@${interaction.user.id}> → <@${toUser.id}>`,
      `${amount} 配信ポイント`,
      message ? `「${message}」` : '',
    ].filter(Boolean).join('\n');

    await interaction.reply({ content: successMessage });

    console.log(`💰 Tip completed: ${interaction.user.tag} → ${toUser.tag}, ${amount} stream points`);

  } catch (error) {
    console.error('Failed to process tip:', error);
    await interaction.reply({ 
      content: '投げ銭の処理に失敗しました', 
      ephemeral: true 
    });
  }
}
