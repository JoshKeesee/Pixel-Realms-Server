const { SlashCommandBuilder } = require("discord.js");

module.exports = {
	data: new SlashCommandBuilder()
	.setName("time")
	.setDescription("Set the time in Pixelwood")
	.addNumberOption(o => o.setName("time")
		.setDescription("Time to set to (0-24)")
		.setRequired(true)
	),
	async execute(c, io, players) {
		io.emit("update daylight", c.options.getNumber("time"));
		await c.reply(`Set time to ${c.options.getNumber("time")}!`);
	},
};