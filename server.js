const express = require('express');
const http = require('http');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();
// Connect to database
connectDB();

// Initialize express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: [
    'http://localhost:3000',         // for local dev
    'https://bidforhope-frontend-1.vercel.app',
    'https://bid-for-hope-frontend-git-master-raj-singh-0202s-projects.vercel.app',
    'https://bid-for-hope-frontend.vercel.app' // production domain
    // Add any other custom domain from Vercel if needed
  ],
  credentials: true
}));

// ====== Create HTTP server and Socket.IO BEFORE loading routes ======
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'https://bidforhope-frontend-1.vercel.app',
      'https://bid-for-hope-frontend-git-master-raj-singh-0202s-projects.vercel.app',
      'https://bid-for-hope-frontend.vercel.app'
    ],
    credentials: true
  }
});
global._io = io; // <-- This is now before ALL routes
// ===========================================================

// ====== NOW setup all your routes (AFTER global._io is set): ======
app.use('/api/auth', require('./routes/auth'));
app.use('/api/auctions', require('./routes/auction'));
app.use('/api/ngos', require('./routes/ngo'));

const bidRoutes = require('./routes/bid');
app.use('/api/bids', bidRoutes);

const uploadRoutes = require('./routes/upload');
app.use('/api/upload', uploadRoutes);

app.use('/api/autobid', require('./routes/autoBid'));
require('./autoBidCron');

// Test route
app.get('/', (req, res) => {
  res.json({
    message: 'Charity Auction API is running successfully!',
    version: '1.0.0'
  });
});

// No need to re-import auctionRoutes here—a single `app.use` is enough

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.log(`Error: ${err.message}`);
  server.close(() => process.exit(1));
});
