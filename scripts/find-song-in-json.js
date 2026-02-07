const fs = require('fs');
const data = JSON.parse(fs.readFileSync('temp_index.json', 'utf8'));
const target = "весна пришла";
console.log(`Searching for "${target}" in ${data.length} songs...`);

data.forEach(song => {
    if (song.title.toLowerCase().includes(target)) {
        console.log(`\nFOUND: ${song.title} (ID: ${song.id})`);
        console.log("PARTS:", JSON.stringify(song.parts, null, 2));
    }
});
