const express = require('express');
const http = require('http'); // <--- ADD THIS
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
    'https://bid-for-hope-frontend.vercel.app' // your actual Vercel production domain
    // Add any other custom domain from Vercel if needed
  ],
  credentials: true
}));

// Routes
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

const auctionRoutes = require('./routes/auction');
app.use('/api/auctions', auctionRoutes);

// Create HTTP server for Socket.IO
const server = http.createServer(app);

// Set up Socket.IO
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'https://bidforhope-frontend-1.vercel.app',
      'https://bid-for-hope-frontend-git-master-raj-singh-0202s-projects.vercel.app',
      'https://bid-for-hope-frontend.vercel.app'
      // Add any custom domain here too
    ],
    credentials: true
  }
});
global._io = io;

// Export io for controllers to use
module.exports.io = io;

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
