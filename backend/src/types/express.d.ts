import 'express';
import {ISessionPayload} from "../authUtils";
import {IScorer} from "@mock-scores/shared";

declare module 'express' {
    interface Request {
        session?: ISessionPayload,
        tournament?: string
        scorer?: IScorer
    }
}
