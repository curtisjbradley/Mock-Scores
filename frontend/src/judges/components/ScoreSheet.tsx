import "../styles/scoresheet.css";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type TouchEvent,
} from "react";
import {
  type Control,
  type FieldErrors,
  get,
  type SubmitHandler,
  useForm,
  type UseFormRegister,
  useFormState,
} from "react-hook-form";

import type {
  IAwardCategoryInfo,
  IScoreSheetFormat,
  IStudentInfo,
} from "@mock-scores/shared";

import ConfirmSubmitModal from "./ConfirmSubmitModal.tsx";
import Icon from "../../shared/components/Icon.tsx";

/**
 * Flat map of score field IDs to numeric values.
 */
export type ScoreResults = Record<string, number>;

/** Per-category award selections, ordered from highest to lowest nomination. */
export type NominationSelections = Record<string, string[]>;

const MINIMUM_SWIPE_DISTANCE = 48;
const MOBILE_SCORESHEET_MEDIA_QUERY = "(max-width: 48rem)";
const SCORE_SHEET_HISTORY_STATE = "mockScoresScoreSheet";

interface ScoreSheetHistoryEntry {
  key: string;
  categoryIndex: number;
}

interface SwipeFeedback {
  direction: "next" | "previous";
  progress: number;
}

function isHistoryState(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getHistoryCategory(state: unknown, key: string): number | null {
  if (!isHistoryState(state)) {
    return null;
  }

  const entry = state[SCORE_SHEET_HISTORY_STATE];

  if (!isHistoryState(entry) || entry.key !== key) {
    return null;
  }

  return typeof entry.categoryIndex === "number" &&
    Number.isInteger(entry.categoryIndex)
    ? entry.categoryIndex
    : null;
}

function buildHistoryState(
  state: unknown,
  entry: ScoreSheetHistoryEntry,
): Record<string, unknown> {
  return {
    ...(isHistoryState(state) ? state : {}),
    [SCORE_SHEET_HISTORY_STATE]: entry,
  };
}

/**
 * Builds the form field ID for a score input.
 */
function buildScoreId(assignmentKey: string, side: "P" | "D"): string {
  return `${assignmentKey}${side}`;
}

/**
 * Only keep valid finite numeric values when persisting/restoring scores.
 *
 * This prevents NaN, null, malformed localStorage data, etc. from being
 * restored into the form.
 */
function sanitizeScores(value: unknown): ScoreResults {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const scores: ScoreResults = {};

  for (const [key, score] of Object.entries(value)) {
    if (
      typeof score === "number" &&
      Number.isFinite(score) &&
      Number.isInteger(score)
    ) {
      scores[key] = score;
    }
  }

  return scores;
}

interface ScoreBoxProps {
  /** Unique form field ID for this score input. */
  id: string;

  /** Student associated with this score, if applicable. */
  student: IStudentInfo | null;

  register: UseFormRegister<ScoreResults>;
  control: Control<ScoreResults>;

  minScore: number;
  maxScore: number;

  /**
   * Incremented on every failed submit so persistent errors can
   * be re-announced to assistive technology.
   */
  submitAttempt: number;
}

/**
 * A single score input.
 */
function ScoreBox({
  id,
  student,
  register,
  control,
  minScore,
  maxScore,
  submitAttempt,
}: ScoreBoxProps) {
  /*
   * Subscribe only to this exact field's error state rather than
   * causing every ScoreBox to react to every form-state update.
   */
  const { errors } = useFormState({
    control,
    name: id,
    exact: true,
  });

  /*
   * React Hook Form field names may be paths, so use get()
   * rather than directly indexing errors[id].
   *
   * Your current UUID-style IDs are safe either way, but get()
   * makes this robust if the ID format ever changes.
   */
  const fieldError = get(errors, id);
  const hasError = !!fieldError;

  const errorMessage =
    typeof fieldError?.message === "string"
      ? fieldError.message
      : `Must be ${minScore}–${maxScore}.`;

  /*
   * One validation rule is the source of truth.
   *
   * valueAsNumber turns an empty number input into NaN, which
   * Number.isFinite() handles correctly.
   */
  const registered = register(id, {
    valueAsNumber: true,

    validate: (value) => {
      if (!Number.isFinite(value) || value < minScore || value > maxScore) {
        return `Must be ${minScore}–${maxScore}.`;
      }
      if (!Number.isInteger(value)) {
        return "Must be a whole number.";
      }

      return true;
    },
  });

  return (
    <div className="score-box">
      <label className="sr-only" htmlFor={id}>
        Score for {student?.name ?? id}
      </label>

      <input
        {...registered}
        id={id}
        className="score-input"
        type="number"
        inputMode="numeric"
        min={minScore}
        max={maxScore}
        step={1}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${id}-error` : undefined}
        onWheel={(event) => {
          event.currentTarget.blur();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
          }
        }}
      />
      {hasError && (
        <ScoreError
          key={`${id}-${submitAttempt}`}
          id={id}
          message={errorMessage}
        />
      )}

      {student && (
        <p className="student-name">
          {student.name}
          {student.pronouns && (
            <span className="student-pronouns">({student.pronouns})</span>
          )}
        </p>
      )}
    </div>
  );
}

interface ScoreErrorProps {
  id: string;
  message: string;
}

/**
 * Inline score validation message.
 */
function ScoreError({ id, message }: ScoreErrorProps) {
  return (
    <span id={`${id}-error`} className="error" role="alert">
      {message}
    </span>
  );
}

interface NominationCategoryProps {
  categoryId: string;
  category: IAwardCategoryInfo;
  students: Record<string, IStudentInfo>;
  studentRoles: Record<string, string[]>;
  selected: string[];
  onToggle: (studentId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  prosecutionId: string;
  defenseId: string;
}

/** A single award category's nominees and their ranking. */
function NominationCategory({
  categoryId,
  category,
  students,
  studentRoles,
  selected,
  onToggle,
  onReorder,
  prosecutionId,
  defenseId,
}: NominationCategoryProps) {
  const atMax = selected.length >= category.maxNominees;
  const required = Math.min(
    category.minNominees,
    category.eligibleStudentIds.length,
  );

  return (
    <section
      className="nomination-category"
      aria-labelledby={`award-${categoryId}`}
    >
      <h3 id={`award-${categoryId}`} className="nomination-category-name">
        {category.name}
        <span className="nomination-category-count">
          {" "}
          ({selected.length}/{category.maxNominees}
          {required > 0 ? `, min ${required}` : ""})
        </span>
      </h3>
      <div className="nomination-students">
        {category.eligibleStudentIds.map((studentId) => {
          const info = students[studentId];
          if (!info) return null;
          const isSelected = selected.includes(studentId);
          const disabled = !isSelected && atMax;
          const roles = studentRoles[studentId] ?? [];
          const side =
            info.schoolId === prosecutionId
              ? "P"
              : info.schoolId === defenseId
                ? "D"
                : "";
          return (
            <label
              key={studentId}
              className={`nomination-student${isSelected ? " nomination-student--selected" : ""}${disabled ? " nomination-student--disabled" : ""}`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                disabled={disabled}
                onChange={() => onToggle(studentId)}
              />
              <span className="nomination-student-info">
                <span>
                  {info.name}
                  {side ? ` - ${side}` : ""}
                </span>
                {roles.length > 0 && (
                  <span className="nomination-student-roles">
                    {roles.join(", ")}
                  </span>
                )}
              </span>
            </label>
          );
        })}
        {category.eligibleStudentIds.length === 0 && (
          <p className="nomination-empty">
            No eligible students for this category.
          </p>
        )}
      </div>
      {selected.length > 1 && (
        <div className="nomination-ranking-list">
          <p className="nomination-ranking-hint">
            Use the arrows to rank nominees. #1 = best.
          </p>
          {selected.map((studentId, index) => {
            const info = students[studentId];
            if (!info) return null;
            return (
              <div key={studentId} className="nomination-rank-item">
                <span className="nomination-rank-number">{index + 1}</span>
                <span className="nomination-rank-name">{info.name}</span>
                <div className="nomination-rank-arrows">
                  <button
                    type="button"
                    className={"nom-move-up"}
                    disabled={index === 0}
                    onClick={() => onReorder(index, index - 1)}
                    aria-label={`Move ${info.name} up`}
                  >
                    <Icon name={"Up-Arrow"} />
                  </button>
                  <button
                    type="button"
                    className={"nom-move-up"}
                    disabled={index === selected.length - 1}
                    onClick={() => onReorder(index, index + 1)}
                    aria-label={`Move ${info.name} down`}
                  >
                    <Icon name={"Down-Arrow"} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/**
 * Main scoresheet.
 */
function ScoreSheet(
  details: IScoreSheetFormat & {
    onSubmitSuccess: () => void;
  },
) {
  const storageKey = `mock-trial-scores-${details.pairingID}-${details.scorer.scorerID}`;
  const historyKey = `${details.pairingID}-${details.scorer.scorerID}`;

  const categoryKey = `${storageKey}-category`;

  const { categoryOrder, scoringCategories, witnesses } = details;

  const hasAwards = Object.keys(details.awardCategories ?? {}).length > 0;
  const awardCategoryIndex = categoryOrder.length;
  const lastIndex = hasAwards ? awardCategoryIndex : categoryOrder.length - 1;

  const prosecutionLabel = details.isCriminal ? "Prosecution" : "Plaintiff";

  /*
   * Restore the last category when constructing the component.
   */
  const [categoryIndex, setCategoryIndex] = useState(() => {
    const saved = localStorage.getItem(categoryKey);

    if (saved === null) {
      return 0;
    }

    const parsed = Number.parseInt(saved, 10);

    if (!Number.isInteger(parsed) || parsed < 0 || parsed > lastIndex) {
      return 0;
    }

    return parsed;
  });

  /*
   * Used to cause an existing error alert to be remounted after
   * another failed submission.
   */
  const [submitAttempt, setSubmitAttempt] = useState(0);

  /*
   * We don't attempt to focus the invalid field until React has
   * committed the category change.
   */
  const [pendingErrorId, setPendingErrorId] = useState<string | null>(null);

  const [showConfirm, setShowConfirm] = useState(false);

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [swipeFeedback, setSwipeFeedback] = useState<SwipeFeedback | null>(
    null,
  );

  const [pendingScores, setPendingScores] = useState<ScoreResults | null>(null);

  const [nominations, setNominations] = useState<NominationSelections>({});
  const [showAwardValidation, setShowAwardValidation] = useState(false);
  const awardCategories = useMemo(
    () => details.awardCategories ?? {},
    [details.awardCategories],
  );

  const studentRoles = useMemo(() => {
    const roles: Record<string, string[]> = {};
    const addRole = (studentId: string | null, label: string) => {
      if (!studentId) return;
      const studentRolesForId = roles[studentId] ?? (roles[studentId] = []);
      if (!studentRolesForId.includes(label)) studentRolesForId.push(label);
    };
    for (const catId of details.categoryOrder) {
      const category = details.scoringCategories[catId];
      if (!category) continue;
      const witnessName = category.witnessId
        ? (details.witnesses[category.witnessId]?.characterName ?? null)
        : null;
      for (const assignment of category.categoryAssignments) {
        const label = witnessName
          ? `${assignment.assignmentName} - ${witnessName}`
          : assignment.assignmentName;
        addRole(assignment.pStudentId, label);
        addRole(assignment.dStudentId, label);
      }
    }
    return roles;
  }, [details.categoryOrder, details.scoringCategories, details.witnesses]);

  const isNominationsValid = useMemo(
    () =>
      Object.entries(awardCategories).every(([categoryId, category]) => {
        const required = Math.min(
          category.minNominees,
          category.eligibleStudentIds.length,
        );
        return (nominations[categoryId] ?? []).length >= required;
      }),
    [awardCategories, nominations],
  );

  const { register, handleSubmit, reset, control, setFocus, subscribe } =
    useForm<ScoreResults>({
      mode: "onBlur",
      reValidateMode: "onChange",
      shouldFocusError: false,
    });

  /**
   * Resolve student information.
   */
  const student = (id: string | null): IStudentInfo | null => {
    if (!id) {
      return null;
    }

    return details.students[id] ?? null;
  };

  /*
   * Restore saved scores.
   */
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);

    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored);

      reset(sanitizeScores(parsed));
    } catch {
      localStorage.removeItem(storageKey);
    }
  }, [reset, storageKey]);

  /*
   * Persist the currently selected category.
   */
  useEffect(() => {
    localStorage.setItem(categoryKey, String(categoryIndex));
  }, [categoryIndex, categoryKey]);

  /*
   * Mark the current browser-history entry with the category it represents.
   * This makes the Android/system Back action return to the previous category
   * before leaving the scoresheet.
   */
  useEffect(() => {
    const currentCategory = getHistoryCategory(
      window.history.state,
      historyKey,
    );

    if (currentCategory === categoryIndex) {
      return;
    }

    /*
     * A restored scoresheet may begin on a later category. Seed its earlier
     * categories so Back still works immediately after a page refresh.
     */
    if (currentCategory === null && categoryIndex > 0) {
      window.history.replaceState(
        buildHistoryState(window.history.state, {
          key: historyKey,
          categoryIndex: 0,
        }),
        "",
      );

      for (let index = 1; index <= categoryIndex; index++) {
        window.history.pushState(
          buildHistoryState(window.history.state, {
            key: historyKey,
            categoryIndex: index,
          }),
          "",
        );
      }
      return;
    }

    window.history.replaceState(
      buildHistoryState(window.history.state, {
        key: historyKey,
        categoryIndex,
      }),
      "",
    );
  }, [categoryIndex, historyKey]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const index = getHistoryCategory(event.state, historyKey);

      if (index !== null && index >= 0 && index <= lastIndex) {
        setCategoryIndex(index);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [historyKey, lastIndex]);

  /*
   * Persist scores whenever a form value changes.
   *
   * The subscription is recreated automatically if storageKey
   * changes and properly cleaned up on unmount.
   */
  useEffect(() => {
    return subscribe({
      formState: {
        values: true,
      },

      callback: ({ values }) => {
        const scores = sanitizeScores(values);

        localStorage.setItem(storageKey, JSON.stringify(scores));
      },
    });
  }, [subscribe, storageKey]);

  /*
   * Focus and scroll only after categoryIndex has been committed
   * by React.
   *
   * This removes the race between setCategoryIndex() and trying
   * to focus an element inside the newly active category.
   */
  useEffect(() => {
    if (!pendingErrorId) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setFocus(pendingErrorId);

      document.getElementById(pendingErrorId)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      setPendingErrorId(null);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [categoryIndex, pendingErrorId, setFocus]);

  /**
   * Valid submission.
   */
  const onSubmit: SubmitHandler<ScoreResults> = (scores) => {
    if (!isNominationsValid) {
      setShowAwardValidation(true);
      navigateToCategory(awardCategoryIndex);
      return;
    }
    setPendingScores(scores);
    setShowConfirm(true);
  };

  const toggleNominee = (
    categoryId: string,
    studentId: string,
    maxNominees: number,
  ) => {
    setNominations((current) => {
      const selected = current[categoryId] ?? [];
      if (selected.includes(studentId))
        return {
          ...current,
          [categoryId]: selected.filter((id) => id !== studentId),
        };
      if (selected.length >= maxNominees) return current;
      return { ...current, [categoryId]: [...selected, studentId] };
    });
  };

  const reorderNominee = (
    categoryId: string,
    fromIndex: number,
    toIndex: number,
  ) => {
    setNominations((current) => {
      const selected = [...(current[categoryId] ?? [])];
      const [moved] = selected.splice(fromIndex, 1);
      selected.splice(toIndex, 0, moved);
      return { ...current, [categoryId]: selected };
    });
  };

  /**
   * Invalid submission.
   *
   * Find the first invalid field according to the score sheet's
   * category/assignment order rather than depending on object-key
   * ordering from React Hook Form.
   */
  const onInvalid = (formErrors: FieldErrors<ScoreResults>) => {
    setSubmitAttempt((current) => current + 1);

    for (
      let categoryIdx = 0;
      categoryIdx < categoryOrder.length;
      categoryIdx++
    ) {
      const category = scoringCategories[categoryOrder[categoryIdx]];

      for (const assignment of category.categoryAssignments) {
        const pId = buildScoreId(assignment.assignmentKey, "P");

        const dId = buildScoreId(assignment.assignmentKey, "D");

        /*
         * Only check fields that actually exist for this
         * assignment's side.
         */
        if (assignment.side !== "D" && get(formErrors, pId)) {
          setPendingErrorId(pId);
          navigateToCategory(categoryIdx);
          return;
        }

        if (assignment.side !== "P" && get(formErrors, dId)) {
          setPendingErrorId(dId);
          navigateToCategory(categoryIdx);
          return;
        }
      }
    }
  };

  const navigateToCategory = (index: number) => {
    const nextIndex = Math.max(0, Math.min(lastIndex, index));

    if (nextIndex === categoryIndex) {
      return;
    }

    window.history.pushState(
      buildHistoryState(window.history.state, {
        key: historyKey,
        categoryIndex: nextIndex,
      }),
      "",
    );
    setCategoryIndex(nextIndex);
  };

  const handlePrev = () => {
    if (categoryIndex > 0) {
      window.history.back();
    }
  };

  /**
   * Advance to the next category.
   */
  const handleNext = () => {
    navigateToCategory(categoryIndex + 1);
  };

  /**
   * Store the origin of a single-finger gesture. Scrolling is left to the
   * browser; only a deliberate, mostly horizontal swipe changes categories.
   */
  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    setSwipeFeedback(null);

    if (!window.matchMedia(MOBILE_SCORESHEET_MEDIA_QUERY).matches) {
      touchStart.current = null;
      return;
    }

    if (event.touches.length !== 1) {
      touchStart.current = null;
      return;
    }

    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchMove = (event: TouchEvent<HTMLElement>) => {
    const start = touchStart.current;

    if (!start || event.touches.length !== 1) {
      return;
    }

    const touch = event.touches[0];
    const horizontalDistance = touch.clientX - start.x;
    const verticalDistance = touch.clientY - start.y;

    if (Math.abs(horizontalDistance) <= Math.abs(verticalDistance)) {
      setSwipeFeedback(null);
      return;
    }

    const direction = horizontalDistance < 0 ? "next" : "previous";
    const canNavigate =
      direction === "next" ? categoryIndex < lastIndex : categoryIndex > 0;

    setSwipeFeedback(
      canNavigate
        ? {
            direction,
            progress: Math.min(
              Math.abs(horizontalDistance) / MINIMUM_SWIPE_DISTANCE,
              1,
            ),
          }
        : null,
    );
  };

  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = touchStart.current;
    touchStart.current = null;
    setSwipeFeedback(null);

    if (!start || event.changedTouches.length !== 1) {
      return;
    }

    const touch = event.changedTouches[0];
    const horizontalDistance = touch.clientX - start.x;
    const verticalDistance = touch.clientY - start.y;

    if (
      Math.abs(horizontalDistance) < MINIMUM_SWIPE_DISTANCE ||
      Math.abs(horizontalDistance) <= Math.abs(verticalDistance)
    ) {
      return;
    }

    if (horizontalDistance < 0) {
      handleNext();
    } else {
      handlePrev();
    }
  };

  const isLastCategory = categoryIndex === lastIndex;

  return (
    <>
      <form
        id="scores"
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => {
          touchStart.current = null;
          setSwipeFeedback(null);
        }}
        noValidate
        autoComplete="off"
      >
        <div className="trial-info-card">
          <div className="trial-info-meta">
            <span className="trial-info-courtroom">
              Courtroom {details.courtroomNumber}
            </span>

            <span className="trial-info-presider">{details.presiderName}</span>
          </div>

          <h1 className="tournament-name">{details.tournamentName}</h1>

          <h2 className="case-name">{details.caseName}</h2>

          <div className="team-labels">
            <div className="team-label team-label--prosecution">
              <span className="team-code">{details.prosecutionCode}</span>

              <span className="team-label-role">{prosecutionLabel}</span>
            </div>

            <div className="team-label team-label--defense">
              <span className="team-code team-code--defense">
                {details.defenseCode}
              </span>

              <span className="team-label-role">Defense</span>
            </div>
          </div>
        </div>

        <div
          className={
            categoryIndex === awardCategoryIndex
              ? "score-container score-container--awards"
              : "score-container"
          }
        >
          <table id="score-table">
            <thead>
              <tr className="scoresheet-header">
                <th>Scoring Category</th>

                <th>{prosecutionLabel}</th>

                <th>Defense</th>
              </tr>
            </thead>

            {categoryOrder.map((catId, index) => {
              const category = scoringCategories[catId];

              const witness = category.witnessId
                ? witnesses[category.witnessId]
                : null;

              const displayName = witness
                ? `${category.categoryName} - ${witness.characterName}`
                : category.categoryName;

              return (
                <tbody
                  key={catId}
                  id={`category-${index}`}
                  className={
                    index === categoryIndex
                      ? "category-active"
                      : "category-inactive"
                  }
                  aria-hidden={index !== categoryIndex}
                >
                  <tr className="category-name">
                    <th colSpan={3}>{displayName}</th>
                  </tr>

                  {category.categoryAssignments.map((assignment) => {
                    const pId = buildScoreId(assignment.assignmentKey, "P");

                    const dId = buildScoreId(assignment.assignmentKey, "D");

                    return (
                      <tr
                        key={`${assignment.assignmentKey}-${assignment.side}`}
                        className="score-row"
                      >
                        <td>{assignment.assignmentName}</td>

                        <td>
                          {assignment.side !== "D" && (
                            <ScoreBox
                              id={pId}
                              register={register}
                              control={control}
                              student={student(assignment.pStudentId)}
                              minScore={assignment.minScore}
                              maxScore={assignment.maxScore}
                              submitAttempt={submitAttempt}
                            />
                          )}
                        </td>

                        <td>
                          {assignment.side !== "P" && (
                            <ScoreBox
                              id={dId}
                              register={register}
                              control={control}
                              student={student(assignment.dStudentId)}
                              minScore={assignment.minScore}
                              maxScore={assignment.maxScore}
                              submitAttempt={submitAttempt}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
          </table>
        </div>

        {hasAwards && (
          <section
            id="award-nominations"
            className={`award-nominations ${
              categoryIndex === awardCategoryIndex
                ? "award-nominations--active"
                : "award-nominations--inactive"
            }`}
            aria-labelledby="award-nominations-title"
          >
            <h2 id="award-nominations-title">Individual Award Nominations</h2>
            <p>Select and rank students for each award category.</p>
            {Object.entries(awardCategories).map(([categoryId, category]) => (
              <NominationCategory
                key={categoryId}
                categoryId={categoryId}
                category={category}
                students={details.students}
                studentRoles={studentRoles}
                selected={nominations[categoryId] ?? []}
                onToggle={(studentId) =>
                  toggleNominee(categoryId, studentId, category.maxNominees)
                }
                onReorder={(fromIndex, toIndex) =>
                  reorderNominee(categoryId, fromIndex, toIndex)
                }
                prosecutionId={details.prosecutionId}
                defenseId={details.defenseId}
              />
            ))}
            {showAwardValidation && !isNominationsValid && (
              <p className="ranking-error" role="alert">
                Please select the minimum number of nominees for each category.
              </p>
            )}
          </section>
        )}

        <div className="scoresheet-footer">
          <button
            type="submit"
            id="score-submit-desktop"
            aria-label="Submit scoresheet"
          >
            Submit Scoresheet
          </button>
        </div>

        <nav className="scoresheet-nav" aria-label="Scoresheet navigation">
          <button
            type="button"
            id="prev-button"
            className="nav-button"
            aria-label="Previous category"
            disabled={categoryIndex <= 0}
            onClick={handlePrev}
          >
            <Icon name={"Left-Arrow"} /> Previous
          </button>

          <span className="nav-progress" aria-live="polite" aria-atomic="true">
            {categoryIndex + 1}
            {" / "}
            {lastIndex + 1}
          </span>

          <button
            type="button"
            id="next-button"
            className="nav-button"
            aria-label="Next category"
            disabled={isLastCategory}
            onClick={handleNext}
          >
            Next <Icon name={"Right-Arrow"} />
          </button>

          <p className="nav-category-label" aria-hidden="true">
            {categoryIndex === awardCategoryIndex
              ? "Individual Award Nominations"
              : (() => {
                  const category =
                    scoringCategories[categoryOrder[categoryIndex]];

                  const witness = category.witnessId
                    ? witnesses[category.witnessId]
                    : null;

                  return witness
                    ? `${category.categoryName} - ${witness.characterName}`
                    : category.categoryName;
                })()}
          </p>

          <button
            type="submit"
            id="score-submit"
            className={isLastCategory ? "submit-active" : "submit-inactive"}
            aria-label="Submit scoresheet"
          >
            Submit
          </button>
        </nav>

        {swipeFeedback && (
          <div
            className={`swipe-feedback swipe-feedback--${swipeFeedback.direction}`}
            style={
              {
                opacity: swipeFeedback.progress,
                transform: `translateY(-50%) scale(${0.85 + swipeFeedback.progress * 0.15})`,
              } satisfies CSSProperties
            }
            aria-hidden="true"
          >
            <Icon
              name={
                swipeFeedback.direction === "next"
                  ? "Right-Arrow"
                  : "Left-Arrow"
              }
            />
            <span>
              {swipeFeedback.direction === "next"
                ? "Next category"
                : "Previous category"}
            </span>
          </div>
        )}
      </form>

      {showConfirm && (
        <ConfirmSubmitModal
          setShowConfirm={setShowConfirm}
          storageKey={storageKey}
          setPendingScores={setPendingScores}
          pendingScores={pendingScores}
          nominations={nominations}
          prosecution={details.prosecutionCode}
          defense={details.defenseCode}
          prosecutionLabel={prosecutionLabel}
          details={details}
          onSubmitSuccess={details.onSubmitSuccess}
          defense_id={details.defenseId}
          prosecution_id={details.prosecutionId}
          showTiebreaker={details.ballotOptions.showTiebreaker}
        />
      )}
    </>
  );
}

export default ScoreSheet;
