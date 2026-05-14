import 'express';
import {ISessionPayload} from "../authUtils";

declare module 'express' {
    interface Request {
        session?: ISessionPayload,
        tournament?: string
    }
}
