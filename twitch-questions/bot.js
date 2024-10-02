// /public/bot.js

const tmi = require('tmi.js');
const fs = require('fs').promises; // Use promise-based fs methods
const path = require('path');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

// Twitch channel to connect to
const channelName = 'joppavash';

// Define base log directory
const logDir = path.join(__dirname, 'logs');

// Initialize Express server
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files (HTML/CSS)
app.use(express.static(path.join(__dirname, 'public')));

// In-memory stores with limits
let chatStore = [];
let questionsStore = [];
const MAX_STORE_SIZE = 200;

// Helper function to limit memory to the last 200 entries
function limitStore(store) {
    if (store.length > MAX_STORE_SIZE) {
        store.splice(0, store.length - MAX_STORE_SIZE); // Remove older items if over limit
    }
}

// Function to get current date in YYYY-MM-DD format
function getCurrentDate() {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD
}

// Asynchronously ensure directories exist
async function ensureDirectories() {
    try {
        await fs.mkdir(logDir, { recursive: true });
        const dateDir = path.join(logDir, getCurrentDate());
        await fs.mkdir(dateDir, { recursive: true });
        return dateDir;
    } catch (error) {
        console.error(`Error creating directories: ${error.message}`);
        process.exit(1); // Exit the application if directories cannot be created
    }
}

// Asynchronously initialize log file paths
async function initializeLogPaths() {
    const dateDir = await ensureDirectories();
    const chatLogPath = path.join(dateDir, 'chat_log.txt');
    const questionsLogPath = path.join(dateDir, 'questions.txt');
    return { chatLogPath, questionsLogPath };
}

// Initialize log paths
let chatLogPath, questionsLogPath;
initializeLogPaths().then(paths => {
    chatLogPath = paths.chatLogPath;
    questionsLogPath = paths.questionsLogPath;
}).catch(error => {
    console.error(`Failed to initialize log paths: ${error.message}`);
    process.exit(1);
});

// Set up options to connect anonymously
const client = new tmi.Client({
    options: {
        debug: true,
        messagesLogLevel: 'info' // Ensure you're logging messages for debugging purposes
    },
    connection: {
        reconnect: true,          // Enable automatic reconnection
        secure: true,             // Use secure WebSocket connection (WSS)
        maxReconnectAttempts: 10, // Maximum number of reconnection attempts
        maxReconnectInterval: 30000, // Max interval between reconnect attempts (30 seconds)
        keepAlive: true,          // Enable TMI.js built-in keep-alive mechanism (ping/pong)
        keepAliveInterval: 30000, // Set the ping/pong interval to 30 seconds
    },
    channels: [channelName]       // The channel to join
});

// Attach message listeners
async function attachListeners() {
    client.on('message', async (channel, tags, message, self) => {
        if (self) return; // Ignore messages from the bot itself

        const displayName = tags['display-name'] || tags['username'];
        const logMessage = `[${channel}] ${displayName}: ${message}`;
        console.log(logMessage);

        // Append the message to chat_log.txt asynchronously
        try {
            await fs.appendFile(chatLogPath, logMessage + '\n');
        } catch (err) {
            console.error('Error writing to chat log file:', err);
        }

        // Add the chat message to the in-memory store and limit it
        chatStore.push({ user: displayName, message: message });
        limitStore(chatStore);  // Limit to the last 200 chat messages

        // Emit the message to all connected clients for live chat display
        io.emit('newMessage', { user: displayName, message: message });

        // Check if the message contains '!question' or if it mentions the channel user
        if (message.toLowerCase().includes('!question') || message.toLowerCase().includes(`@${channelName.toLowerCase()}`)) {
            const questionLogMessage = `[${channel}] ${displayName}: ${message}`;
            try {
                await fs.appendFile(questionsLogPath, questionLogMessage + '\n');
            } catch (err) {
                console.error('Error writing to questions log file:', err);
            }

            // Add the question to the in-memory store and limit it
            questionsStore.push({ user: displayName, message: message });
            limitStore(questionsStore);  // Limit to the last 200 questions

            // Emit the question to all connected clients
            io.emit('newQuestion', { user: displayName, message: message });
        }
    });
}

// Clean up listeners before reconnecting to prevent duplication
client.on('reconnect', () => {
    console.log('Reconnecting to Twitch...');
    // No need to remove listeners here as we are using a single listener
});

// Connect to Twitch chat
client.connect().catch(err => {
    console.error('Failed to connect to Twitch:', err);
    process.exit(1); // Exit the application if connection fails
});

// Handle disconnection events explicitly
client.on('disconnected', (reason) => {
    console.log(`Disconnected from Twitch: ${reason}`);
});

// Handle errors
client.on('error', (err) => {
    console.error('TMI.js Error:', err);
});

// Initial listener attachment
attachListeners().catch(err => {
    console.error('Error attaching listeners:', err);
    process.exit(1); // Exit the application if listeners cannot be attached
});

// Real-time communication with clients
io.on('connection', (socket) => {
    console.log('New client connected');

    // Emit all previous chat messages to the newly connected client
    chatStore.forEach(chat => {
        socket.emit('newMessage', chat);
    });

    // Emit all previous questions to the newly connected client
    questionsStore.forEach(q => {
        socket.emit('newQuestion', q);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Route to serve logs
app.get('/logs', async (req, res) => {
    try {
        const folders = await fs.readdir(logDir, { withFileTypes: true });
        let logList = `<h1>All Log Files</h1><ul>`;

        // Iterate through each folder (date)
        for (const folder of folders) {
            if (folder.isDirectory()) {
                const folderName = folder.name;
                const folderPath = path.join(logDir, folderName);
                const files = await fs.readdir(folderPath);
                const txtFiles = files.filter(file => file.endsWith('.txt'));

                logList += `<li><strong>${folderName}</strong><ul>`;

                // Create links for each log file
                for (const file of txtFiles) {
                    logList += `<li><a href="/logs/${encodeURIComponent(folderName)}/${encodeURIComponent(file)}" target="_blank">${file}</a></li>`;
                }

                logList += `</ul></li>`;
            }
        }

        logList += `</ul>`;
        res.send(logList);
    } catch (err) {
        console.error('Error reading log directory:', err);
        res.status(500).send('Error reading log directory');
    }
});

// Serve individual log files securely
app.get('/logs/:date/:file', async (req, res) => {
    const { date, file } = req.params;

    // Sanitize input to prevent path traversal
    const sanitizedDate = path.basename(date);
    const sanitizedFile = path.basename(file);
    const filePath = path.join(logDir, sanitizedDate, sanitizedFile);

    try {
        // Check if the file exists and is indeed a file
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
            res.sendFile(filePath);
        } else {
            res.status(404).send('File not found');
        }
    } catch (err) {
        console.error('Error serving file:', err);
        res.status(404).send('File not found');
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
