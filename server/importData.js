const fs = require('fs');
const csv = require('csv-parser');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./sports.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS games ( game_id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, home_team TEXT, away_team TEXT , home_score INT, away_score INT)`);

    db.run(`CREATE TABLE IF NOT EXISTS possessions (
        possession_id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER,
        period INTEGER,
        team_type TEXT,
        system_sequence TEXT,
        points INTEGER,
        FOREIGN KEY(game_id) REFERENCES games(game_id)
    )`);
});

// Helper function to allow "await" with SQL
const runQuery = (query, params) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
};

const getQuery = (query, params) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const importCSV = async (filePath) => {
    const results = [];

    // 1. Read the whole file first so we have it in memory
    const stream = fs.createReadStream(filePath).pipe(csv());
    for await (const row of stream) {
        // Only add rows that actually have data (prevents the "off by 1" error)
        if (row.Date && row.Home_Team) {
            results.push(row);
        }
    }

    if (results.length === 0) return;

    console.log(`Found ${results.length} valid rows. Starting Import...`);

    try {
        const first = results[0]
        
        let hScore = 0;
        let aScore = 0;

        results.forEach(row => {
            // Adjust these keys if your CSV columns use different names for points
            hScore += parseInt(row.Home_Points) || 0;
            aScore += parseInt(row.Away_Points) || 0;
        });
        console.log(`Scores detected: Home ${hScore}, Away ${aScore}`);

        // CHECK IF GAME EXISTS
        const existing = await getQuery(
            `SELECT game_id FROM games WHERE date = ? AND home_team = ? AND away_team = ?`,
            [first.Date, first.Home_Team, first.Away_Team]
        );

        if (existing) {
            console.log(`Skipping Duplicate: ${first.Date} ${first.Home_Team} vs ${first.Away_Team}`);
            return;
        }

        console.log(`Importing New Game: ${first.Date} ${first.Home_Team} vs ${first.Away_Team}`);

   
        // 2. Insert the Game
        const gameId = await runQuery(
            `INSERT INTO games (date, home_team, away_team, home_score, away_score) VALUES (?, ?, ?, ?, ?)`, 
            [first.Date, first.Home_Team, first.Away_Team, hScore, aScore]
        );

        // 3. Insert Possessions ONE BY ONE (Ensures perfect order)
        for (const row of results) {
            // Home Possession
            await runQuery(
                `INSERT INTO possessions (game_id, period, team_type, system_sequence, points) VALUES (?, ?, ?, ?, ?)`,
                [gameId, row.Period, 'Home', row.Home_System, row.Home_Points]
            );
            // Away Possession
            await runQuery(
                `INSERT INTO possessions (game_id, period, team_type, system_sequence, points) VALUES (?, ?, ?, ?, ?)`,
                [gameId, row.Period, 'Away', row.Away_System, row.Away_Points]
            );
        }

        console.log("SUCCESS: Database is now ordered and accurate.");
    } catch (err) {
        console.error("IMPORT ERROR:", err.message);
    }
};

const path = require('path');
// MAIN EXECUTION: Loop through the raw_data folder
const processFolder = async () => {
    const directoryPath = path.join(__dirname, 'raw_data');
    if (!fs.readdirSync(directoryPath)) {
        console.error("Error: 'raw_data' folder not found!");
        return;
    }

    const files = fs.readdirSync(directoryPath);

    for (const file of files) {
        if (path.extname(file) === '.csv') {
            await importCSV(path.join(directoryPath, file));
        }
    }
    console.log("All files processed.");
};

processFolder();