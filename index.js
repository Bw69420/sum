const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionsBitField } = require('discord.js');

// ===== CONFIG =====
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID; // For single-guild commands
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const MODERATOR_ROLE_IDS = process.env.MODERATOR_ROLE_IDS?.split(',') || [];

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

// ===== READY =====
client.once('ready', () => {
    console.log(`Bot is online as ${client.user.tag}`);
});

// ===== REGISTER SLASH COMMANDS =====
const commands = [
    new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a member from this server')
        .addUserOption(opt => opt.setName('target').setDescription('Member to kick').setRequired(true)),

    new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a member from this server')
        .addUserOption(opt => opt.setName('target').setDescription('Member to ban').setRequired(true)),

    new SlashCommandBuilder()
        .setName('globalkick')
        .setDescription('Kick a member from all servers the bot is in')
        .addUserOption(opt => opt.setName('target').setDescription('Member to kick').setRequired(true)),

    new SlashCommandBuilder()
        .setName('globalban')
        .setDescription('Ban a member from all servers the bot is in')
        .addUserOption(opt => opt.setName('target').setDescription('Member to ban').setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log('Slash commands synced.');
    } catch (err) {
        console.error(err);
    }
})();

// ===== INTERACTION HANDLER =====
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const memberRoles = interaction.member.roles.cache.map(r => r.id);
    const isMod = MODERATOR_ROLE_IDS.some(role => memberRoles.includes(role));

    if (!isMod) {
        return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const targetUser = interaction.options.getUser('target');

    if (!targetUser) {
        return interaction.reply({ content: 'Member not found.' });
    }

    // Helper to log actions
    const log = msg => {
        client.channels.fetch(LOG_CHANNEL_ID)
            .then(ch => ch.send(msg))
            .catch(() => {});
    };

    // ===== Single-server kick/ban =====
    const guild = interaction.guild;
    const targetMember = guild.members.cache.get(targetUser.id);

    if (interaction.commandName === 'kick') {
        if (!targetMember) return interaction.reply('Member not found.');
        try {
            await targetMember.kick();
            interaction.reply(`Kicked ${targetUser.tag}`);
            log(`${interaction.user.tag} kicked ${targetUser.tag} in ${guild.name}`);
        } catch {
            interaction.reply('Failed to kick that member.');
        }
    }

    if (interaction.commandName === 'ban') {
        if (!targetMember) return interaction.reply('Member not found.');
        try {
            await targetMember.ban({ reason: `Banned by ${interaction.user.tag}` });
            interaction.reply(`Banned ${targetUser.tag}`);
            log(`${interaction.user.tag} banned ${targetUser.tag} in ${guild.name}`);
        } catch {
            interaction.reply('Failed to ban that member.');
        }
    }

    // ===== Global kick/ban across all guilds =====
    if (interaction.commandName === 'globalkick') {
        let success = 0;
        let fail = 0;
        for (const [guildId, g] of client.guilds.cache) {
            const m = g.members.cache.get(targetUser.id);
            if (m) {
                try { await m.kick(); success++; } catch { fail++; }
            }
        }
        interaction.reply(`Global kick complete. Success: ${success}, Failed: ${fail}`);
        log(`${interaction.user.tag} globally kicked ${targetUser.tag}. Success: ${success}, Failed: ${fail}`);
    }

    if (interaction.commandName === 'globalban') {
        let success = 0;
        let fail = 0;
        for (const [guildId, g] of client.guilds.cache) {
            const m = g.members.cache.get(targetUser.id);
            if (m) {
                try { await m.ban({ reason: `Global ban by ${interaction.user.tag}` }); success++; } catch { fail++; }
            }
        }
        interaction.reply(`Global ban complete. Success: ${success}, Failed: ${fail}`);
        log(`${interaction.user.tag} globally banned ${targetUser.tag}. Success: ${success}, Failed: ${fail}`);
    }
});

// ===== LOGIN =====
client.login(TOKEN);
