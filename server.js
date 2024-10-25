const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

// MongoDB connection (replace with your own connection string)
mongoose.connect('mongodb+srv://kamalkmwt98:Fl3KGakQryBcvnkB@cluster0.zn0e7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');

const User = mongoose.model('User', new mongoose.Schema({
    firstName: String,
    lastName: String,
    mobile: String,
    email: { type: String, unique: true },
    address: String,
    city: String,
    state: String,
    country: String,
    loginID: String,
    password: String,
    socketID: String,
    status: String
}));

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// User Registration Route
app.post('/register', async (req, res) => {
    const { firstName, lastName, mobile, email, address, city, state, country, loginID, password } = req.body;

    // Basic validation
    if (!firstName || !lastName || !mobile || !email || !address || !city || !state || !country || loginID.length !== 8 || password.length < 8) {
        return res.status(400).json({ error: 'Invalid input' });
    }

    try {
        const newUser = new User({ firstName, lastName, mobile, email, address, city, state, country, loginID, password, status: 'Offline' });
        await newUser.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error registering user' });
    }
});
// Get user details by email
app.get('/user/:email', async (req, res) => {
    const { email } = req.params;
    
    try {
        const user = await User.findOne({ email });
        if (user) {
            res.status(200).json(user);
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error fetching user details' });
    }
});


// Socket.io logic
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('userOnline', async (email) => {
        await User.findOneAndUpdate({ email }, { socketID: socket.id, status: 'Online' });

        // Emit updated live users
        const users = await User.find({ status: 'Online' });
        io.emit('liveUsers', users);
    });

    socket.on('disconnect', async () => {
        await User.findOneAndUpdate({ socketID: socket.id }, { status: 'Offline' });

        // Emit updated live users
        const users = await User.find({ status: 'Online' });
        io.emit('liveUsers', users);
        console.log('User disconnected:', socket.id);
    });
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
