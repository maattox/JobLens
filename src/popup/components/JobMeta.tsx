import type { JobObject } from "../../shared/types";

export function JobMeta({
  job,
  reportId,
}: {
  job?: JobObject | null;
  reportId?: string;
}) {
  if (!job) return null;

  return (
    <div className="job-meta" style={{ marginTop: 14 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 13 }}>Job listing</h3>
      <dl className="job-meta-list">
        <div>
          <dt>Title</dt>
          <dd>{job.title || "—"}</dd>
        </div>
        <div>
          <dt>Salary</dt>
          <dd>{job.salary || "—"}</dd>
        </div>
        <div>
          <dt>Company</dt>
          <dd>{job.company || "—"}</dd>
        </div>
        {job.employmentType && (
          <div>
            <dt>Job type</dt>
            <dd>{job.employmentType}</dd>
          </div>
        )}
        <div>
          <dt>Location</dt>
          <dd>{job.location || "—"}</dd>
        </div>
        {job.workMode && (
          <div>
            <dt>Work mode</dt>
            <dd>{job.workMode}</dd>
          </div>
        )}
        {job.url && (
          <div>
            <dt>Link</dt>
            <dd>
              <a href={job.url} target="_blank" rel="noreferrer">
                View listing
              </a>
            </dd>
          </div>
        )}
        {reportId && (
          <div>
            <dt>Report ID</dt>
            <dd className="report-id">{reportId}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
