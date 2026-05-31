import { Router } from 'express';
import { upload } from '../middleware/upload';
import { uploadDocument, listDocuments, deleteDocument, retryDocument, updateDocumentFolder } from '../controllers/document.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth); // Protect all document routes

router.post('/upload', upload.single('file'), uploadDocument);
router.get('/', listDocuments);
router.delete('/:id', deleteDocument);
router.post('/:id/retry', retryDocument);
router.put('/:id/folder', updateDocumentFolder);

export default router;
