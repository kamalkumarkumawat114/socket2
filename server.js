const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const dotenv = require("dotenv");
const path = require("path");
const bcrypt = require("bcrypt");

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public"))); // Serve static files

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// User Schema and Model
const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  mobileNo: { type: String, required: true, validate: /^[0-9]{10}$/ },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    validate: {
      validator: function (v) {
        return /.+\@.+\..+/.test(v);
      },
      message: (props) => `${props.value} is not a valid email!`,
    },
  },
  address: String,
  street: String,
  city: String,
  state: String,
  country: String,
  loginId: {
    type: String,
    required: true,
    unique: true,
    validate: /^[a-zA-Z0-9]{8}$/,
  },
  // password: { type: String, required: true, validate: /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{6,}$/ },
  password: {
    type: String,
    required: true,
    minlength: 8, // Minimum length for the password
    validate: {
      validator: function (v) {
        // Custom validation logic: At least one uppercase, one lowercase, one number, and one special character
        return (
          /[a-z]/.test(v) &&
          /[A-Z]/.test(v) &&
          /[0-9]/.test(v) &&
          /[!@#$%^&*]/.test(v)
        );
      },
      message: (props) =>
        `${props.value} Password must be at least 8 characters,one lowercase,one uppercase,one number,one special character!`,
    },
  },

  socketId: { type: String, unique: true },
});

userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

const User = mongoose.model("User", userSchema);
const liveUsers = {};

// Helper function to update live users
const updateLiveUsers = (socketId, userData) => {
  liveUsers[socketId] = {
    email: userData.email,
    name: `${userData.firstName} ${userData.lastName}`,
    online: true,
  };
  io.emit("updateUserList", liveUsers);
};

// API endpoint to save user data
app.post("/api/users", async (req, res) => {
  const { email, loginId, socketId } = req.body;

  if (!email || !loginId || !socketId) {
    return res
      .status(400)
      .json({ error: "Email, Login ID, and Socket ID are required." });
  }

  try {
    const existingUser = await User.findOne({ $or: [{ email }, { loginId }] });
    if (existingUser) {
      const errorField = existingUser.email === email ? "Email" : "Login ID";
      return res.status(400).json({ error: `${errorField} already exists.` });
    }

    const user = new User({ ...req.body, socketId });
    await user.save();
    console.log("User created successfully:", user);
    updateLiveUsers(socketId, user);
    res.status(201).json({ message: "User created successfully!" });
  } catch (error) {
    console.error("Error occurred while saving user:", error);
    res.status(500).json({ error: "Server error.", details: error.message });
  }
});

// Login endpoint
app.post("/api/login", async (req, res) => {
  const { loginId, password } = req.body;

  try {
    const user = await User.findOne({ loginId });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: "Invalid login ID or password." });
    }

    // Emit an event to update live users
    io.emit("userLoggedIn", {
      socketId: user.socketId, // Keep the existing socket ID
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      online: true,
    });

    res.json({ message: "Login successful!", user: { name: user.firstName } });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ error: "Server error." });
  }
});

// Get user info by socket ID
app.get("/api/users/:socketId", async (req, res) => {
  const { socketId } = req.params;
  console.log("Looking up user with socket ID:", socketId);

  try {
    const user = await User.findOne({ socketId });
    if (!user) return res.status(404).json({ error: "User not found." });

    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Failed to fetch user." });
  }
});

// Get all users
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Socket.io connection
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("register", async (userData) => {
    updateLiveUsers(socket.id, userData);
    await User.updateOne({ email: userData.email }, { socketId: socket.id });
  });
  socket.on("disconnect", async () => {
    console.log("User disconnected:", socket.id);
    const user = Object.values(liveUsers).find((u) => u.socketId === socket.id);
    if (user) {
        await User.updateOne({ email: user.email }, { socketId: null });
        delete liveUsers[socket.id];
        io.emit("updateUserList", liveUsers); // Notify all clients to update their user list
        io.emit("userDisconnected", socket.id); // Notify clients that a user has disconnected
    }
});
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
