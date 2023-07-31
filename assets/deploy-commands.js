const { REST, Routes } = require("discord.js");
const clientId = "1134312155622154320", token = process.env.DISCORD_ACCESS_TOKEN, guildId = "1110320214169616524";
const fs = require("node:fs");
const path = require("node:path");

const commands = [];
const commandFiles = path.join(__dirname, "../commands");

for (const file of fs.readdirSync(commandFiles)) {
	const filePath = path.join(commandFiles, file);
	const command = require(filePath);
	if ("data" in command && "execute" in command) {
		commands.push(command.data.toJSON());
	} else {
		console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
	}
}

const rest = new REST().setToken(token);

(async () => {
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		const data = await rest.put(
			Routes.applicationGuildCommands(clientId, guildId),
			{ body: commands },
		);

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		console.error(error);
	}
})();