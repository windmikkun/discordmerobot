import { SlashCommandBuilder, } from 'discord.js';
export const data = new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('ポイントランキングを表示する')
    .addStringOption((option) => option
    .setName('type')
    .setDescription('ポイント種')
    .setRequired(false)
    .addChoices({ name: 'メロポイント', value: 'mero' }))
    .addIntegerOption((option) => option
    .setName('limit')
    .setDescription('表示件数')
    .setRequired(false)
    .setMinValue(1)
    .setMaxValue(50));
export async function execute(interaction, service) {
    // guildIdチェック
    if (!interaction.guildId) {
        await interaction.reply({
            content: 'このコマンドはサーバー内でのみ使用できます',
            ephemeral: true
        });
        return;
    }
    // パラメータ取得
    const typeKey = interaction.options.getString('type') || 'mero';
    const limit = interaction.options.getInteger('limit') || 10;
    // Service呼び出し
    const rows = await service.getLeaderboard(interaction.guildId, typeKey, limit);
    // ランキングが空の場合
    if (rows.length === 0) {
        await interaction.reply({
            content: 'まだランキングがありません',
            ephemeral: true
        });
        return;
    }
    // ランキング表示整形
    const rankingLines = rows.map((row, index) => `${index + 1}. <@${row.userId}> - ${row.balance}`).join('\n');
    const message = [
        '🏆 ポイントランキング',
        `種別: ${typeKey === 'mero' ? 'メロポイント' : typeKey}`,
        rankingLines,
    ].join('\n');
    await interaction.reply({ content: message });
}
