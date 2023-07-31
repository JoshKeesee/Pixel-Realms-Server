const { SlashCommandBuilder } = require("discord.js");

module.exports = {
	data: new SlashCommandBuilder()
	.setName("clear")
	.setDescription("Clear a player's backpack or inventory")
	.addStringOption(o => o.setName("user")
		.setDescription("User to clear items from")
		.setRequired(true)
		.setAutocomplete(true)
	)
	.addStringOption(o => o.setName("type")
		.setDescription("Type to clear (i or b)")
		.setRequired(true)
	),
	async autocomplete(c, players) {
		const focusedValue = c.options.getFocused();
		const choices = [];
		[...players.values()].forEach((v, i) => choices[i] = v.name.replaceAll(" ", "_"));
		const filtered = choices.filter(choice => choice.startsWith(focusedValue));
		await c.respond(
			filtered.map(choice => ({ name: choice, value: choice })),
		);
	},
	async execute(c, io, players) {
		const p = [...players.values()].find(p => p.name.replace(" ", "_") == c.options.getString("user")), type = c.options.getString("type");
		if (!p || (type != "i" && type != "b")) return await c.reply("An error occured");
		io.to(p.id).emit(type == "i" ? "clear inventory" : "clear backpack");
		await c.reply({ content: `Cleared ${p.name}'s ${type == "i" ? "inventory" : "backpack"}!`, ephemeral: true });
	},
};