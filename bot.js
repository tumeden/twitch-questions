const tmi = require('tmi.js');
const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

// Twitch channel to connect to
const channelName = 'joppavash';

// Define base log directory
const logDir = path.join(__dirname, 'logs');

// Ensure the 'logs' folder exists, create if it doesn't
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// Function to get current date in YYYY-MM-DD format
function getCurrentDate() {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD
}

// Create today's log directory if it doesn't exist
const dateDir = path.join(logDir, getCurrentDate());
if (!fs.existsSync(dateDir)) {
    fs.mkdirSync(dateDir);
}

// Define log file paths for today's logs
const chatLogPath = path.join(dateDir, 'chat_log.txt');
const questionsLogPath = path.join(dateDir, 'questions.txt');

// Set up Express server
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files (HTML/CSS)
app.use(express.static('public'));

// Store chat and questions in memory, with limits
let chatStore = [];
let questionsStore = [];

// Helper function to limit memory to the last 200 entries
function limitStore(store, limit = 200) {
    if (store.length > limit) {
        store.splice(0, store.length - limit); // Remove older items if over limit
    }
}

// Set up options to connect anonymously
const client = new tmi.Client({
    options: {
        debug: true,
        messagesLogLevel: 'info' // Ensure you're logging messages for debugging purposes
    },
    connection: {
        reconnect: true,          // Enable automatic reconnection
        secure: true,             // Use secure WebSocket connection (WSS)
        maxReconnectInterval: 30000, // Max interval between reconnect attempts (30 seconds)
        keepAlive: true,          // Enable TMI.js built-in keep-alive mechanism (ping/pong)
        keepAliveInterval: 30000, // Set the ping/pong interval to 60 seconds (can be adjusted)
    },
    channels: [channelName]       // The channel to join
});


// Attach message listeners
function attachListeners() {
    client.on('message', (channel, tags, message, self) => {
        if (self) return; // Ignore messages from the bot itself

        // Log message to console and chat_log.txt
        const logMessage = `[${channel}] ${tags['display-name']}: ${message}`;
        console.log(logMessage);

        // Append the message to chat_log.txt
        fs.appendFile(chatLogPath, logMessage + '\n', err => {
            if (err) {
                console.error('Error writing to chat log file', err);
            }
        });

        // Add the chat message to the in-memory store and limit it
        chatStore.push({ user: tags['display-name'], message: message });
        limitStore(chatStore);  // Limit to the last 200 chat messages

        // Emit the message to all connected clients for live chat display
        io.emit('newMessage', { user: tags['display-name'], message: message });

        // If the message contains '!question', log it to questions.txt and store in memory
        if (message.toLowerCase().includes('!question')) {
            const cleanMessage = message.replace(/!question/gi, '').trim();

            // Log to questions.txt
            const questionLogMessage = `[${channel}] ${tags['display-name']}: ${cleanMessage}`;
            fs.appendFile(questionsLogPath, questionLogMessage + '\n', err => {
                if (err) {
                    console.error('Error writing to questions log file', err);
                }
            });

            // Add the question to the in-memory store and limit it
            questionsStore.push({ user: tags['display-name'], message: cleanMessage });
            limitStore(questionsStore);  // Limit to the last 200 questions

            // Emit the question to all connected clients
            io.emit('newQuestion', { user: tags['display-name'], message: cleanMessage });
        }
    });
}

// Clean up listeners before reconnecting to prevent duplication
client.on('reconnect', () => {
    console.log('Reconnecting to Twitch...');

    // Remove existing listeners to prevent duplication
    client.removeAllListeners('message');
    attachListeners(); // Reattach the message listeners
});

// Connect to Twitch chat
client.connect().catch(console.error);

// Handle disconnection events explicitly
client.on('disconnected', (reason) => {
    console.log(`Disconnected from Twitch: ${reason}`);
});

// Initial listener attachment
attachListeners();

// Handle errors
client.on('error', (err) => {
    console.error('Error occurred: ', err);
});

// New client connection logic
io.on('connection', (socket) => {
    // Emit all previous chat messages to the newly connected client
    chatStore.forEach(chat => {
        socket.emit('newMessage', chat);
    });

    // Emit all previous questions to the newly connected client
    questionsStore.forEach(q => {
        socket.emit('newQuestion', q);
    });
});

// Route to serve logs
app.get('/logs', (req, res) => {
    fs.readdir(logDir, (err, folders) => {
        if (err) {
            return res.status(500).send('Error reading log directory');
        }

        // Create a list to store the folder and file links
        let logList = `<h1>All Log Files</h1><ul>`;
        
        // Iterate through each folder (date)
        folders.forEach(folder => {
            const folderPath = path.join(logDir, folder);
            
            // Check if it's a directory
            if (fs.lstatSync(folderPath).isDirectory()) {
                logList += `<li><strong>${folder}</strong><ul>`;
                
                // Read the files in the current folder
                const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.txt'));
                
                // Create links for each log file
                files.forEach(file => {
                    logList += `<li><a href="/logs/${folder}/${file}" target="_blank">${file}</a></li>`;
                });
                
                logList += `</ul></li>`;
            }
        });

        logList += `</ul>`;
        res.send(logList);
    });
});

// Serve log files
app.get('/logs/:date/:file', (req, res) => {
    const { date, file } = req.params;
    const filePath = path.join(logDir, date, file);
    
    // Check if file exists
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('File not found');
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
