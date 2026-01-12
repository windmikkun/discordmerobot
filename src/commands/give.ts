import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandIntegerOption,
  SlashCommandStringOption,
  SlashCommandUserOption,
} from 'discord.js';
import { PointsService } from '../domain/PointsService.js';

export const data = new SlashCommandBuilder()
  .setName('give')
  .setDescription('ポイントを他ユーザーに付与する')
  .addStringOption((option: SlashCommandStringOption) =>
    option
      .setName('type')
      .setDescription('ポイント種')
      .setRequired(true)
      .addChoices({ name: 'メロポイント', value: 'mero' }),
  )
  .addUserOption((option: SlashCommandUserOption) =>
    option
      .setName('to')
      .setDescription('付与先ユーザー')
      .setRequired(true),
  )
  .addIntegerOption((option: SlashCommandIntegerOption) =>
    option
      .setName('amount')
      .setDescription('付与ポイント量 (1-100)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100),
  )
  .addStringOption((option: SlashCommandStringOption) =>
    option
      .setName('message')
      .setDescription('理由 (最大200文字)')
      .setRequired(true)
      .setMaxLength(200),
  );

export async function execute(interaction: ChatInputCommandInteraction, service: PointsService) {
  if (!interaction.guildId) {
    await interaction.reply({ content: 'このコマンドはサーバー内でのみ使用できます', ephemeral: true });
    return;
  }

  const typeKey = interaction.options.getString('type', true);
  const toUser = interaction.options.getUser('to', true);
  const amount = interaction.options.getInteger('amount', true);
  const message = interaction.options.getString('message', true);

  const result = await service.give({
    guildId: interaction.guildId,
    typeKey,
    giverUserId: interaction.user.id,
    giverIsBot: interaction.user.bot,
    receiverUserId: toUser.id,
    receiverIsBot: toUser.bot,
    amount,
    message,
  });

  const successMessage = [
    '💖 ポイント付与！',
    `<@${interaction.user.id}> → <@${toUser.id}>`,
    `+${amount} ${typeKey}ポイント`,
    `「${message}」`,
  ].join('\n');

  await interaction.reply({ content: successMessage });
}
