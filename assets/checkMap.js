const newMap = require("./newMap");

module.exports = m => {
	const map = m;
	map.forEach((m, i) => {
		const nm = newMap()[0];
		Object.keys(nm).forEach(k => (typeof map[i][k] != typeof nm[k]) ? map[i][k] = nm[k] : "");
	});
	return map;
}