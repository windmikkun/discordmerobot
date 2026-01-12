import 'dotenv/config';
import { Client, Events, GatewayIntentBits, } from 'discord.js';
import { execute as executeGive } from './commands/give.js';
import { execute as executePoints } from './commands/points.js';
import { execute as executeLeaderboard } from './commands/leaderboard.js';
import { initDb, getDatabasePath } from './infra/db.js';
import { PointsRepository } from './infra/PointsRepository.js';
import { PointsService } from './domain/PointsService.js';
import { ValidationError, SelfSendNotAllowedError, BotTargetNotAllowedError, PointTypeNotFoundError, PointTypeDisabledError, DailyLimitExceededError, } from './domain/errors.js';
const token = process.env.DISCORD_TOKEN;
if (!token) {
    throw new Error('DISCORD_TOKEN is not set. Please configure .env before starting the bot.');
}
async function startBot() {
    const db = await initDb();
    console.log(`📦 Database initialized at ${getDatabasePath()}`);
    // RepositoryとServiceをシングルトンで生成
    const repo = new PointsRepository(db);
    const service = new PointsService(repo);
    const client = new Client({
        intents: [GatewayIntentBits.Guilds],
    });
    client.once(Events.ClientReady, (c) => {
        console.log(`✅ Logged in as ${c.user.tag}`);
    });
    // SIGINTハンドラ（Ctrl+C対策）
    process.on('SIGINT', async () => {
        try {
            await db.close();
            console.log('🧹 Database closed');
        }
        finally {
            process.exit(0);
        }
    });
    const commandMap = {
        give: executeGive,
        points: executePoints,
        leaderboard: executeLeaderboard,
    };
    client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isChatInputCommand())
            return;
        console.log(`📥 interaction received: /${interaction.commandName}`);
        const handler = commandMap[interaction.commandName];
        if (!handler) {
            await interaction.reply({ content: 'Unknown command', ephemeral: true });
            return;
        }
        try {
            await handler(interaction, service);
        }
        catch (err) {
            console.error(err);
            const safe = err instanceof ValidationError ||
                err instanceof SelfSendNotAllowedError ||
                err instanceof BotTargetNotAllowedError ||
                err instanceof PointTypeNotFoundError ||
                err instanceof PointTypeDisabledError ||
                err instanceof DailyLimitExceededError;
            const message = safe ? err.message : '内部エラーが発生しました';
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: message, ephemeral: true });
            }
            else {
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
