# twitch-questions


# Twitch Chat Logger and Viewer for Twitch

This is a Twitch chat logger and real-time viewer that connects to a Twitch channel, logs chat messages, and provides a real-time web interface using `socket.io` and `express`. It can also log messages containing `!question` to a separate log file.

## Features

- Logs all chat messages to a file.
- Detects and logs `!question` messages separately.
- Detects and logs @ tags for the Channel owner
- Displays live chat and questions in a web interface.
- Real-time sorting options for chat and questions (ascending/descending).
- Prevents message duplication. (reduces spam)
- Text to Speech for browsers that natively support it. 
![image](https://github.com/user-attachments/assets/f54d004c-624a-4dce-af4d-839ed58751a5)

## Requirements

- **Node.js** and **npm**
- Linux or Windows environment

## Installation

Follow these steps to set up the logger on a new machine:

1. **Clone the Repository**

   ```bash
   git clone https://github.com/tumeden/twitch-questions.git
   cd twitch-questions

2. **Install Node.js and npm**

   On a Debian-based system (Ubuntu, Proxmox, etc.), install Node.js and npm:

   ```bash
   sudo apt-get update && sudo apt-get install -y nodejs npm

3. **Install Dependencies**

   Run the following command to install the required Node.js packages:

   ```bash
   npm install


4. **Run**
   ```bash
   node bot.js
