const express = require('express');
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
    'https://bid-for-hope-frontend-git-master-raj-singh-0202s-projects.vercel.app'// your actual Vercel production domain
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

// Test route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Charity Auction API is running successfully!',
    version: '1.0.0'
  });
});

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.log(`Error: ${err.message}`);
  server.close(() => process.exit(1));
});

const uploadRoutes = require('./routes/upload');
app.use('/api/upload', uploadRoutes);

app.use('/api/autobid', require('./routes/autoBid'));

require('./autoBidCron');
