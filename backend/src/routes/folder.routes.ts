import { Router } from 'express';
import { getFolders, createFolder, updateFolder, deleteFolder } from '../controllers/folder.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', getFolders);
router.post('/', createFolder);
router.put('/:id', updateFolder);
router.delete('/:id', deleteFolder);

export default router;
