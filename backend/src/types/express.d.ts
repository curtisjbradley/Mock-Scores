import 'express';
import {ISessionPayload} from "../authUtils";
import {IOrganizer, IRound, IScorer, ITeam} from "@mock-scores/shared";

declare module 'express' {
    interface Request {
        session?: ISessionPayload
        tournament?: string
        scorer?: IScorer
        round?: IRound
        selectedOrganizer?: IOrganizer
        selectedTeam?: ITeam
    }
}
