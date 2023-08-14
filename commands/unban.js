const { SlashCommandBuilder } = require("discord.js");

module.exports = {
	data: new SlashCommandBuilder()
	.setName("unban")
	.setDescription("Unban a player")
	.addStringOption(o => o.setName("ip")
		.setDescription("Ip to unban from game")
		.setRequired(true)
		.setAutocomplete(true)
	),
	async autocomplete(c, players, db) {
		const focusedValue = c.options.getFocused();
		const choices = [];
		const banned = db.get("banned") || [];
		banned.forEach((v, i) => choices[i] = v);
		const filtered = choices.filter(choice => choice.startsWith(focusedValue));
		await c.respond(
			filtered.map(choice => ({ name: choice, value: choice })),
		);
	},
	async execute(c, io, players, db) {
		const ip = c.options.getString("ip");
		if (!ip) return await c.reply("An error occured");
		const banned = db.get("banned") || [];
		banned.splice(banned.indexOf(ip), 1);
		db.set({ banned });
		await c.reply({ content: `Unbanned ${ip} from game.`, ephemeral: true });
	},
}