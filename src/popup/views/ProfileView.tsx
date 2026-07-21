import { type ReactNode, useCallback, useEffect, useState } from "react";
import { extractTextFromPdf } from "../../shared/pdfExtract";
import type {
  CertificationEntry,
  EducationEntry,
  ProjectEntry,
  ResumeExtractResult,
  UserProfile,
  WorkExperienceEntry,
} from "../../shared/types";
import {
  EMPTY_CERTIFICATION,
  EMPTY_EDUCATION,
  EMPTY_PROJECT,
  EMPTY_WORK_EXPERIENCE,
} from "../../shared/types";
import { ResumeFillModal } from "../components/ResumeFillModal";
import { DevDataFileActions } from "../components/DevDataFileActions";
import { SaveStatus, useDebouncedSave } from "../components/SaveStatus";
import { useApp } from "../context/AppContext";
import { migrateProfile } from "../../shared/migration";

function EntryCard({
  title,
  onRemove,
  children,
}: {
  title: string;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <div className="entry-card">
      <div className="entry-card-header">
        <h3>{title}</h3>
        <button type="button" className="secondary-btn entry-remove" onClick={onRemove}>
          Remove
        </button>
      </div>
      {children}
    </div>
  );
}

export function ProfileView() {
  const { profile, saveProfile } = useApp();
  const [draft, setDraft] = useState<UserProfile>(profile);
  const [resumeError, setResumeError] = useState("");
  const [showResumeModal, setShowResumeModal] = useState(false);

  useEffect(() => {
    setDraft(profile);
  }, [profile]);

  const persistProfile = useCallback(
    async (next: UserProfile) => {
      await saveProfile({ ...next, setupComplete: true });
    },
    [saveProfile]
  );

  const saveState = useDebouncedSave(draft, persistProfile);

  function applyResumeExtract(data: ResumeExtractResult) {
    setDraft((prev) => ({
      ...prev,
      skills: data.profile.skills || prev.skills,
      workExperience: data.profile.workExperience.length
        ? data.profile.workExperience
        : prev.workExperience,
      projects: data.profile.projects.length ? data.profile.projects : prev.projects,
      education: data.profile.education.length ? data.profile.education : prev.education,
      certifications: data.profile.certifications.length
        ? data.profile.certifications
        : prev.certifications,
      additionalInformation:
        data.profile.additionalInformation || prev.additionalInformation,
    }));
  }

  function update<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function updateWorkExperience(
    index: number,
    key: keyof WorkExperienceEntry,
    value: string
  ) {
    setDraft((prev) => ({
      ...prev,
      workExperience: prev.workExperience.map((entry, i) =>
        i === index ? { ...entry, [key]: value } : entry
      ),
    }));
  }

  function updateProject(index: number, key: keyof ProjectEntry, value: string) {
    setDraft((prev) => ({
      ...prev,
      projects: prev.projects.map((entry, i) =>
        i === index ? { ...entry, [key]: value } : entry
      ),
    }));
  }

  function updateEducation(
    index: number,
    key: keyof EducationEntry,
    value: string | boolean
  ) {
    setDraft((prev) => ({
      ...prev,
      education: prev.education.map((entry, i) =>
        i === index ? { ...entry, [key]: value } : entry
      ),
    }));
  }

  function updateCertification(
    index: number,
    key: keyof CertificationEntry,
    value: string
  ) {
    setDraft((prev) => ({
      ...prev,
      certifications: prev.certifications.map((entry, i) =>
        i === index ? { ...entry, [key]: value } : entry
      ),
    }));
  }

  async function handleResumeFile(file: File) {
    setResumeError("");
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setResumeError("Only PDF files are supported.");
      return;
    }

    try {
      const text = await extractTextFromPdf(file);
      update("parsedResumeText", text);
      update("resumeFileName", file.name);
    } catch {
      setResumeError("Could not read this PDF. Try a different file.");
    }
  }

  return (
    <section>
      <div className="button-row" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className="accent-btn"
          onClick={() => setShowResumeModal(true)}
        >
          Fill from resume
        </button>
      </div>

      <DevDataFileActions
        fileName="job-compat-profile.json"
        data={draft}
        migrate={migrateProfile}
        onLoad={setDraft}
      />

      <ResumeFillModal
        open={showResumeModal}
        onClose={() => setShowResumeModal(false)}
        onApply={applyResumeExtract}
      />

      <div className="field">
        <label className="field-heading" htmlFor="skills">
          Skills
        </label>
        <textarea
          id="skills"
          value={draft.skills}
          onChange={(e) => update("skills", e.target.value)}
          placeholder="e.g. Project management, Microsoft Project, Agile"
        />
      </div>

      <div className="section-block">
        <div className="section-header">
          <h2>Work experience</h2>
          <button
            type="button"
            className="secondary-btn"
            onClick={() =>
              update("workExperience", [
                ...draft.workExperience,
                { ...EMPTY_WORK_EXPERIENCE },
              ])
            }
          >
            Add entry
          </button>
        </div>
        {draft.workExperience.map((entry, index) => (
          <EntryCard
            key={`work-${index}`}
            title={`Experience ${index + 1}`}
            onRemove={() =>
              update(
                "workExperience",
                draft.workExperience.filter((_, i) => i !== index)
              )
            }
          >
            <div className="field">
              <label className="field-heading" htmlFor={`company-${index}`}>
                Company
              </label>
              <input
                id={`company-${index}`}
                value={entry.company}
                onChange={(e) => updateWorkExperience(index, "company", e.target.value)}
                placeholder="e.g. City of Olympia"
              />
            </div>
            <div className="field">
              <label className="field-heading" htmlFor={`title-${index}`}>
                Job title
              </label>
              <input
                id={`title-${index}`}
                value={entry.jobTitle}
                onChange={(e) => updateWorkExperience(index, "jobTitle", e.target.value)}
                placeholder="e.g. Project Manager"
              />
            </div>
            <div className="field">
              <label className="field-heading" htmlFor={`period-${index}`}>
                Employment period
              </label>
              <input
                id={`period-${index}`}
                value={entry.employmentPeriod}
                onChange={(e) =>
                  updateWorkExperience(index, "employmentPeriod", e.target.value)
                }
                placeholder="e.g. Jan 2020 – Present"
              />
            </div>
            <div className="field">
              <label className="field-heading" htmlFor={`work-desc-${index}`}>
                Description
              </label>
              <textarea
                id={`work-desc-${index}`}
                value={entry.description}
                onChange={(e) =>
                  updateWorkExperience(index, "description", e.target.value)
                }
                placeholder="e.g. Led cross-functional teams, managed budgets, delivered on schedule"
              />
            </div>
          </EntryCard>
        ))}
      </div>

      <div className="section-block">
        <div className="section-header">
          <h2>Projects</h2>
          <button
            type="button"
            className="secondary-btn"
            onClick={() =>
              update("projects", [...draft.projects, { ...EMPTY_PROJECT }])
            }
          >
            Add entry
          </button>
        </div>
        {draft.projects.map((entry, index) => (
          <EntryCard
            key={`project-${index}`}
            title={`Project ${index + 1}`}
            onRemove={() =>
              update(
                "projects",
                draft.projects.filter((_, i) => i !== index)
              )
            }
          >
            <div className="field">
              <label className="field-heading" htmlFor={`project-name-${index}`}>
                Project name
              </label>
              <input
                id={`project-name-${index}`}
                value={entry.name}
                onChange={(e) => updateProject(index, "name", e.target.value)}
                placeholder="e.g. Website redesign"
              />
            </div>
            <div className="field">
              <label className="field-heading" htmlFor={`project-desc-${index}`}>
                Description
              </label>
              <textarea
                id={`project-desc-${index}`}
                value={entry.description}
                onChange={(e) => updateProject(index, "description", e.target.value)}
                placeholder="e.g. Migrated legacy site to a modern CMS, improved load times by 40%"
              />
            </div>
          </EntryCard>
        ))}
      </div>

      <div className="section-block">
        <div className="section-header">
          <h2>Education</h2>
          <button
            type="button"
            className="secondary-btn"
            onClick={() =>
              update("education", [...draft.education, { ...EMPTY_EDUCATION }])
            }
          >
            Add entry
          </button>
        </div>
        {draft.education.map((entry, index) => (
          <EntryCard
            key={`education-${index}`}
            title={`Education ${index + 1}`}
            onRemove={() =>
              update(
                "education",
                draft.education.filter((_, i) => i !== index)
              )
            }
          >
            <div className="field">
              <label className="field-heading" htmlFor={`edu-level-${index}`}>
                Level of education
              </label>
              <input
                id={`edu-level-${index}`}
                value={entry.level}
                onChange={(e) => updateEducation(index, "level", e.target.value)}
                placeholder="e.g. Bachelor's degree"
              />
            </div>
            <div className="field">
              <label className="field-heading" htmlFor={`edu-field-${index}`}>
                Field of study
              </label>
              <input
                id={`edu-field-${index}`}
                value={entry.fieldOfStudy}
                onChange={(e) => updateEducation(index, "fieldOfStudy", e.target.value)}
                placeholder="e.g. Computer Science"
              />
            </div>
            <div className="field">
              <label className="field-heading" htmlFor={`edu-school-${index}`}>
                School
              </label>
              <input
                id={`edu-school-${index}`}
                value={entry.school}
                onChange={(e) => updateEducation(index, "school", e.target.value)}
                placeholder="e.g. University of Washington"
              />
            </div>
            <label className="checkbox-option inline-checkbox" htmlFor={`edu-enrolled-${index}`}>
              <input
                id={`edu-enrolled-${index}`}
                type="checkbox"
                checked={entry.currentlyEnrolled}
                onChange={(e) =>
                  updateEducation(index, "currentlyEnrolled", e.target.checked)
                }
              />
              <span>Currently enrolled</span>
            </label>
          </EntryCard>
        ))}
      </div>

      <div className="section-block">
        <div className="section-header">
          <h2>Certifications</h2>
          <button
            type="button"
            className="secondary-btn"
            onClick={() =>
              update("certifications", [
                ...draft.certifications,
                { ...EMPTY_CERTIFICATION },
              ])
            }
          >
            Add entry
          </button>
        </div>
        {draft.certifications.map((entry, index) => (
          <EntryCard
            key={`cert-${index}`}
            title={`Certification ${index + 1}`}
            onRemove={() =>
              update(
                "certifications",
                draft.certifications.filter((_, i) => i !== index)
              )
            }
          >
            <div className="field">
              <label className="field-heading" htmlFor={`cert-name-${index}`}>
                Name of certification
              </label>
              <input
                id={`cert-name-${index}`}
                value={entry.name}
                onChange={(e) => updateCertification(index, "name", e.target.value)}
                placeholder="e.g. PMP"
              />
            </div>
            <div className="field">
              <label className="field-heading" htmlFor={`cert-desc-${index}`}>
                Description
              </label>
              <textarea
                id={`cert-desc-${index}`}
                value={entry.description}
                onChange={(e) =>
                  updateCertification(index, "description", e.target.value)
                }
                placeholder="e.g. Project Management Professional, obtained 2022"
              />
            </div>
          </EntryCard>
        ))}
      </div>

      <div className="field">
        <label className="field-heading" htmlFor="additionalInfo">
          Additional information
        </label>
        <textarea
          id="additionalInfo"
          value={draft.additionalInformation}
          onChange={(e) => update("additionalInformation", e.target.value)}
          placeholder="e.g. Willing to relocate, security clearance, preferred industries"
        />
      </div>

      <div className="field">
        <label className="field-heading" htmlFor="resumeFile">
          Upload resume (PDF, optional)
        </label>
        <input
          id="resumeFile"
          type="file"
          accept=".pdf,application/pdf"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleResumeFile(file);
          }}
        />
        {draft.resumeFileName && (
          <p className="file-name">Selected: {draft.resumeFileName}</p>
        )}
        {resumeError && <p className="field-error">{resumeError}</p>}
      </div>

      <SaveStatus state={saveState} savedLabel="Profile saved" />
    </section>
  );
}
