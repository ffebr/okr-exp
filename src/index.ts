import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import companyRoutes from './routes/company';
import teamRoutes from './routes/team';
import okrRoutes from './routes/okr';
import checkInRoutes from './routes/checkIn';
import userRoutes from './routes/user';
import corporateOKRRoutes from './routes/corporateOKR';
import teamStatsRoutes from './routes/teamStats';
import corporateStatsRoutes from './routes/corporateStats';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'OKR Express API',
      version: '1.0.0',
      description: 'API for managing OKRs, companies, and teams',
    },
    servers: [
      {
        url: `http://localhost:${port}`,
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{
      bearerAuth: [],
    }],
  },
  apis: ['./src/routes/*.ts'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api', okrRoutes);
app.use('/api/check-ins', checkInRoutes);
app.use('/api/users', userRoutes);
app.use('/api', corporateOKRRoutes);
app.use('/api/teams', teamStatsRoutes);
app.use('/api/companies', corporateStatsRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// MongoDB connection
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://root:2111@localhost:27017';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Express API' });
});

const start = async () => {
  try {
    await connectDB();
    await app.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Server is running on http://localhost:3000');
    console.log('Swagger documentation is available at http://localhost:3000/api-docs');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start(); 