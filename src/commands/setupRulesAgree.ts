import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandChannelOption,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('setup-rules-agree')
  .setDescription('ルール同意メッセージを設置します')
  .addChannelOption((option) =>
    option
      .setName('channel')
      .setDescription('設置先チャンネル（未指定ならAGREE_CHANNEL_IDを使用）')
      .setRequired(false),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  // guildIdチェック
  if (!interaction.guildId) {
    await interaction.reply({ 
      content: 'このコマンドはサーバー内でのみ使用できます', 
      ephemeral: true 
    });
    return;
  }

  // 設定取得
  const targetChannel = interaction.options.getChannel('channel') || 
    interaction.guild?.channels.cache.get(process.env.AGREE_CHANNEL_ID || '');

  if (!targetChannel || !('send' in targetChannel)) {
    await interaction.reply({ 
      content: '有効なテキストチャンネルが見つかりません。AGREE_CHANNEL_IDを確認してください。', 
      ephemeral: true 
    });
    return;
  }

  // Embed作成
  const embed = new EmbedBuilder()
    .setTitle('📜 サーバールールへの同意')
    .setDescription(
      '#rules を確認のうえ、下のボタンで同意してください\n' +
      '同意後、自動的に Member ロールが付与されます'
    )
    .setColor(0x00ff00);

  // Button作成
  const button = new ButtonBuilder()
    .setCustomId('rules_agree')
    .setLabel('✅ 同意する')
    .setStyle(ButtonStyle.Success);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

  try {
    await targetChannel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ 
      content: `✅ ${targetChannel} に同意メッセージを設置しました`, 
      ephemeral: true 
    });
  } catch (error) {
    console.error('Failed to setup rules agree message:', error);
    await interaction.reply({ 
      content: '❌ メッセージの設置に失敗しました。Botの権限を確認してください。', 
      ephemeral: true 
    });
  }
}
