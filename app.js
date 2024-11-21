require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT;

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => console.log('Connected to MongoDB'));

// Define User Schema
const userSchema = new mongoose.Schema({
    userName: { type: String, required: true, unique: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    whatsappNumber: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    apiKey: { type: String, required: true },
    limit: { type: String, default: "unlimited" },
});

const User = mongoose.model('User', userSchema);

// Generate API Key
const generateApiKey = (username) => {
    return `ardev${crypto.randomBytes(8).toString('hex')}`;
};

// Middleware: Validate user API key
const validateUserApiKey = async (req, res, next) => {
    const { apiKey } = req.query;

    const user = await User.findOne({ apiKey });
    if (!user) {
        return res.status(403).json({ status: "false", message: "Invalid API key." });
    }

    if (user.limit !== "unlimited" && user.limit <= 0) {
        return res.status(429).json({ status: "false", message: "API request limit exceeded." });
    }

    // Reduce the limit if applicable
    if (user.limit !== "unlimited") {
        user.limit -= 1;
        await user.save();
    }

    req.user = user; // Pass user info to the next handler
    next();
};

// Endpoint: Plugin execution
app.get('/api', validateUserApiKey, async (req, res) => {
    const { plugin, query } = req.query;

    if (!plugin) {
        return res.status(400).json({
            status: "false",
            message: "Invalid or missing plugin.",
        });
    }

    try {
        // Dynamically load the plugin
        const pluginPath = `./plugins/${plugin}.js`; // Ensure plugins are in a `plugins` directory
        const pluginModule = require(pluginPath);

        if (typeof pluginModule !== 'function') {
            return res.status(500).json({
                status: "false",
                message: "Plugin is not a valid function.",
            });
        }

        // Execute the plugin with the provided query
        const result = await pluginModule(query);

        res.json({
            status: "true",
            developer: "@ARAbdulla-Dev",
            plugin,
            user: req.user.userName,
            result,
        });
    } catch (error) {
        console.error(`Error in plugin ${plugin}:`, error);
        res.status(500).json({
            status: "false",
            message: `An error occurred while processing the plugin: ${error.message}`,
        });
    }
});


// Endpoint: Manage users and API keys
app.get('/api/users', async (req, res) => {
    const { systemApiKey, username, fullName, email, whatsappNumber, password, limit } = req.query;

    if (!systemApiKey || systemApiKey !== process.env.SYSTEM_API_KEY) {
        return res.status(403).json({ status: "false", message: "Invalid system API key." });
    }

    if (!username || !fullName || !email || !whatsappNumber || !password) {
        return res.status(400).json({ status: "false", message: "Missing user details." });
    }

    // Check if the username, email, or WhatsApp number already exists
    const existingUser = await User.findOne({
        $or: [{ userName: username }, { email }, { whatsappNumber }],
    });
    if (existingUser) {
        return res.status(409).json({
            status: "false",
            message: "Username, email, or WhatsApp number already exists.",
        });
    }

    const encryptedPassword = crypto
        .createHmac('sha256', process.env.PASS_KEY)
        .update(password)
        .digest('hex');

    const newUser = new User({
        userName: username,
        fullName,
        email,
        whatsappNumber,
        password: encryptedPassword,
        apiKey: generateApiKey(username),
        limit: limit || "unlimited",
    });

    await newUser.save();

    res.json({
        status: "true",
        message: "User created successfully.",
        user: {
            userName: newUser.userName,
            fullName: newUser.fullName,
            email: newUser.email,
            whatsappNumber: newUser.whatsappNumber,
            apiKey: newUser.apiKey,
            limit: newUser.limit,
        },
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
