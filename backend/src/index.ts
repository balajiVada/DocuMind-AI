import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { logger } from './utils/logger';

import { initPinecone } from './config/pinecone';

import documentRoutes from './routes/document.routes';
import chatRoutes from './routes/chat.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5005;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/documents', documentRoutes);
app.use('/api/chat', chatRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'DocuMind-AI Backend is running' });
});

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/documind-ai';

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    logger.info('Connected to MongoDB');
    
    // Initialize Pinecone
    await initPinecone();

    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    logger.error({ err }, 'MongoDB connection error');
  });
