import express from 'express';

const router = express.Router();

router.route('/')
    .get((req, res) =>{
        res.send('Hi Im a student');
    });

export default router;