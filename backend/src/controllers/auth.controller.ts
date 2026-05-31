import { Request, Response } from 'express';
import User from '../models/User';
import Workspace from '../models/Workspace';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const generateToken = (userId: string) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: '7d', // Use access token only for MVP, refresh tokens later
  });
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = new User({
      email,
      passwordHash,
      firstName,
      lastName,
    });
    await user.save();

    // Create default workspace for the user
    const workspace = new Workspace({
      name: 'Personal Workspace',
      ownerId: user._id,
    });
    await workspace.save();

    const token = generateToken(user._id.toString());

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      defaultWorkspace: workspace,
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during registration' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = generateToken(user._id.toString());
    
    // Fetch user's workspaces
    const workspaces = await Workspace.find({ ownerId: user._id, isDeleted: false });
    const defaultWorkspace = workspaces.length > 0 ? workspaces[0] : undefined;

    res.status(200).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      defaultWorkspace,
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during login' });
  }
};

export const me = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    
    // Get all user workspaces
    const workspaces = await Workspace.find({ ownerId: req.user._id, isDeleted: false });

    res.status(200).json({
      user: {
        id: req.user._id,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
      },
      activeWorkspaceId: req.workspaceId,
      workspaces,
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching user profile' });
  }
};
