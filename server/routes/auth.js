import express from 'express';
import {
  login,
  forgotPassword,
  resetPassword,
  getAccount,
  changePassword,
} from '../controllers/authController.js';

const router = express.Router();

router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.get('/account/:username', getAccount);
router.patch('/change-password', changePassword);

export default router;
