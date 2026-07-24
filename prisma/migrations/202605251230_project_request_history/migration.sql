DROP INDEX IF EXISTS "ProjectRequest_job_professional_key";
CREATE INDEX IF NOT EXISTS "ProjectRequest_job_professional_idx" ON "ProjectRequest"("jobId", "professionalId");
