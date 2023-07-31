const { SlashCommandBuilder } = require("discord.js");

module.exports = {
	data: new SlashCommandBuilder()
	.setName("online")
	.setDescription("Check how many players are online")
	.addBooleanOption(o => o.setName("list_names")
		.setDescription("List the online player's names")
		.setRequired(false)
	),
	async execute(c, io, players) {
		const n = players.size;
		await c.reply({ content: `There ${n == 1 ? "is" : "are"} currently ${n} ${n == 1 ? "player" : "players"} online!${c.options.getBoolean("list_names") ? " (" + [...players.values()].map(p => p.name).join(", ") + ")" : ""}`, ephemeral: true });
	},
};