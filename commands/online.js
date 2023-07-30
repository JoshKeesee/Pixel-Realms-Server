const { SlashCommandBuilder } = require("discord.js");

module.exports = {
	data: new SlashCommandBuilder()
	.setName("online")
	.setDescription("Check how many players are online"),
	async execute(c, io, players) {
		const n = players.size;
		await c.reply(`There ${n == 1 ? "is" : "are"} currently ${n} ${n == 1 ? "player" : "players"} online!`);
	},
};