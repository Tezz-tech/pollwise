# PollWise

Short lessons, practice and module checks for the people who run polling units and collation centres in Nigeria.
Built by Tezzer Technologies. Not affiliated with INEC or any political party.

## What is in this repository

| Folder    | What it is                                                                                                      |
| --------- | --------------------------------------------------------------------------------------------------------------- |
| `server/` | The API: Node 22, Express 5, MongoDB (Mongoose). Runs on Vercel (`server/api`) or any Node host.                |
| `admin/`  | The admin website: React and Vite. Deployed as a static site.                                                   |
| `mobile/` | The learner app: React Native with Expo. Built with EAS.                                                        |
| `shared/` | Constants, validation schemas, XP rules and design tokens used by all three.                                    |
| `docs/`   | The product spec, design system, security requirements, build phases, decisions, route review and deploy guide. |
| `brand/`  | Logo, mascot and app icons.                                                                                     |

Start with `CLAUDE.md` (the project rules) and `docs/DEPLOY.md` (how to deploy).

## Running it locally

```bash
npm ci                              # at the repository root
cp server/.env.example server/.env  # then fill in the values (see the file)
npm run dev -w server               # API on http://localhost:4000
npm run dev -w @pollwise/admin      # admin on http://localhost:5173
```

Tests and checks:

```bash
npm test -w server
npm run lint -w @pollwise/admin
npm run lint -w @pollwise/mobile
```

## Security

Secrets live only in environment variables and are never committed. `server/.env.example` and
`mobile/.env.example` list every variable. To report a security problem, contact the maintainers directly
rather than opening a public issue.
