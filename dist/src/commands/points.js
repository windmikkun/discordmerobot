import { SlashCommandBuilder, } from 'discord.js';
export const data = new SlashCommandBuilder()
    .setName('points')
    .setDescription('ポイント残高を表示する')
    .addUserOption((option) => option
    .setName('user')
    .setDescription('対象ユーザー（未指定なら自分）')
    .setRequired(false))
    .addStringOption((option) => option
    .setName('type')
    .setDescription('ポイント種（未指定なら全種類）')
    .setRequired(false)
    .addChoices({ name: 'メロポイント', value: 'mero' }, { name: '配信ポイント', value: 'stream' }));
export async function execute(interaction, service) {
    // guildIdチェック
    if (!interaction.guildId) {
        await interaction.reply({
            content: 'このコマンドはサーバー内でのみ使用できます',
            ephemeral: true
        });
        return;
    }
    // 対象ユーザー取得
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const typeKey = interaction.options.getString('type');
    // Service呼び出し
    const rows = await service.getBalances(interaction.guildId, targetUser.id, typeKey || undefined);
    // 残高が空の場合
    if (rows.length === 0) {
        await interaction.reply({
            content: 'まだポイントがありません',
            ephemeral: true
        });
        return;
    }
    // 残高表示整形
    const balanceLines = rows.map(row => {
        const pointName = row.typeKey === 'mero' ? 'メロポイント' :
            row.typeKey === 'stream' ? '配信ポイント' :
                row.typeKey;
        return `- ${pointName}: ${row.balance}`;
    }).join('\n');
    const message = [
        '📊 ポイント残高',
        `対象: <@${targetUser.id}>`,
        balanceLines,
    ].join('\n');
    await interaction.reply({ content: message, ephemeral: true });
}
