import db from "../db"
import {TournamentPayload} from "@mock-scores/shared";
import {randomUUID} from "node:crypto";


export interface ITournament {
    id: string;
    name: string;
    location: string;
    start_date?: Date;
    end_date?: Date;
    created_at?: Date;
    case_name: string;
    criminal_case: boolean;
    p_witnesses_called: number;
    d_witnesses_called: number;
    has_swing: boolean;
}


export class TournamentProvider {

    async getTournaments(userEmail: string): Promise<ITournament[]> {
        return (await db.query("Select * from tournaments where tournaments.id in (select tournament from tournament_owners where delegate_email = $1 )", [userEmail])).rows;
    }


    async getTournament(tournamentID: string): Promise<ITournament | undefined> {
        const tournaments: ITournament[] = (await db.query("Select * from tournaments where id = $1", [tournamentID])).rows;

        if (tournaments.length == 0) {
            return undefined;
        }
        return tournaments[0];
    }

    async createTournament(tournament: TournamentPayload): Promise<ITournament> {

        const tournamentID = randomUUID()

        const tournamentInsertion = await db.query("Insert Into tournaments " +
            "(id, name, location, start_date, end_date, case_name, criminal_case, p_witnesses_called, d_witnesses_called)" +
            " VALUES ($1, $2, $3,$4,$5,$6,$7,$8, $9)",
            [tournamentID,
                tournament.tournament.name,
                tournament.tournament.location,
                tournament.tournament.startDate,
                tournament.tournament.endDate,
                tournament.caseFormat.caseName,
                tournament.caseFormat.criminalCase,
                tournament.caseFormat.pWitnessesCalled,
                tournament.caseFormat.pWitnessesCalled]);

        if(tournamentInsertion.rowCount != 1) {
            throw new Error("Could not add tournament to database");
        }
        tournament.caseFormat.dWitnessNames.map(
            (witnessName) => {
                db.query("INSERT INTO case_witnesses (tournament_id, side, name) VALUES ($1, $2,$3)", [tournamentID,"D", witnessName])
            }
        )
        tournament.caseFormat.pWitnessNames.map(
            (witnessName) => {
                db.query("INSERT INTO case_witnesses (tournament_id, side, name) VALUES ($1, $2,$3)", [tournamentID,"P", witnessName])
            }
        )
        if (tournament.caseFormat.hasSwing) {
            tournament.caseFormat.swingWitnessNames.map(
                (witnessName) => {
                     db.query("INSERT INTO case_witnesses (tournament_id, side, name) VALUES ($1, $2,$3)", [tournamentID, "SWING", witnessName])
                }
            )
        }

        tournament.scoringCategories.map(async category =>  {
            const categoryID = randomUUID()
            await db.query("INSERT INTO scoring_categories (id, tournament_id, name, witness_category, position) VALUES ($1, $2, $3,$4, $5)", [categoryID, tournamentID,category.name, category.witnessCategory, category.position])
            category.fields.map(field => {
                db.query("INSERT INTO scoring_fields (category_id, label, min_score, max_score, multiplier, assignable, eligible_for_award, visible_to_scorers, prosecution, defense, calling, crossing, position) VALUES ($1, $2, $3, $4,$5,$6,$7,$8, $9, $10, $11, $12, $13)", [categoryID,field.label, field.min, field.max,field.multiplier,field.assignable,field.eligibleForAward,field.visibleToScorers,field.prosecution,field.defense,field.calling,field.crossing,field.position])
            })
        })


        const tournamentInDb : ITournament[] = (await db.query("SELECT * from tournaments where id = $1", [tournamentID])).rows;

        if (tournamentInDb.length == 0) {
            throw new Error("Tournament could not be created");
        }

        return tournamentInDb[0];
    }

    async addTournamentOrganizer(tournamentID : string, delegateEmail : string, role: "owner" | "delegate"){
        await db.query("INSERT INTO tournament_owners (tournament, delegate_email, role) VALUES ($1, $2, $3)", [tournamentID,delegateEmail,role])
    }
}
