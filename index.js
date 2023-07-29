const express = require("express");
const app = express();
const server = require("http").createServer(app);
const port = process.env.PORT || 3000;
const io = require("socket.io")(server, { cors: { origin: "*" } });
const randomName = require("@jkeesee/random-name");
const badWords = require("badwords-list").array;
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");
const fs = require("node:fs");
const path = require("node:path");
const { Collection, Client, GatewayIntentBits, SlashCommandBuilder } = require("discord.js");
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
});

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
	databaseURL: "https://pixelwood-default-rtdb.firebaseio.com"
});

const { getDatabase } = require("firebase-admin/database");
const db = getDatabase();
const mapRef = db.ref("map");
const playerRef = db.ref("players");

const players = new Map();
let map = [
	{
		type: "woods",
		cols: 30,
		rows: 30,
		layers: {
			ground: [],
			scenery: [],
		},
		break: {},
		structure: {},
		text: {},
		chest: {},
		teleport: {},
		entities: [],
	}
];
let daylight = 24;

function resetMap(x = 0) {
	map[x] = { type: "woods", cols: 30, rows: 30, layers: { ground: [], scenery: [] } };
	map[x].break = {};
	map[x].structure = {};
	map[x].text = {};
	map[x].chest = {};
	map[x].teleport = {};
	map[x].entities = [];
	for (let i = 0; i < map[x].cols * map[x].rows; i++) {
		map[x].layers.ground[i] = 0;
		map[x].layers.scenery[i] = -1;
	}

	for (let i = 0; i < map[x].cols; i++) {
		map[x].layers.scenery[i] = 53;
		map[x].layers.scenery[map[x].layers.scenery.length - 1 - i] = 53;
	}

	for (let i = 1; i < map[x].rows; i++) {
		map[x].layers.scenery[i * map[x].cols] = 53;
		map[x].layers.scenery[(i * map[x].cols) - 1] = 53;
	}
}

function defaultPlayer(id) {
	return {
		x: 160,
		y: 80,
		dx: 160,
		dy: 80,
		frame: 0,
		dir: 0,
		rotate: 0,
		zKey: false,
		headColor: "white",
		bodyColor: "red",
		legColor: "blue",
		headArmor: -1,
		bodyArmor: -1,
		legArmor: -1,
		editor: false,
		name: randomName(),
		profile: "images/profile/default.png",
		i: [-1, -1, -1, -1, -1, -1, -1, -1, -1],
		b: [
			-1, -1, -1, -1, -1, -1, -1, -1,
			-1, -1, -1, -1, -1, -1, -1, -1,
			-1, -1, -1, -1, -1, -1, -1, -1,
			-1, -1, -1, -1, -1, -1, -1, -1,
		],
		holding: 0,
		scene: 7,
		id,
		chest: false,
		bed: false,
		minecart: false,
		health: 100,
		hunger: 120,
		cooldown: 0,
		respawnX: 160,
		respawnY: 80,
		respawnScene: 7,
		mouse: {
			x: 0,
			y: 0,
			w: 0,
			h: 0,
			click: false,
		},
		cx: 0,
		cy: 0,
	}
}

mapRef.on("value", snapshot => {
	if (snapshot.val() != null) map = snapshot.val();
	else resetMap();
	map = Object.values(map);
	map.forEach((m, i) => {
		if (!m.break) m.break = {};
		if (!m.structure) m.structure = {};
		if (!m.text) m.text = {};
		if (!m.chest) m.chest = {};
		if (!m.teleport) m.teleport = {};
		if (!m.entities) m.entities = [];
		io.emit("update map", [m, i])
	});
	mapRef.off();
});
setInterval(() => map.forEach((m, i) => mapRef.child(i).set(m)), 60000);

