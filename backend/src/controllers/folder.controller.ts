import { Request, Response } from 'express';
import Folder from '../models/Folder';
import Document from '../models/Document';
import { logger } from '../utils/logger';

export const getFolders = async (req: Request | any, res: Response): Promise<any> => {
  try {
    const folders = await Folder.find({ 
      workspaceId: req.workspaceId, 
      isDeleted: false 
    }).sort({ createdAt: -1 });
    
    return res.status(200).json(folders);
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to fetch folders');
    return res.status(500).json({ error: 'Failed to fetch folders' });
  }
};

export const createFolder = async (req: Request | any, res: Response): Promise<any> => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const folder = new Folder({
      name,
      workspaceId: req.workspaceId,
    });

    await folder.save();
    return res.status(201).json(folder);
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to create folder');
    return res.status(500).json({ error: 'Failed to create folder' });
  }
};

export const updateFolder = async (req: Request | any, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const folder = await Folder.findOneAndUpdate(
      { _id: id, workspaceId: req.workspaceId, isDeleted: false },
      { name },
      { new: true }
    );

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    return res.status(200).json(folder);
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to update folder');
    return res.status(500).json({ error: 'Failed to update folder' });
  }
};

export const deleteFolder = async (req: Request | any, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const folder = await Folder.findOneAndUpdate(
      { _id: id, workspaceId: req.workspaceId, isDeleted: false },
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Delete all documents associated with this folder
    await Document.updateMany(
      { folderId: folder._id, isDeleted: false },
      { isDeleted: true, deletedAt: new Date() }
    );

    return res.status(200).json({ message: 'Folder and associated documents deleted successfully' });
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to delete folder');
    return res.status(500).json({ error: 'Failed to delete folder' });
  }
};
