const { SlashCommandBuilder } = require("discord.js");

module.exports = {
	data: new SlashCommandBuilder()
	.setName("tp")
	.setDescription("Teleport a player")
	.addStringOption(o => o.setName("user")
		.setDescription("User to give to")
		.setRequired(true)
		.setAutocomplete(true)
	)
	.addNumberOption(o => o.setName("x")
		.setDescription("X coordinate to tp to")
		.setRequired(true)
	)
	.addNumberOption(o => o.setName("y")
		.setDescription("Y coordinate to tp to")
		.setRequired(true)
	)
	.addNumberOption(o => o.setName("scene")
		.setDescription("Scene to tp to")
		.setRequired(false)
	),
	async autocomplete(c, players) {
		const focusedValue = c.options.getFocused();
		const choices = [];
		[...players.values()].forEach((v, i) => choices[i] = v.name);
		const filtered = choices.filter(choice => choice.startsWith(focusedValue));
		await c.respond(
			filtered.map(choice => ({ name: choice, value: choice })),
		);
	},
	async execute(c, io, players) {
		const p = [...players.values()].find(p => p.name == c.options.getString("user")), x = c.options.getNumber("x"), y = c.options.getNumber("y"), scene = c.options.getNumber("scene") || p?.scene;
		if (!p || !x || !y || !scene) return await c.reply("An error occured");
		io.to(p.id).emit("tp", [x, y, scene]);
		await c.reply(`Teleported ${p.name} to (${x}, ${y}) in scene ${scene}!`);
	},
};