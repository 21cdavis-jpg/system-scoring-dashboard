const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const upload = multer({dest: 'uploads/'});

const db = new Database('database.db');

db.exec(`
    CREATE TABLE IF NOT EXISTS games (
        game_id INTEGER PRIMARY KEY AUTOINCREMENT,
        date Text,
        home_team Text,
        away_team Text
    );

    CREATE TABLE IF NOT EXISTS plays (
        play_id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER,
        date Text,
        period INTEGER,
        team Text,
        system Text
    );
`);


app.get('/', (req, res) => {
    res.send('Server is running');
});

app.get('/games', (req, res) => {
    const games = db.prepare('SELECT * FROM games').all();
    res.json(games);
});

app.get('/games/:id/plays', (req, res) => {
    const {id} = req.params;

    const plays = db.prepare(`
        SELECT * FROM plays
        WHERE game_id = ?
        ORDER BY period
    `).all(id);

    res.json(plays);
})

app.post('/upload-game', upload.single('file'), (req, res) => {
    console.log("UPLOAD HIT");

    if (!req.file) {
        return res.status(400).json({ error: 'No file received' });
    }

    const filePath = req.file.path;
    console.log("FILE PATH:", filePath);

    const rows = [];

    fs.createReadStream(filePath)
        .on('error', (err) => {
            console.error("STREAM ERROR:", err);
            res.status(500).json({ error: 'File read error' });
        })
        .pipe(csv())
        .on('data', (row) => {
            console.log("ROW:", row); // 👈 important
            rows.push(row);
        })
        .on('end', () => {
            console.log("CSV PARSE COMPLETE");

            res.json({
                message: 'Game uploaded successfully',
                rows: rows.length
            });
        })
        .on('error', (err) => {
            console.error("CSV ERROR:", err);
            res.status(500).json({ error: 'CSV parse error' });
        });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});