io.on("connection", socket => {
	players.set(socket.id, defaultPlayer(socket.id));

	socket.emit("update daylight", daylight);
	map.forEach((m, i) => socket.emit("update map", [m, i]));
	socket.emit("init players", Object.fromEntries(players));
	socket.broadcast.emit("update player", players.get(socket.id));

	socket.on("google user", data => {
		if (!data) return;
		socket.user = data;
		playerRef.child(socket.user.id).on("value", snapshot => {
			const p = snapshot.val() || players.get(socket.id);
			p.name = socket.user.name;
			p.profile = socket.user.profile;
			p.id = socket.id;
			players.set(socket.id, p);
			socket.emit("user", p);
			socket.broadcast.emit("update player", players.get(socket.id));
			playerRef.child(socket.user.id).off();
		});
	});

	socket.on("google logout", () => {
		if (!socket.user) return;
		playerRef.child(socket.user.id).set(players.get(socket.id));
		delete socket.user;
		players.set(socket.id, defaultPlayer(socket.id));
		socket.emit("user", defaultPlayer(socket.id));
		socket.broadcast.emit("update player", players.get(socket.id));
	});

	socket.on("give item", ([id, item, amount]) => socket.to(id).emit("give item", [item, amount]));
	socket.on("tp", ([id, x, y, scene]) => socket.to(id).emit("tp", [x, y, scene]));
	socket.on("clear inventory", id => socket.to(id).emit("clear inventory"));
	socket.on("clear backpack", id => socket.to(id).emit("clear backpack"));
	socket.on("update daylight", time => {
		daylight = time;
		socket.broadcast.emit("update daylight", daylight);
	});

	socket.on("update map", d => {
		if (!d) return;
		map[d[1]] = d[0];
		socket.broadcast.emit("update map", d);
	});

	socket.on("update break", d => {
		if (!d) return;
		if (d[0] < 0) delete map[d[1]].break[d[2]];
		else map[d[1]].break[d[2]] = d[0];
		socket.broadcast.emit("update break", d);
	});

	socket.on("delete map", s => {
		if (s < 0) return;
		map.splice(s, 1);
		socket.broadcast.emit("delete map", s);
	});

	socket.on("update entity", data => {
		map[players.get(socket.id).scene].entities[data[1]] = data[0];
		socket.broadcast.emit("update entity", [...data, players.get(socket.id).scene]);
	});

	socket.on("remove entity", data => {
		map[players.get(socket.id).scene].entities.splice(data, 1);
		socket.broadcast.emit("remove entity", [data, players.get(socket.id).scene]);
	});

	socket.on("update player", changes => {
		if (!changes) return;
		const p = players.get(socket.id);
		Object.keys(changes).forEach(k => p[k] = changes[k]);
		players.set(socket.id, p);
		socket.broadcast.emit("update player", { ...changes, id: socket.id });
	});

	socket.on("disconnect", () => {
		if (socket.user) playerRef.child(socket.user.id).set(players.get(socket.id));
		players.delete(socket.id);
		io.emit("remove player", socket.id);
	});

	socket.on("chat message", m => {
		if (!m) return;
		io.emit("chat message", {
			message: m.replace(new RegExp("\\b" + badWords.join("|") + "\\b", "gi"), "****"),
			name: players.get(socket.id).name,
		});
	});
});

client.invites = {};
client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
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
	if (!c.isChatInputCommand()) return;
	const command = c.client.commands.get(c.commandName);

	if (!command) return console.error(`No command matching ${c.commandName} was found.`);

	try {
		await command.execute(c, io, players);
	} catch (error) {
		console.error(error);
		if (c.replied || c.deferred) {
			await c.followUp({ content: "There was an error while executing this command!", ephemeral: true });
		} else {
			await c.reply({ content: "There was an error while executing this command!", ephemeral: true });
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

const gameLoop = () => {
	setTimeout(gameLoop, 24 * 60000 / 24);
	let sleeping = 0;
	players.forEach(p => (p.id != "offline" && p.bed) ? sleeping++ : "");
	daylight++;
	if (daylight >= 24 || (sleeping == players.size && sleeping > 0)) daylight = 0;
	map.forEach(m => {
		if (m.entities.length == 0) return;
		m.entities.forEach(e => {
			let moving = false;
			players.forEach(p => (p.minecart == m.entities.indexOf(e)) ? moving = true : "");
			if (!moving && e.id != 2) {
				e.x = e.dx;
				e.y = e.dy;
				e.moving = false;
				io.emit("update entity", [e, m.entities.indexOf(e), map.indexOf(m)]);
			}
			if (e.type == "arrow" && !players.get(e.from) || (!e.x || !e.y)) {
				io.emit("remove entity", [m.entities.indexOf(e), map.indexOf(m)]);
				m.entities.splice(m.entities.indexOf(e), 1);
			}
		});
	});
	io.emit("update daylight", daylight);
}

gameLoop();

server.listen(port, () => console.log(`Server listening on port ${port}`));