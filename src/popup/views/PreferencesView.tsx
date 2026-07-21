import { useCallback, useEffect, useState } from "react";
import type {
  JobTypeOption,
  RemoteWorkOption,
  UserPreferences,
  WorkScheduleOption,
} from "../../shared/types";
import { CheckboxGroup } from "../components/CheckboxGroup";
import { DevDataFileActions } from "../components/DevDataFileActions";
import { SaveStatus, useDebouncedSave } from "../components/SaveStatus";
import { useApp } from "../context/AppContext";
import { migratePreferences } from "../../shared/migration";

const REMOTE_WORK_OPTIONS: { value: RemoteWorkOption; label: string }[] = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
  { value: "noPreference", label: "No preference" },
];

const WORK_SCHEDULE_OPTIONS: { value: WorkScheduleOption; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "evening", label: "Evening" },
  { value: "night", label: "Night" },
  { value: "rotating", label: "Rotating" },
  { value: "onCall", label: "On call" },
  { value: "noPreference", label: "No preference" },
];

const JOB_TYPE_OPTIONS: { value: JobTypeOption; label: string }[] = [
  { value: "fullTime", label: "Full-time" },
  { value: "partTime", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "temporary", label: "Temporary" },
  { value: "internship", label: "Internship" },
  { value: "noPreference", label: "No preference" },
];

export function PreferencesView() {
  const { preferences, savePreferences } = useApp();
  const [draft, setDraft] = useState<UserPreferences>(preferences);

  useEffect(() => {
    setDraft(preferences);
  }, [preferences]);

  const persistPreferences = useCallback(
    async (next: UserPreferences) => {
      await savePreferences({ ...next, setupComplete: true });
    },
    [savePreferences]
  );

  const saveState = useDebouncedSave(draft, persistPreferences);

  function update<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <section>
      <DevDataFileActions
        fileName="job-compat-preferences.json"
        data={draft}
        migrate={migratePreferences}
        onLoad={setDraft}
      />

      <div className="field-row">
        <div className="field">
          <label className="field-heading" htmlFor="minBasePay">
            Minimum base pay (USD)
          </label>
          <input
            id="minBasePay"
            type="number"
            value={draft.minBasePay ?? ""}
            onChange={(e) =>
              update(
                "minBasePay",
                e.target.value ? Number(e.target.value) : null
              )
            }
            placeholder="e.g. 75000"
          />
        </div>
        <div className="field">
          <label className="field-heading" htmlFor="commute">
            Maximum commute (minutes)
          </label>
          <input
            id="commute"
            type="number"
            value={draft.maxCommuteMinutes ?? ""}
            onChange={(e) =>
              update(
                "maxCommuteMinutes",
                e.target.value ? Number(e.target.value) : null
              )
            }
            placeholder="e.g. 45"
          />
        </div>
      </div>

      <CheckboxGroup
        legend="Remote work"
        options={REMOTE_WORK_OPTIONS}
        selected={draft.remoteWork}
        noPreference="noPreference"
        onChange={(values) => update("remoteWork", values)}
      />

      <CheckboxGroup
        legend="Work schedule"
        options={WORK_SCHEDULE_OPTIONS}
        selected={draft.workSchedule}
        noPreference="noPreference"
        onChange={(values) => update("workSchedule", values)}
      />

      <CheckboxGroup
        legend="Job type"
        options={JOB_TYPE_OPTIONS}
        selected={draft.jobType}
        noPreference="noPreference"
        onChange={(values) => update("jobType", values)}
      />

      <SaveStatus state={saveState} savedLabel="Preferences Saved" />
    </section>
  );
}
