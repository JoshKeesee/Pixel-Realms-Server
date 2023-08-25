const packArray = array => {
	if (!array) return;
	const packed = [];
	let i, j;
	for (i = 0; i < array.length; i = j) {
		const entry = array[i];
		for (j = i + 1; array[j] == entry && j < array.length; ++j);
		packed.push(`${entry}x${j - i}`);
	}
	return packed;
};

module.exports = m => {
	const map = m;
	m.forEach((s, i) => {
		Object.keys(s.layers).forEach(k => {
			const l = s.layers[k];
			if (l.every(b => typeof b != "number")) return;
			map[i].layers[k] = packArray(l);
		});
	});
	return map;
};