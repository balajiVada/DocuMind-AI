import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { logger } from './utils/logger';

import { initPinecone } from './config/pinecone';

import documentRoutes from './routes/document.routes';
import chatRoutes from './routes/chat.routes';
import authRoutes from './routes/auth.routes';
import folderRoutes from './routes/folder.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5005;

// Middleware
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/documents', documentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/folders', folderRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'DocuMind-AI Backend is running' });
});

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/documind-ai';

import { startWorker } from './workers/document.worker';

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    logger.info('Connected to MongoDB');
    
    // Initialize Pinecone
    await initPinecone();

    // Start background workers
    startWorker();

    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    logger.error({ err }, 'MongoDB connection error');
  });
