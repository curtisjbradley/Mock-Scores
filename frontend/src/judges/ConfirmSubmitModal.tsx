import {type Dispatch, type SetStateAction, useMemo} from "react";
import type {Nominee, NomineeRanks, ScoreResults} from "./scoresheet-details.tsx";

interface IConfirmSubmitModalProps {
    nominees: Nominee[],
    setNominees: (nominees: Nominee[]) => void,
    nomineeRanks: NomineeRanks
    setNomineeRanks: Dispatch<SetStateAction<NomineeRanks>>,
    setShowConfirm: (confirm: boolean) => void,
    pendingScores: ScoreResults | null,
    setPendingScores: (scores: ScoreResults | null) => void,
    storageKey: string,


}

const ConfirmSubmitModal = ({
                                nominees,
                                setNominees,
                                nomineeRanks,
                                setNomineeRanks,
                                setShowConfirm,
                                pendingScores,
                                setPendingScores,
    storageKey,
                            }: IConfirmSubmitModalProps) => {

    const getNominationPayload = () => {
        return Object.fromEntries(
            nominees.map((nominee) => [nominee.name, nomineeRanks[nominee.id]])
        );
    };
    const resetConfirmationState = () => {
        setShowConfirm(false);
        setPendingScores(null);
        setNominees([]);
        setNomineeRanks({});
    };
    const handleConfirmSubmit = () => {
        if (!pendingScores || !isRankingValid) return;

        const finalPayload = {
            scores: pendingScores,
            nominations: getNominationPayload(),
        };

        // TODO: Send to backend
        console.log(finalPayload);

        localStorage.removeItem(storageKey);
        resetConfirmationState();
    };

    const handleCancelSubmit = () => {
        resetConfirmationState();
    };

    const handleRankChange = (nomineeId: string, rank: string) => {
        setNomineeRanks((current) => ({
            ...current,
            [nomineeId]: Number(rank),
        }));
    };

    const isRankingValid = useMemo(() => {
        return nominees.every((nominee) => nomineeRanks[nominee.id] != null);
    }, [nominees, nomineeRanks]);

    return (<div className="modal-backdrop" role="presentation">
        <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-submit-title"
            aria-describedby="confirm-submit-description"
        >
            <h2 id="confirm-submit-title">Submit score sheet?</h2>

            <p id="confirm-submit-description">
                Please confirm your scores. Once you submit you will not be able
                to undo this.
            </p>

            {nominees.length > 0 && (
                <div className="nominee-ranking">
                    <h3>Rank nominated students</h3>

                    <p>Lower numbers mean better performance. Duplicates are allowed.</p>

                    {nominees.map((nominee) => (
                        <label key={nominee.id} className="nominee-rank-row">
            <span>
                <span>
                    <strong>{nominee.name}</strong>

            <div className="nominee-roles">
            {nominee.roles.map((role) => (
                <div key={role}>{role}</div>
            ))}
            </div>
            </span>
            </span>

                            <select
                                className="rank-selection"
                                value={nomineeRanks[nominee.id] ?? ""}
                                onChange={(event) =>
                                    handleRankChange(nominee.id, event.target.value)
                                }
                            >
                                <option value="" disabled>
                                    Select rank
                                </option>

                                {nominees.map((_, index) => (
                                    <option key={index + 1} value={index + 1}>
                                        {index + 1}
                                    </option>
                                ))}
                            </select>
                        </label>
                    ))}
                </div>
            )}

            {nominees.length > 0 && !isRankingValid && (
                <p className="ranking-error" role="alert">
                    Please rank all nominated students.
                </p>
            )}

            <div className="confirm-actions">
                <button type="button" onClick={handleCancelSubmit}>
                    Cancel
                </button>

                <button
                    id="confirm-button"
                    type="button"
                    onClick={handleConfirmSubmit}
                    disabled={!isRankingValid}
                >
                    Confirm
                </button>
            </div>
        </div>
    </div>)

}

export default ConfirmSubmitModal