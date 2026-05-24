import { Router } from 'express';
import { upload } from '../middleware/upload';
import { uploadDocument, listDocuments, deleteDocument } from '../controllers/document.controller';

const router = Router();

router.post('/upload', upload.single('file'), uploadDocument);
router.get('/', listDocuments);
router.delete('/:id', deleteDocument);

export default router;
