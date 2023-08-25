const unpackArray = array => {
	if (!array) return;
	const unpacked = [];
	let i, j;
	for (i = 0; i < array.length; i++) {
		const entry = array[i].split("x");
		const id = Number(entry[0]);
		for (j = 0; j < entry[1]; j++) unpacked.push(id);
	}
	return unpacked;
};

module.exports = m => {
	const map = m;
	m.forEach((s, i) => {
		Object.keys(s.layers).forEach(k => {
			const l = s.layers[k];
			if (l.every(b => typeof b == "number")) return;
			map[i].layers[k] = unpackArray(l);
		});
	});
	return map;
};