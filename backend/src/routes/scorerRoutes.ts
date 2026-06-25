import express from "express";
import {Request, Response} from "express";


const router = express.Router();



router.get('/:assignmentId', (req: Request, res: Response) => {
    console.log(req.params.assignmentId);
    res.status(200).send("OK");
    return;
})

export default router;