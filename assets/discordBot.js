module.exports = (io, players) => {
	const fs = require("node:fs");
	const path = require("node:path");
	const discord = require("discord.js");
	const client = new discord.Client({
		intents: [
			discord.GatewayIntentBits.Guilds,
			discord.GatewayIntentBits.GuildMembers,
			discord.GatewayIntentBits.GuildMessages,
			discord.GatewayIntentBits.MessageContent,
		],
	});
	client.invites = {};
	client.commands = new discord.Collection();
	
	const commandsPath = path.join(__dirname, "../commands");
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));
	
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		
		if ("data" in command && "execute" in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
	
	client.on("ready", c => {
		console.log(`Logged in as ${c.user.tag}`);
		client.guilds.cache.each(guild => {
			guild.invites.fetch().then(guildInvites => {
				guildInvites.each(guildInvite => {
					client.invites[guildInvite.code] = guildInvite.uses;
				});
			});
		});
	});
	
	client.on("interactionCreate", async c => {
		if (c.isChatInputCommand()) {
			const command = c.client.commands.get(c.commandName);
		
			if (!command) return console.error(`No command matching ${c.commandName} was found.`);
		
			try {
				if (c.commandName == "setTime") daylight = c.options.getNumber("time");
				await command.execute(c, io, players);
			} catch (error) {
				console.error(error);
				if (c.replied || c.deferred) await c.followUp({ content: "There was an error while executing this command!", ephemeral: true });
				else await c.reply({ content: "There was an error while executing this command!", ephemeral: true });
			}
		} else if (c.isAutocomplete()) {
			const command = c.client.commands.get(c.commandName);
	
			if (!command) return console.error(`No command matching ${c.commandName} was found.`);
	
			try {
				await command.autocomplete(c, players);
			} catch (error) {
				console.error(error);
			}
		}
	});
	
	client.on("inviteCreate", c => client.invites[c.code] = c.uses);
	
	client.on("guildMemberAdd", async c => {
		const channel = c.guild.channels.cache.get("1110320214727475251");
		c.guild.invites.fetch().then(invites => {
			invites.each(invite => {
				if (invite.uses != client.invites[invite.code]) {
					channel.send(`Welcome to the server, <@${c.user.id}>!`);
					client.invites[invite.code] = invite.uses;
					if (invite.code == "VCkGgSvCrr") addRole("Player", c);
					else addRole("Member", c);
				}
			});
		});
	});
	
	client.login(process.env.DISCORD_ACCESS_TOKEN);
	
	const addRole = (name, c) => {
		const user = c.author || c.user, channel = c.channel || c.guild.channels.cache.get("1110320214727475251");
		const role = c.guild.roles.cache.find(role => role.name == name), member = c.guild.members.cache.get(user.id);
		if (!role || member.roles.cache.some(r => r == role) || user.bot || user.system) return;
		member.roles.add(role);
		channel.send(`${role.name} role given to <@${user.id}>`);
		console.log(`${role.name} role given to <@${user.id}>`);
	};
}