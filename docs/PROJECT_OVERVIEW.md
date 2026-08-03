# Project overview

Servio connects **clients** who need work completed with **professionals** who offer services. The implementation presents public discovery pages and authenticated client, professional, and administrator areas. Primary code: `src/routes/`, `src/client/`, `src/professional/`, and `src/admin/`.

## Users and workflows

- A visitor browses jobs, services and professionals (`GET /api/v1/jobs`, `/services`, `/professionals`).
- A client registers, completes a profile, creates/edits jobs, reviews applications, initiates a hire, pays, and reviews a completed project.
- A professional registers, completes category/location/skills details, creates services, applies to jobs, tracks earnings and requests payouts.
- An administrator manages accounts, verification, jobs, CMS/FAQ/contact material, payments and reports.

## Scope and business rules

- Roles are `CLIENT`, `PROFESSIONAL`, and `ADMIN`; role checks are enforced by `currentUser` in `src/backend/api.server.ts`.
- Registration only permits client or professional roles, passwords are 8–128 characters, and email is normalized.
- A professional application requires a job, optional positive bid, duration, and a 20–4,000 character cover letter.
- Client reviews require a completed tracking record and ratings from 1 to 5.
- Job owners can only read/change/delete their own client jobs. Upload access is owner/admin only, with signed content URLs.

## Limits and confirmation points

The Flutter application calls the HTTP API but is primarily a UI reproduction (`flutter_app/pubspec.yaml`). Its production parity and release process **Need confirmation**. Payment endpoints record internal wallet/payment data; no external payment gateway integration was found.
