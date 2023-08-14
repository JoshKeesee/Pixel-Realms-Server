const { SlashCommandBuilder } = require("discord.js");

module.exports = {
	data: new SlashCommandBuilder()
	.setName("ban")
	.setDescription("Ban a player")
	.addStringOption(o => o.setName("user")
		.setDescription("User to ban from game")
		.setRequired(true)
		.setAutocomplete(true)
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
	async execute(c, io, players, db) {
		const p = [...players.values()].find(p => p.name == c.options.getString("user"));
		if (!p) return await c.reply("An error occured");
		const ip = io.sockets.sockets.get(p.id).handshake.address;
		const banned = db.get("banned") || [];
		banned.push(ip);
		db.set({ banned });
		io.to(p.id).emit("kick");
		await c.reply({ content: `Banned ${p.name} from game.`, ephemeral: true });
	},
}