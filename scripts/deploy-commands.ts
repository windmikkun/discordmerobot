import 'dotenv/config';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { data as giveData } from '../src/commands/give.js';
import { data as pointsData } from '../src/commands/points.js';
import { data as leaderboardData } from '../src/commands/leaderboard.js';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token) {
  throw new Error('DISCORD_TOKEN is required for command deployment.');
}

if (!clientId) {
  throw new Error('CLIENT_ID is required for command deployment.');
}

const rest = new REST({ version: '10' }).setToken(token);
const commands = [giveData, pointsData, leaderboardData].map((cmd) => cmd.toJSON());

async function main() {
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId as string, guildId), {
      body: commands,
    });
    console.log(`✅ Registered ${commands.length} commands to guild ${guildId}`);
  } else {
    await rest.put(Routes.applicationCommands(clientId as string), {
      body: commands,
    });
    console.log(
      `✅ Registered ${commands.length} global commands (propagation may take up to 1 hour).`,
    );
  }
}

main().catch((err: unknown) => {
  console.error('Failed to deploy commands:', err);
  process.exit(1);
});
