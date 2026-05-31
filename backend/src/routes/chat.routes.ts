import { Router } from 'express';
import { 
  handleChat, 
  getSessions, 
  createSession, 
  getSessionMessages, 
  deleteSession, 
  renameSession 
} from '../controllers/chat.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.post('/', handleChat);
router.get('/sessions', getSessions);
router.post('/sessions', createSession);
router.get('/sessions/:id/messages', getSessionMessages);
router.delete('/sessions/:id', deleteSession);
router.put('/sessions/:id', renameSession);

export default router;
