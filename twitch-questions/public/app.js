// /public/app.js

(function() {
    // Establish Socket.io connection
    const socket = io();

    // Local client-side storage of messages and questions for sorting
    let chatMessages = [];
    let questionMessages = [];
    let isChatDescending = true;
    let isQuestionsDescending = true;
    let isTTSEnabled = false; // TTS toggle state
    let selectedVoice = null; // Store the selected voice for TTS
    let voices = []; // Store available voices
    let currentSearchQuery = ''; // Track the active search query

    // Cache DOM elements for better performance
    const messagesDiv = document.getElementById('messages');
    const questionListDiv = document.getElementById('questionList');
    const sortChatBtn = document.getElementById('sortChatBtn');
    const sortQuestionsBtn = document.getElementById('sortQuestionsBtn');
    const ttsToggleBtn = document.getElementById('ttsToggleBtn');
    const voiceSelect = document.getElementById('voiceSelect');
    const feedbackDiv = document.getElementById('feedback');
    const searchChatInput = document.getElementById('searchChat'); // Cached search input

    /**
     * Utility function to check if a message already exists
     * @param {Array} array - Array of messages
     * @param {Object} messageData - New message data
     * @returns {Boolean} - True if message exists, else false
     */
    function messageExists(array, messageData) {
        return array.some(msg => msg.user === messageData.user && msg.message === messageData.message);
    }

    /**
     * Function to render chat messages based on current sort order and search query
     * @param {Array} messages - Array of messages to display (optional)
     * @param {String} query - Search query for highlighting (optional)
     */
    function renderMessages(messages = chatMessages, query = '') {
        messagesDiv.innerHTML = ''; // Clear current messages

        // Sort messages based on user's choice
        let sortedMessages = messages.slice();
        if (!isChatDescending) {
            sortedMessages.reverse();
        }

        if (sortedMessages.length === 0) {
            const noResults = document.createElement('div');
            noResults.classList.add('message');
            noResults.innerHTML = `<em>No messages found matching "${query}".</em>`;
            messagesDiv.appendChild(noResults);
            return;
        }

        // Create a document fragment to improve performance
        const fragment = document.createDocumentFragment();

        sortedMessages.forEach(msg => {
            const messageElement = document.createElement('div');
            messageElement.classList.add('message');

            // Highlight search terms if query is present
            let messageContent = `<strong>${msg.user}:</strong> ${msg.message}`;
            if (query) {
                const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
                messageContent = `<strong>${msg.user}:</strong> ${msg.message.replace(regex, '<mark>$1</mark>')}`;
            }

            messageElement.innerHTML = messageContent;
            fragment.appendChild(messageElement);
        });

        messagesDiv.appendChild(fragment);

        // Optionally, scroll to the latest message
        if (isChatDescending) {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
    }

    /**
     * Function to render questions based on current sort order
     */
    function renderQuestions() {
        questionListDiv.innerHTML = ''; // Clear current questions

        // Sort questions based on user's choice
        let sortedQuestions = questionMessages.slice();
        if (!isQuestionsDescending) {
            sortedQuestions.reverse();
        }

        if (sortedQuestions.length === 0) {
            const noResults = document.createElement('div');
            noResults.classList.add('question');
            noResults.innerHTML = `<em>No questions found.</em>`;
            questionListDiv.appendChild(noResults);
            return;
        }

        // Create a document fragment to improve performance
        const fragment = document.createDocumentFragment();

        sortedQuestions.forEach(q => {
            const questionElement = document.createElement('div');
            questionElement.classList.add('question');
            questionElement.innerHTML = `<strong>${q.user}:</strong> ${q.message}`;
            fragment.appendChild(questionElement);
        });

        questionListDiv.appendChild(fragment);

        // Optionally, scroll to the latest question
        if (isQuestionsDescending) {
            questionListDiv.scrollTop = questionListDiv.scrollHeight;
        }
    }

    /**
     * Function to handle text-to-speech (TTS)
     * @param {String} text - Text to be spoken
     */
    function speak(text) {
        if (isTTSEnabled && selectedVoice) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.voice = selectedVoice;
            window.speechSynthesis.speak(utterance);
        }
    }

    /**
     * Function to populate the voice select dropdown with available voices
     */
    function populateVoiceList() {
        voices = window.speechSynthesis.getVoices();
        const defaultVoiceIndex = voices.findIndex(voice => voice.name === 'Google US English');
        const selectedIndex = defaultVoiceIndex !== -1 ? defaultVoiceIndex : 0;

        voiceSelect.innerHTML = ''; // Clear current options

        voices.forEach((voice, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${voice.name} (${voice.lang})`;
            voiceSelect.appendChild(option);
        });

        // Set the selected voice to Google US English by default if available
        voiceSelect.selectedIndex = selectedIndex;
        selectedVoice = voices[selectedIndex];

        // Update selectedVoice when a new voice is chosen
        voiceSelect.addEventListener('change', (event) => {
            selectedVoice = voices[event.target.value];
        });
    }

    /**
     * Function to display feedback messages to the user
     * @param {String} message - Feedback message to display
     */
    function showFeedback(message) {
        feedbackDiv.textContent = message;
        feedbackDiv.classList.add('visible');

        // Hide the feedback message after 3 seconds
        setTimeout(() => {
            feedbackDiv.classList.remove('visible');
        }, 3000);
    }

    /**
     * Function to clean up any duplicate event listeners
     */
    function removeAllListeners() {
        socket.off('newMessage');
        socket.off('newQuestion');
    }

    /**
     * Initialize Socket.io event listeners
     */
    function initializeSocketListeners() {
        // Handle new chat messages
        socket.on('newMessage', (data) => {
            if (!messageExists(chatMessages, data)) {
                chatMessages.unshift(data); // Add new messages to the beginning of the array

                if (currentSearchQuery) {
                    // If there's an active search query, check if the new message matches
                    if (data.message.toLowerCase().includes(currentSearchQuery)) {
                        // If it matches, re-render with the filtered messages
                        const filteredMessages = chatMessages.filter(msg => msg.message.toLowerCase().includes(currentSearchQuery));
                        renderMessages(filteredMessages, currentSearchQuery);
                    }
                    // If it doesn't match, do not re-render to maintain current filtered view
                } else {
                    renderMessages(); // Re-render all messages
                }
            }
        });

        // Handle new questions
        socket.on('newQuestion', (data) => {
            if (!messageExists(questionMessages, data)) {
                questionMessages.unshift(data); // Add new questions to the beginning of the array
                renderQuestions(); // Re-render questions
                speak(`${data.user} asks: ${data.message}`); // Speak the new question if TTS is enabled
            }
        });

        // Handle connection errors
        socket.on('connect_error', (error) => {
            console.error('Connection Error:', error);
            showFeedback('Failed to connect to server.');
        });

        // Handle disconnections
        socket.on('disconnect', (reason) => {
            console.warn('Disconnected:', reason);
            showFeedback('Disconnected from server.');
        });
    }

    /**
     * Function to set up event listeners for UI controls
     */
    function setupUIControls() {
        // Event listener for toggling chat sorting
        sortChatBtn.addEventListener('click', () => {
            isChatDescending = !isChatDescending;
            sortChatBtn.innerText = `Sort Chat (${isChatDescending ? 'Descending' : 'Ascending'})`;
            renderMessages(); // Re-render messages after sorting
        });

        // Event listener for toggling questions sorting
        sortQuestionsBtn.addEventListener('click', () => {
            isQuestionsDescending = !isQuestionsDescending;
            sortQuestionsBtn.innerText = `Sort Questions (${isQuestionsDescending ? 'Descending' : 'Ascending'})`;
            renderQuestions(); // Re-render questions after sorting
        });

        // Event listener for toggling TTS
        ttsToggleBtn.addEventListener('click', () => {
            isTTSEnabled = !isTTSEnabled;
            ttsToggleBtn.innerText = isTTSEnabled ? 'Disable TTS' : 'Enable TTS';
            ttsToggleBtn.setAttribute('aria-pressed', isTTSEnabled);

            // Enable or disable the voice selection dropdown based on TTS state
            voiceSelect.disabled = !isTTSEnabled;

            // If TTS is disabled, immediately stop any ongoing speech
            if (!isTTSEnabled) {
                window.speechSynthesis.cancel();
            }

            // Provide feedback to the user
            showFeedback(isTTSEnabled ? 'TTS Enabled' : 'TTS Disabled');
        });

        // Event listener for search input (with debounce)
        searchChatInput.addEventListener('input', debounce(handleSearch, 300));
    }

    /**
     * Function to handle search input and filter messages
     */
    function handleSearch(event) {
        currentSearchQuery = event.target.value.toLowerCase().trim();
        if (currentSearchQuery === '') {
            // If search query is empty, display all messages
            renderMessages();
            return;
        }

        // Filter messages that include the search query
        const filteredMessages = chatMessages.filter(msg => msg.message.toLowerCase().includes(currentSearchQuery));
        renderMessages(filteredMessages, currentSearchQuery); // Pass query for highlighting
    }

    /**
     * Debounce function to limit the rate at which a function can fire.
     * @param {Function} func - Function to debounce
     * @param {Number} wait - Delay in milliseconds
     * @returns {Function} - Debounced function
     */
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Escape RegExp special characters in a string
     * @param {String} string - The string to escape
     * @returns {String} - The escaped string
     */
    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Initialize the application
     */
    function init() {
        // Populate the voice list
        populateVoiceList();

        // Initialize Socket.io listeners
        initializeSocketListeners();

        // Set up UI controls
        setupUIControls();

        // Ensure TTS is disabled on load by canceling any ongoing speech
        window.speechSynthesis.cancel();

        // Disable voiceSelect initially
        voiceSelect.disabled = true;

        // Handle voices loaded after speechSynthesis API is ready
        if (voices.length === 0) {
            window.speechSynthesis.onvoiceschanged = populateVoiceList;
        }
    }

    // Initialize the app when the DOM is fully loaded
    document.addEventListener('DOMContentLoaded', init);
})();
