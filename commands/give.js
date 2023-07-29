const { SlashCommandBuilder } = require("discord.js");

module.exports = {
	data: new SlashCommandBuilder()
	.setName("give")
	.setDescription("Give a player an item")
	.addStringOption(o => o.setName("user")
		.setDescription("User to give to")
		.setRequired(true)
	)
	.addStringOption(o => o.setName("item")
		.setDescription("Item name or id")
		.setRequired(true)
	)
	.addNumberOption(o => o.setName("amount")
		.setDescription("Amount of item to give")
		.setRequired(false)
	),
	async execute(c, io, players) {
		const p = [...players.values()].find(p => p.name.replace(" ", "_") == c.options.getString("user")), item = c.options.getString("item"), amount = c.options.getNumber("amount") || 1;
		if (!p || !item || !amount) return await c.reply("An error occured");
		io.to(p.id).emit("give item", [item, amount]);
		await c.reply(`Gave ${p.name} ${amount} ${item.replaceAll("_", " ")}!`);
	},
};